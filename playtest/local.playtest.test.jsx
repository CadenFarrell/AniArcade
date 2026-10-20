// @vitest-environment jsdom
//
// Local playtest bots: every registered game, played from the hub tile to its
// results screen through the real screens, once per seed. `npm run playtest`.
//
// What this adds over the unit suite: the rules tests prove a score; the hub
// test proves a game MOUNTS; AniQuizGame.test.jsx plays one game through. This
// plays all seven, with 1–6 fixture players, every value of every setting, a
// seeded mix of choices, and now and then a player bailing to the hub or the
// page reloading mid-game — and fails on a crash, a console error, a screen
// with no way forward, a screen that never changes, or a template that printed
// NaN. See playtest/core/driver.js for the loop and checks.js for the checks.
//
// Determinism: the bot's choices and the game's own Math.random both come from
// the seed, and time is FAKE — it only moves when the bot advances it — so a
// seed replays the same game exactly. Real time would make a timed round's
// outcome depend on how fast this machine happened to be.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, configure, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFile, readdir } from 'node:fs/promises';
import { games } from '../src/hub/registry';
import { snapshotDom } from './core/snapshot.js';
import { playGame } from './core/driver.js';
import { scenarioFor, profilesFor } from './core/scenarios.js';
import { makeRng, mulberry32, gameSeed } from './core/rng.js';
import { strategies } from './strategies/index.js';
import { respondAnimeThemes, isAnimeThemes } from './fakes/animethemes.js';
import { installMediaStubs } from './fakes/media.js';
import { writeLayerReport } from './report.js';

// vitest loads .env.local, which points at PRODUCTION Firebase. Local play is
// the unconfigured build, exactly as in HubScreen.test.jsx.
vi.mock('../src/shared/services/firebase', () => ({
  firebaseEnabled: false,
  getFirebaseAuth: () => { throw new Error('firebase touched in local play'); },
  getFirebaseDb: () => { throw new Error('firebase touched in local play'); },
  ensureSignedIn: () => { throw new Error('firebase touched in local play'); },
}));

const ONLY_GAME = process.env.PLAYTEST_GAME || null;
const ONLY_SEED = process.env.PLAYTEST_SEED ? Number(process.env.PLAYTEST_SEED) : null;
const RUNS = Number(process.env.PLAYTEST_RUNS || 20);
// PLAYTEST_DEBUG=1 logs every action; =screens adds each screen's text and controls.
const DEBUG = process.env.PLAYTEST_DEBUG === 'screens' ? 'screens' : Boolean(process.env.PLAYTEST_DEBUG);
const seeds = ONLY_SEED != null ? [ONLY_SEED] : Array.from({ length: RUNS }, (_, i) => i + 1);

// React console noise that is about the TEST harness rather than the app.
// Everything else on console.error is a finding — React's own render errors,
// key warnings and failed prop types included.
const HARNESS_NOISE = /not wrapped in act|testing environment is not configured to support act/i;

// RTL's default asyncWrapper ends every user-event call by awaiting a
// setTimeout(0), and only auto-advances it under JEST's fake timers — under
// vitest's the click simply never returns. Time here moves only when settle()
// or a wait action moves it, so the wrapper just runs the callback.
configure({ asyncWrapper: async (cb) => cb() });

const facts = new Map();
const records = [];

beforeAll(async () => {
  // The pack is the one network request local play makes (see the root
  // CLAUDE.md). Held in memory rather than read per fetch, so a fetch resolves
  // in a microtask: a real disk read would land at an arbitrary point between
  // two bot steps and the run would stop being a pure function of its seed.
  for (const f of await readdir('public/facts')) facts.set(f, await readFile(`public/facts/${f}`));
  // Every game's code compiled once up front, HubScreen.test.jsx's reason —
  // later runs re-EVALUATE it (see freshApp) but never re-transform it.
  await Promise.all(games.map((g) => g.Component.preload()));
}, 120_000);

afterAll(() => writeLayerReport('local', records, { only: ONLY_GAME, seeds }));

// A fresh copy of the whole app per run. Module-level state survives
// cleanup() — the fact pack's loaded promise, caches keyed off it, the
// game-load memo — and it made a seed play differently depending on which
// seeds ran before it (AniRank's seed 7 dealt another ten cards in a sweep
// than alone). resetModules re-evaluates every app module, while React and the
// testing libraries stay shared because they are external to Vite's graph;
// the providers and HubScreen must come from the same fresh graph or the
// contexts would not match.
async function freshApp() {
  vi.resetModules();
  const [{ default: HubScreen }, { games: fresh }, arcade] = await Promise.all([
    import('../src/hub/HubScreen'),
    import('../src/hub/registry'),
    import('../src/shared/testing/arcade'),
  ]);
  await Promise.all(fresh.map((g) => g.Component.preload()));
  return { HubScreen, ...arcade };
}

