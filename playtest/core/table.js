// Plays one ONLINE game: several devices, one room, real screens on each.
//
// driver.js plays a table through one shared screen, because local play is
// one device. Online, every seat is its own device with its own screen, and
// most of the time most of them are WAITING — on the host, on the player
// whose turn it is, on the network. So this loop goes round the seats: each
// one looks at its own screen and acts if it has something to do, and the
// table is stuck only when nobody has acted for a while and the game is not
// over. The strategies are the same files the local bots use; a seat's
// screen is just a screen.
//
// A seat is { label, name, isHost, adapter } where the adapter is driver.js's
// interface plus crash() (the tab closes: socket drops, no exit runs) and
// alive.
import { screenChecks, rosterCheck } from './checks.js';
import { find, genericAction, startButton, click, fill } from './generic.js';
import { reproCommand, describeScenario } from './driver.js';

// Both casings of the label, spelled out: the lobby's banner `RoomCode` sets it
// `uppercase`, and Chrome's innerText applies that ("ROOM CODE"), while jsdom
// ignores CSS. Once the lobby stopped also showing the top bar's chip (whose
// sr-only label is plain text), only the banner was left to read. Not the `i`
// flag: it would let the code group match lowercase too, and read "Playe" out
// of "Room codePlayers (2)".
const CODE = /(?:(?:Room code|ROOM CODE)\s*|Share this code with the other players:\s*)([A-HJ-NP-Z2-9]{5})/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The REAL timers, captured when this module loads — before the jsdom runner
// installs fake ones, under which a 30s guard would fire inside any long
// fake-time wait (a turn timer run out) and fail a healthy run.
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
export function withTimeout(promise, ms, what) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = realSetTimeout(() => reject(new Error(`${what} did not finish in ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, guard]).finally(() => realClearTimeout(timer));
}
export const GRACE_WAIT = 26_000; // presence GRACE_MS is 20s; leave slack for the tick

// The online half of the arcade's shared screens: the mode picker, create or
// join, and the lobby. Everything after Start is the strategy's.
//
// A lobby is known by what only a lobby has: the guest's "the host picks the
// settings" card, or a room code, the "Players (N)" roster and a Start button
// together. It was known by its "Share this code with the other players" line
// until the lobby restyle cut that line, and every online run then sat in the
// lobby with nobody starting. All three, because each alone is elsewhere too:
// the room code is in every in-game top bar, and AniGuess's character reveal
// ends on a "Start Game!" of its own.
const inLobby = (snap) => /the host picks the settings|share this code with the other players|waiting for .* to start/i.test(snap.text)
  || (/room code/i.test(snap.text) && /players \(\d+\)/i.test(snap.text) && Boolean(startButton(snap)));

function roomAction(snap, ctx) {
  const { seat, table } = ctx;
  const online = find(snap, /play online/i);
  if (online) return click(online, 'play online');

  const create = find(snap, /create room/i);
  const codeBox = find(snap, /^room code$/i, { role: 'textbox' });
  if (create || codeBox) {
    if (seat.isHost) return create ? click(create, 'create room') : null;
    if (!table.code) return null; // the host has not made it yet
    if (codeBox && codeBox.value !== table.code) return fill(codeBox, table.code, 'type the room code');
    return click(find(snap, /^join$/i), 'join room');
  }

  // The lobby: the host starts once every seat shows on the roster; a guest
  // waits. Lobby settings were seeded into the host's storage, the same
  // remembered prefs a local setup screen reads.
  if (inLobby(snap)) {
    ctx.memory.phase = 'lobby';
    if (!seat.isHost) return null;
    // Case-blind: the roster sets names in display caps, and a real browser's
    // innerText reads them as "CADEN".
    const text = snap.text.toLowerCase();
    const everyone = table.seats.filter((s) => s.adapter.alive).every((s) => text.includes(s.name.toLowerCase()));
    const start = startButton(snap);
    if (everyone && start && !start.disabled) {
      table.started = true;
      return click(start, 'start the game');
    }
    if (everyone && start?.disabled) {
      const fix = ctx.strategy.fixBlocked?.(snap, ctx);
      if (fix && (ctx.memory.fixes = (ctx.memory.fixes ?? 0) + 1) <= 3) return fix;
      table.blocked = snap.text.slice(-300);
    }
    return null;
  }
  return null;
}

export async function playTable({
  seats, game, strategy, scenario, rng, layer = 'online', budgetMs = 420_000,
  idleMs = 20_000, debug = false, onScreen,
}) {
  // `known` is what the table can see between them — a category shown to
  // everyone but its owner, say — for strategies that act on table knowledge.
  const table = { seats, code: null, started: false, blocked: null, known: {} };
  const ctxs = new Map(seats.map((s) => [s, { game, scenario, rng, strategy, seat: s, table, memory: {} }]));
  const record = {
    layer, game: game.id, seed: scenario.seed, scenario: describeScenario(scenario),
    outcome: 'pass', failure: null, steps: 0, screens: {}, findings: [], trace: [],
    repro: reproCommand(game.id, scenario.seed, layer), end: null,
    note: 'online runs replay only approximately: network timing varies run to run',
  };
  const started = performance.now();
  const fail = (kind, message) => { if (!record.failure) { record.outcome = 'fail'; record.failure = { kind, message }; } };
  const softFails = [];
  const soft = (f, screen, who) => {
    const list = f.severity === 'fail' ? softFails : record.findings;
    if (!list.some((x) => x.kind === f.kind && x.message === f.message)) list.push({ ...f, screen, seat: who });
  };
  const done = new Set();
  let idleSince = performance.now();
  let lastCrashAt = 0;
  const snaps = new Map();

  while (record.outcome === 'pass') {
    if (performance.now() - started > budgetMs) { fail('timeout', `table still playing after ${budgetMs / 1000}s`); break; }
    const alive = seats.filter((s) => s.adapter.alive);
    if (!alive.length) { fail('stuck', 'every seat has left'); break; }
    let acted = false;

    for (const seat of alive) {
      const ctx = ctxs.get(seat);
      const snap = await seat.adapter.snapshot();
      // A screen that is still changing is the game working, not a wedged
      // table: AniTune's host spends ~23s of real time on "Loading themes…
      // 12/15" (30 throttled requests) while every seat waits, and an idle
      // clock that only counted presses failed that as stuck in real Chrome.
      // A countdown that never ends is still caught by `budgetMs`.
      if (snaps.has(seat) && snaps.get(seat).signature !== snap.signature) idleSince = performance.now();
      snaps.set(seat, snap);
      const screen = snap.screen;
      record.screens[screen] = (record.screens[screen] ?? 0) + 1;
      if (onScreen) await onScreen(seat, snap, screen, record);
      for (const f of screenChecks(snap)) {
        if (f.kind === 'crash') fail('crash', `${seat.name}: ${f.message}`);
        else soft(f, screen, seat.name);
      }
      for (const e of seat.adapter.errors()) soft({ kind: 'console-error', severity: 'fail', message: e }, screen, seat.name);
      if (record.failure) break;

      const code = snap.text.match(CODE)?.[1];
      if (code && !table.code) table.code = code;

      if (table.started && strategy.isDone(snap, ctx)) { done.add(seat); continue; }
      done.delete(seat);

      let action = roomAction(snap, ctx);
      if (!action && ctx.memory.phase !== 'lobby' && table.started) {
        ctx.memory.phase = 'game';
        action = (await strategy.act?.(snap, ctx)) ?? null;
        // The fallback presses anything; online, a seat with nothing to do is
        // usually WAITING, and a waiting seat pressing a toggle forever would
        // look like progress. A run of random presses on one screen is a wait.
        if (!action) {
          const g = genericAction(snap, ctx);
          const key = `${screen}::${g?.why}`;
          ctx.memory.randomRun = g?.why === 'random press' && key === ctx.memory.randomKey ? (ctx.memory.randomRun ?? 0) + 1 : 0;
          ctx.memory.randomKey = key;
          if (g && (g.why !== 'random press' || ctx.memory.randomRun < 4)) action = g;
        }
      }
      if (ctx.memory.phase === 'lobby' && !inLobby(snap)) ctx.memory.phase = 'game';
      if (!action) continue;

      record.steps++;
      record.trace.push({ step: record.steps, screen: `${seat.name}: ${screen}`, action: `${action.why}${action.name ? `: ${action.name}` : ''}${action.text ? ` ← "${action.text}"` : ''}` });
      if (debug) console.log(`[${game.id}#${scenario.seed}] ${seat.name} ${screen} :: ${record.trace.at(-1).action}`);
      if (debug === 'screens') console.log(`    ${snap.text.slice(0, 400)}`);
      action.think ??= rng.int(40, 160);
      try {
        // Bounded: one hung await (a click on a node mid-unmount) used to hold
        // the whole table past its budget and past vitest's own timeout, after
        // which the loop kept playing against a torn-down document.
        await withTimeout(seat.adapter.perform(action), 20_000, `${action.why} on ${seat.name}`);
      } catch (e) {
        soft({ kind: 'action-error', severity: 'warn', message: `${action.why}: ${e.message}` }, screen, seat.name);
      }
      acted = true;
      idleSince = performance.now();
    }
    if (record.failure) break;
    if (table.blocked && !table.started) {
      const verdict = strategy.onBlocked?.(null, {}) ?? { kind: 'blocked', message: table.blocked };
      if (verdict.expected) { record.end = 'blocked (expected)'; record.findings.push({ kind: 'blocked', severity: 'info', message: table.blocked }); break; }
      fail(verdict.kind, `lobby Start disabled with everyone in: …${table.blocked}`);
      break;
    }

    // Over when every seat still here is on an end screen.
    const live = seats.filter((s) => s.adapter.alive);
    // A guest's results screen often has no replay control (only the host
    // gets "Back to lobby"), so a guest on the same screen as a finished host
    // counts as finished too.
    const host = live.find((s) => s.isHost && done.has(s));
    const over = (s) => done.has(s) || (host && snaps.get(s)?.screen === snaps.get(host).screen);
    if (table.started && live.length && live.every(over)) {
      record.end = snaps.get(live[0])?.screen;
      for (const s of live) {
        const names = seats.map((x) => x.name);
        const snap = snaps.get(s);
        for (const f of strategy.endRoster ? (strategy.endRoster(snap, ctxs.get(s)) ? rosterCheck(snap, strategy.endRoster(snap, ctxs.get(s))) : []) : rosterCheck(snap, names)) soft(f, snap.screen, s.name);
      }
      // Every device must agree on the result: the numbers on each final
      // screen, as a multiset, are the scoreboard with the layout removed
      // (snapshot.js's `tally` leaves out per-device status lines).
      const tallies = live.map((s) => [...(snaps.get(s).tally ?? snaps.get(s).text.match(/-?\d+/g) ?? [])].sort().join(','));
      if (new Set(tallies).size > 1) soft({ kind: 'desync', severity: 'fail', message: `devices disagree on the final screen: ${live.map((s, i) => `${s.name}=[${tallies[i].slice(0, 80)}]`).join(' ')}` }, record.end, 'table');
      break;
    }

    // Chaos, once: a seat's tab closes (or reloads) partway into the game.
    const chaos = scenario.chaos;
    const inGame = table.started && seats.some((s) => ctxs.get(s).memory.phase === 'game');
    if (chaos && !table.chaosDone && inGame && record.steps >= chaos.at) {
      table.chaosDone = true;
      const victim = chaos.who === 'host' ? live.find((s) => s.isHost) : rng.pick(live.filter((s) => !s.isHost));
      if (victim && live.length > (strategy.minOnline ?? 2)) {
        record.trace.push({ step: record.steps, screen: victim.name, action: `CHAOS ${chaos.kind} ${chaos.who}` });
        if (chaos.kind === 'reload') await victim.adapter.reload();
        else { await victim.adapter.crash(); lastCrashAt = performance.now(); }
        idleSince = performance.now();
      }
    }

    if (!acted) {
      // After a departure the room is allowed the whole grace window to notice.
      const allowance = idleMs + (performance.now() - lastCrashAt < GRACE_WAIT + idleMs ? GRACE_WAIT : 0);
      if (performance.now() - idleSince > allowance) {
        const where = seats.filter((s) => s.adapter.alive).map((s) => `${s.name} on "${snaps.get(s)?.screen}"`).join('; ');
        fail('stuck', `nobody has acted for ${Math.round(allowance / 1000)}s — ${where}`);
        break;
      }
      await sleep(250);
    }
  }

  record.ms = Math.round(performance.now() - started);
  if (softFails.length) {
    record.findings.unshift(...softFails);
    if (record.outcome === 'pass') fail(softFails[0].kind, softFails[0].message);
  }
  if (record.outcome === 'fail') {
    record.lastScreen = seats.filter((s) => snaps.has(s)).map((s) => `── ${s.name}${s.adapter.alive ? '' : ' (gone)'}: ${snaps.get(s).text.slice(0, 400)}`).join('\n');
  }
  record.trace = record.trace.slice(-30);
  return record;
}
