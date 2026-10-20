// Plays one game, start to results, through whatever adapter it is handed.
//
// The driver knows nothing about jsdom or Playwright. An adapter is:
//
//   snapshot()        → snapshotDom()'s shape
//   perform(action)   → click / fill / select / wait, then let the screen settle
//   errors()          → console errors and page errors since the last call
//   reload()          → a fresh page load over the same storage
//   exitToHub()       → the in-game Hub button, confirm accepted
//
// Each step: look, check, decide, act. The decision goes, first to last:
// the arcade's shared screens (hub, mode picker, profile picker), the
// strategy's setup hook while on a setup screen, the Start button, the
// strategy's in-game move, and finally the generic fallback. A step where all
// of them pass is STUCK — a screen with no way forward, the bug that wedges a
// table — and a run of steps where the screen never changes is NO PROGRESS.
import { screenChecks, rosterCheck } from './checks.js';
import { withTimeout } from './table.js';
import { arcadeAction, genericAction, settingsTweak, startButton, find } from './generic.js';

export const reproCommand = (gameId, seed, layer = 'local') =>
  `npm run playtest -- --layer ${layer} --game ${gameId} --seed ${seed}`;

// Who is seated on a setup screen. Every seat in the arcade carries a
// "Remove <name>" control, which is the reliable signal: jsdom's textContent
// runs adjacent elements together ("CadenYou20 shows"), so a word-boundary
// search of the text misses exactly the main player.
function seatedNames(snap, nameRes) {
  const removable = nameRes.filter(([n]) => snap.controls.some((c) => c.name === `Remove ${n}`)).map(([n]) => n);
  return removable.length ? removable : nameRes.filter(([, re]) => re.test(snap.text)).map(([n]) => n);
}