function makeAdapter(user, errors, offsite, app) {
  const { HubScreen, renderArcade } = app;
  // null when the control went away during the think time (a timer expired
  // the turn, say): the action is dropped and the next step looks again.
  const el = (id) => document.querySelector(`[data-bot-id="${id}"]`);
  // Lets the screen finish reacting: advance fake time a frame at a time and
  // yield to the real event loop until the DOM stops changing. setImmediate is
  // deliberately NOT faked — React's scheduler runs on it under Node.
  async function settle() {
    let last = '';
    let stable = 0;
    for (let i = 0; i < 40 && stable < 2; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(16); });
      await new Promise((r) => setImmediate(r));
      const now = document.body.innerHTML;
      stable = now === last ? stable + 1 : 0;
      last = now;
    }
  }
  return {
    settle,
    snapshot: async () => snapshotDom(),
    errors: () => errors.splice(0).concat(offsite.splice(0)),
    async perform(a) {
      if (a.think) await act(async () => { await vi.advanceTimersByTimeAsync(a.think); });
      const node = el(a.click ?? a.fill ?? a.select ?? a.slide);
      if (a.click && node) await user.click(node);
      else if (a.fill && node) {
        await user.clear(node);
        if (a.text) await user.type(node, a.text);
      } else if (a.select && node) await user.selectOptions(node, a.value);
      else if (a.slide && node) fireEvent.change(node, { target: { value: String(a.value) } });
      else if (a.key) await user.keyboard(a.key);
      else if (a.wait) await act(async () => { await vi.advanceTimersByTimeAsync(a.wait); });
      await settle();
    },
    async reload() {
      cleanup();
      renderArcade(<HubScreen />);
      await settle();
    },
    async exitToHub() {
      // Matched as a whole name: the Hub button is an icon plus the word "Hub"
      // now, with no emoji to anchor on.
      const hub = [...document.querySelectorAll('button')].find((b) => /^\s*(🏠\s*)?hub\s*$/i.test(b.textContent));
      if (hub) await user.click(hub);
      await settle();
    },
  };
}

async function runOne(game, strategy, seed) {
  const scenario = scenarioFor(game, strategy, seed);
  const app = await freshApp();
  const { HubScreen, renderArcade, seedProfiles } = app;
  localStorage.clear();
  const profiles = profilesFor(scenario, strategy);
  seedProfiles(profiles);
  localStorage.setItem('aniarcade_game_prefs', JSON.stringify({ [game.id]: scenario.prefs }));
  strategy.seedStorage?.(localStorage, scenario, profiles);

  const errors = [];
  const offsite = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    const msg = args.map((a) => (a instanceof Error ? a.stack ?? a.message : String(a))).join(' ');
    if (!HARNESS_NOISE.test(msg)) errors.push(msg.slice(0, 600));
  });
  // The game's own randomness, from the seed.
  vi.spyOn(Math, 'random').mockImplementation(mulberry32(gameSeed(seed)));
  vi.spyOn(window, 'confirm').mockImplementation(() => true);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  installMediaStubs();
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const path = String(url?.url ?? url);
    const at = path.indexOf('/facts/');
    if (at !== -1) {
      const body = facts.get(path.slice(at + 7).split(/[?#]/)[0]);
      return body ? new Response(body, { status: 200 }) : new Response('missing', { status: 404 });
    }
    if (isAnimeThemes(path)) return respondAnimeThemes(path);
    // Local play touches no third-party network (root CLAUDE.md). A request
    // here is a bug, and failing the fetch alone would let a caller that
    // swallows errors hide it, so it is recorded as a finding as well.
    offsite.push(`unexpected network request: ${path}`);
    throw new TypeError(`unexpected fetch: ${path}`);
  }));
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'] });

  const user = userEvent.setup({ delay: null, advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
  const adapter = makeAdapter(user, errors, offsite, app);
  try {
    renderArcade(<HubScreen />);
    await adapter.settle();
    return await playGame({ adapter, game, strategy, scenario, rng: makeRng(seed), layer: 'local', debug: DEBUG });
  } finally {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
}

const selected = games.filter((g) => !ONLY_GAME || g.id === ONLY_GAME);

describe.each(selected.map((g) => [g.id, g]))('%s', (id, game) => {
  const strategy = strategies[id];
  it.each(seeds)('seed %i', async (seed) => {
    expect(strategy, `no playtest strategy for ${id}`).toBeTruthy();
    const record = await runOne(game, strategy, seed);
    records.push(record);
    if (record.outcome !== 'pass') {
      const trace = record.trace.slice(-8).map((t) => `  ${t.step}. [${t.screen}] ${t.action}`).join('\n');
      throw new Error(`${record.failure.kind}: ${record.failure.message}\n${trace}\n  repro: ${record.repro}`);
    }
  });
});