const wordRe = (n) => new RegExp(`(^|[^\\p{L}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'u');

// maxSteps is a backstop, not a measure of anything: stuck/no-progress/loop are
// what catch a bot that has lost its way. 600 was outgrown by a legitimate
// AniTag table — five rounds, four players, every name ruled on by everyone —
// which finished at step 625 on its results screen (anitag seed 9).
export async function playGame({
  adapter, game, strategy, scenario, rng, layer = 'local',
  maxSteps = 900, stallLimit = 15, loopLimit = 40, budgetMs = 90_000, onScreen, debug = false,
}) {
  const ctx = { game, scenario, rng, memory: {}, strategy };
  const record = {
    layer,
    game: game.id,
    seed: scenario.seed,
    scenario: describeScenario(scenario),
    outcome: 'pass',
    failure: null,
    steps: 0,
    screens: {},
    findings: [],
    trace: [],
    repro: reproCommand(game.id, scenario.seed, layer),
    end: null,
  };
  // performance.now, not Date.now: the jsdom runner fakes Date, and the budget
  // is about this machine's wall clock, not the game's.
  const started = performance.now();
  const fail = (kind, message) => {
    record.outcome = 'fail';
    record.failure = { kind, message };
  };
  const softFails = [];
  const soft = (f, screen) => {
    const list = f.severity === 'fail' ? softFails : record.findings;
    if (!list.some((x) => x.kind === f.kind && x.message === f.message)) list.push({ ...f, screen, step: record.steps });
  };
  const nameRes = scenario.names.map((n) => [n, wordRe(n)]);
  const foldNames = (s) => nameRes.reduce((acc, [n]) => acc.split(n).join('@'), s);

  let lastSig = null;
  let same = 0;
  let lastKey = null;
  let repeat = 0;
  let snap = null;

  for (let step = 0; step < maxSteps; step++) {
    record.steps = step;
    // A wall-clock budget as well as a step limit: a run must end inside the
    // test timeout, or vitest abandons it mid-act and the NEXT seed inherits
    // its half-finished React updates and real timers.
    if (performance.now() - started > budgetMs) { fail('timeout', `still playing after ${budgetMs / 1000}s (step ${step})`); break; }
    snap = await adapter.snapshot();
    const screen = foldNames(snap.screen);
    record.screens[screen] = (record.screens[screen] ?? 0) + 1;
    if (onScreen) await onScreen(snap, screen, ctx, record);

    // A crash ends the run — there is nothing left to play. Anything else
    // that fails a check (a console error, NaN on screen) fails the RUN but
    // not the game: the bot plays on, so one bad screen does not hide every
    // screen after it, and the report lists each distinct failure once.
    for (const f of screenChecks(snap)) {
      if (f.kind === 'crash') { fail(f.kind, f.message); break; }
      soft(f, screen);
    }
    for (const e of adapter.errors()) soft({ kind: 'console-error', severity: 'fail', message: e }, screen);
    if (record.failure) break;

    // Which part of the arcade we are in, read off the screen rather than
    // remembered, so a chaos exit or a reload re-derives it instead of leaving
    // the driver believing it is still mid-game. Every setup screen in the
    // arcade has an Add player button and no in-game screen does.
    const onSetup = Boolean(find(snap, /add player/i, { enabled: false }) && startButton(snap));
    if (onSetup && ctx.memory.phase !== 'setup') ctx.memory.phase = 'setup';
    // Left setup without pressing Start — a saved game resumed from the
    // prompt over it — is still a game in progress.
    if (!onSetup && ctx.memory.phase === 'setup' && !find(snap, /play on this device/i)) ctx.memory.phase = 'game';
    // Back from a chaos exit straight into a game the arcade restored (no
    // setup screen on the way): if this is neither the hub nor a picker, the
    // game is on, and the end screen must be recognised as one.
    // Three screens running, not one: the exit itself passes through frames
    // with no tiles on them, and reading one of those as "restored" left the
    // bot pressing random hub tiles instead of reopening its game.
    const tileHere = snap.controls.some((c) => c.name.includes(game.title) && c.name.length > game.title.length + 10);
    if (!ctx.memory.phase && ctx.memory.chaosDone && !onSetup && !tileHere
      && !find(snap, /play on this device/i) && !find(snap, /press start/i)) {
      ctx.memory.restoreHits = (ctx.memory.restoreHits ?? 0) + 1;
      if (ctx.memory.restoreHits >= 3) ctx.memory.phase = 'game';
    } else {
      ctx.memory.restoreHits = 0;
    }
    ctx.seated = seatedNames(snap, nameRes).length;

    // After a chaos exit the phase is unknown until the bot re-establishes it,
    // and a resumed game can reach its end screen first; check it then too.
    const maybeInGame = ctx.memory.phase === 'game' || (ctx.memory.chaosDone && !ctx.memory.phase && !onSetup);
    if (maybeInGame && strategy.isDone(snap, ctx)) {
      record.end = foldNames(screen);
      // A strategy can narrow who the last screen must name (a two-list
      // comparison names two players, not the table) or return null to skip.
      const roster = strategy.endRoster ? strategy.endRoster(snap, ctx) : (ctx.playing ?? scenario.names);
      const end = [...(roster ? rosterCheck(snap, roster) : []), ...(strategy.verifyEnd?.(snap, ctx) ?? [])];
      const bad = end.find((f) => f.severity === 'fail');
      if (bad) fail(bad.kind, bad.message);
      record.findings.push(...end.filter((f) => f.severity !== 'fail'));
      break;
    }

    // Chaos: once, partway into the game, leave the way a player would and
    // check the arcade lets the table come back and finish.
    const chaos = scenario.chaos;
    if (chaos && !ctx.memory.chaosDone && ctx.memory.phase === 'game' && (ctx.memory.gameSteps ?? 0) >= chaos.at) {
      ctx.memory.chaosDone = true;
      ctx.memory.phase = undefined;
      record.trace.push({ step, screen, action: `CHAOS ${chaos.kind}` });
      if (chaos.kind === 'reload') await adapter.reload();
      else await adapter.exitToHub();
      lastSig = null;
      continue;
    }

    let action = arcadeAction(snap, ctx);
    if (!action && ctx.memory.phase === 'setup') {
      // A "Resume Game?" prompt over the setup screen is the game's question,
      // not setup's: the strategy decides between resuming and starting fresh.
      if (find(snap, /^resume/i)) action = (await strategy.act?.(snap, ctx)) ?? null;
      action ??= (await strategy.setup?.(snap, ctx)) ?? null;
      if (!action && scenario.uiSettings && ctx.seated >= scenario.names.length) action = settingsTweak(snap, ctx);
      if (!action) {
        const start = startButton(snap);
        if (start && !start.disabled) {
          ctx.memory.phase = 'game';
          ctx.memory.gameSteps = 0;
          ctx.playing = seatedNames(snap, nameRes);
          action = { click: start.id, name: start.name, why: 'start' };
        } else if (start?.disabled && ctx.seated >= scenario.names.length && (ctx.memory.setupWaits ?? 0) < 6) {
          // A Start greyed out for a moment is usually setup still loading
          // (AniQuiz waits on the fact pack): give it a few seconds before
          // reading it as a refusal.
          ctx.memory.setupWaits = (ctx.memory.setupWaits ?? 0) + 1;
          action = { wait: 500, why: 'wait for setup' };
        } else if (start?.disabled && ctx.seated >= scenario.names.length) {
          // Start greyed out with a full table: the game is refusing these
          // settings. That is a legitimate outcome for a gating scenario and a
          // bug for any other, so it is the strategy's call which this is.
          // A strategy can answer a refusal the way a player would — turn off
          // the filter the warning names — by returning an action.
          const fix = strategy.fixBlocked?.(snap, ctx);
          if (fix && (ctx.memory.fixes = (ctx.memory.fixes ?? 0) + 1) <= 3) {
            record.findings.push({ kind: 'blocked', severity: 'info', message: `Start refused, then fixed by "${fix.name}": …${snap.text.slice(-160)}` });
            action = fix;
          }
        }
        if (!action && start?.disabled && ctx.seated >= scenario.names.length) {
          const verdict = strategy.onBlocked?.(snap, ctx)
            // A run that pressed random settings may well have asked for a
            // game that cannot be dealt (a stat axis nobody's list carries).
            // Refusing that is correct; it is recorded, not failed.
            ?? (scenario.uiSettings ? { expected: true } : null)
            ?? { kind: 'blocked', message: `Start disabled with a full table: …${snap.text.slice(-300)}` };
          if (verdict.expected) record.findings.push({ kind: 'blocked', severity: 'info', message: `Start refused: …${snap.text.slice(-200)}` });
          if (verdict.expected) { record.end = 'blocked (expected)'; break; }
          fail(verdict.kind, verdict.message);
          break;
        }
      }
    }
    if (!action && ctx.memory.phase === 'game') action = (await strategy.act?.(snap, ctx)) ?? null;
    if (!action) action = genericAction(snap, ctx);
    if (!action) { fail('stuck', `no way forward on "${screen}"`); break; }

    if (snap.signature === lastSig) same++;
    else same = 0;
    lastSig = snap.signature;
    if (same >= stallLimit) { fail('no-progress', `"${screen}" unchanged for ${same} actions (last: ${action.why} ${action.name ?? ''})`); break; }
    // A screen that changes every step can still be going nowhere: typing a
    // new value into the same box forever never trips the check above. The
    // same kind of action on the same screen this many times running is a
    // loop, whichever side of it — the game or the strategy — is at fault.
    const key = `${screen}::${action.why}`;
    repeat = key === lastKey ? repeat + 1 : 0;
    lastKey = key;
    if (repeat >= loopLimit) { fail('loop', `"${action.why}" on "${screen}" ${repeat} times running`); break; }

    record.trace.push({ step, screen, action: `${action.why}${action.name ? `: ${action.name}` : ''}${action.text ? ` ← "${action.text}"` : ''}` });
    if (debug) console.log(`[${game.id}#${scenario.seed}] ${step} ${screen} :: ${record.trace.at(-1).action}`);
    if (debug === 'screens') console.log(`    ${snap.text.slice(0, 300)}
    ⟨${snap.controls.map((c) => `${c.role}:${c.name.slice(0, 40)}${c.disabled ? '!' : ''}`).join(' | ')}⟩`);
    if (ctx.memory.phase === 'game') ctx.memory.gameSteps = (ctx.memory.gameSteps ?? 0) + 1;
    ctx.last = { action, signature: snap.signature };
    // Time a person takes between seeing a screen and pressing something. Not
    // decoration: AniFake's reveal ignores a tap inside its first 400ms on
    // purpose (ARM_MS), and a timed round is only a test of the timer if the
    // clock moves while players think.
    action.think ??= rng.int(250, 900);
    try {
      await withTimeout(adapter.perform(action), 30_000, action.why);
    } catch (e) {
      fail('action-error', `${action.why} ${action.name ?? ''}: ${e.message}`);
      break;
    }
  }
  if (record.outcome === 'pass' && !record.end) fail('step-limit', `no results screen after ${maxSteps} steps`);
  if (softFails.length) {
    record.findings.unshift(...softFails);
    if (record.outcome === 'pass') fail(softFails[0].kind, softFails[0].message);
  }

  record.ms = Math.round(performance.now() - started);
  if (record.outcome === 'fail') {
    record.lastScreen = snap?.text.slice(0, 1200);
    record.lastControls = snap?.controls.map((c) => `${c.role}:${c.name.slice(0, 60)}${c.disabled ? ' (disabled)' : ''}`);
    if (debug) console.log(`[${game.id}#${scenario.seed}] LAST SCREEN
${record.lastScreen}
CONTROLS ${JSON.stringify(record.lastControls)}`);
  }
  record.trace = record.trace.slice(-25);
  return record;
}

export function describeScenario(s) {
  return {
    players: s.names.length,
    names: s.names,
    prefs: s.prefs,
    uiSettings: s.uiSettings,
    chaos: s.chaos,
    variant: s.variant,
  };
}
