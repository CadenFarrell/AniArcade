// @vitest-environment jsdom
//
// Online playtest bots: each game played by a table of simulated DEVICES
// through the real online screens — mode picker, create/join, lobby, every
// in-game screen — against the Firebase emulator. `npm run playtest -- --layer
// online`, which starts the emulator around this file.
//
// What it adds over smoke/: those drive the room hooks directly with one
// scripted scenario per game. This drives the screens players actually see,
// with the same strategies the local bots use, random settings and table
// sizes, and now and then a tab closing (host or guest) or a page reloading
// mid-game — and checks every device reaches the end and AGREES on it.
//
// Isolation is smoke/harness.js's trick, applied to a whole app instead of a
// hook: before mounting each device, resetModules and doMock the firebase and
// storage services, so that device's copy of the app has its own anonymous uid
// and its own localStorage (seeded with its own saved profile). Each device
// renders into its own container; React and the testing libraries are shared.
//
// Real time throughout — the emulator is a real server — so a seed replays
// the same table and settings, but not the same interleaving.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFile, readdir } from 'node:fs/promises';
import { goOffline } from 'firebase/database';
import { games } from '../src/hub/registry';
import { firebaseDevice, memStorage, FIREBASE_MODULE, STORAGE_MODULE } from '../smoke/harness.js';
import { snapshotDom } from './core/snapshot.js';
import { playTable } from './core/table.js';
import { scenarioFor, profilesFor } from './core/scenarios.js';
import { makeRng } from './core/rng.js';
import { strategies } from './strategies/index.js';
import { respondAnimeThemes, isAnimeThemes } from './fakes/animethemes.js';
import { installMediaStubs } from './fakes/media.js';
import { writeLayerReport } from './report.js';

const ONLY_GAME = process.env.PLAYTEST_GAME || null;
const ONLY_SEED = process.env.PLAYTEST_SEED ? Number(process.env.PLAYTEST_SEED) : null;
const RUNS = Number(process.env.PLAYTEST_RUNS || 3);
const DEBUG = process.env.PLAYTEST_DEBUG === 'screens' ? 'screens' : Boolean(process.env.PLAYTEST_DEBUG);
const seeds = ONLY_SEED != null ? [ONLY_SEED] : Array.from({ length: RUNS }, (_, i) => i + 1);

const HARNESS_NOISE = /not wrapped in act|testing environment is not configured to support act|overlapping act/i;
// The SDK's own chatter about the emulator connection is not an app bug.
const FIREBASE_NOISE = /@firebase|FIREBASE WARNING|emulator/i;

const facts = new Map();
const records = [];
let realFetch;
let seq = 0;

beforeAll(async () => {
  for (const f of await readdir('public/facts')) facts.set(f, await readFile(`public/facts/${f}`));
  realFetch = globalThis.fetch;
}, 60_000);
afterAll(() => writeLayerReport('online', records, { only: ONLY_GAME, seeds }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

function stubNetwork(offsite) {
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    const path = String(url?.url ?? url);
    const at = path.indexOf('/facts/');
    if (at !== -1) {
      const body = facts.get(path.slice(at + 7).split(/[?#]/)[0]);
      return body ? new Response(body, { status: 200 }) : new Response('missing', { status: 404 });
    }
    if (isAnimeThemes(path)) return respondAnimeThemes(path);
    // The auth emulator is reached over fetch; the database over a socket.
    if (/127\.0\.0\.1:(9099|9000)|localhost:(9099|9000)/.test(path)) return realFetch(url, init);
    offsite.push(`unexpected network request: ${path}`);
    throw new TypeError(`unexpected fetch: ${path}`);
  }));
}

function makeSeat({ game, name, profile, prefs, isHost, user, errors }) {
  const label = `s${++seq}`;
  const fb = firebaseDevice(`${label}-${name}`);
  const storage = memStorage({
    aniguess_profiles: { [profile.id]: profile },
    aniarcade_active_profile: profile.id,
    aniarcade_game_prefs: { [game.id]: prefs },
  });
  const container = document.body.appendChild(document.createElement('div'));
  container.id = label;
  let view = null;

  async function mount() {
    vi.resetModules();
    vi.doMock(FIREBASE_MODULE, () => ({
      firebaseEnabled: true,
      getFirebaseAuth: () => fb.auth,
      getFirebaseDb: () => fb.db,
      ensureSignedIn: fb.ensureSignedIn,
    }));
    vi.doMock(STORAGE_MODULE, () => ({ storage }));
    const [{ games: fresh }, arcade] = await Promise.all([
      import('../src/hub/registry'),
      import('../src/shared/testing/arcade'),
    ]);
    const g = fresh.find((x) => x.id === game.id);
    await g.Component.preload();
    await act(async () => {
      view = arcade.renderArcade(<g.Component onExit={() => {}} />, { container });
    });
  }

  async function settle() {
    let last = '';
    for (let i = 0, stable = 0; i < 12 && stable < 2; i++) {
      await new Promise((r) => setTimeout(r, 40));
      const now = container.innerHTML;
      stable = now === last ? stable + 1 : 0;
      last = now;
    }
  }

  const seat = {
    label, name, isHost,
    adapter: {
      alive: true,
      snapshot: async () => snapshotDom({ root: container, prefix: `${label}-` }),
      errors: () => errors.splice(0),
      async perform(a) {
        if (a.think) await new Promise((r) => setTimeout(r, a.think));
        const node = container.querySelector(`[data-bot-id="${a.click ?? a.fill ?? a.select ?? a.slide}"]`);
        if (a.click && node) await user.click(node);
        else if (a.fill && node) { await user.clear(node); if (a.text) await user.type(node, a.text); }
        else if (a.select && node) await user.selectOptions(node, a.value);
        else if (a.wait) await new Promise((r) => setTimeout(r, Math.min(a.wait, 30_000)));
        await settle();
      },
      async crash() {
        seat.adapter.alive = false;
        goOffline(fb.db);
        view?.unmount();
      },
      async reload() {
        view?.unmount();
        await mount();
        await settle();
      },
      async exitToHub() {},
    },
    mount,
    unmount: () => { try { view?.unmount(); } catch { /* already gone */ } goOffline(fb.db); },
  };
  return seat;
}

async function runOne(game, strategy, seed) {
  const scenario = scenarioFor(game, strategy, seed, { layer: 'online' });
  // A table of two to four: big enough for every readiness gate to mean
  // something, small enough that a grace-window wait is not multiplied by six.
  const [min, max] = strategy.onlinePlayers ?? [Math.max(2, strategy.players[0]), Math.min(4, strategy.players[1])];
  const n = Math.min(max, Math.max(min, scenario.names.length));
  const { FIXTURE_PROFILES } = await import('./core/scenarios.js');
  while (scenario.names.length < n) scenario.names.push(FIXTURE_PROFILES.find((p) => !scenario.names.includes(p.name)).name);
  scenario.names = scenario.names.slice(0, n);
  const rng = makeRng(seed * 7919);
  // A third of runs lose somebody: a guest's tab closes, the host's does, or
  // a page reloads and has to find its way back into the room.
  scenario.chaos = rng.chance(0.34)
    ? { kind: rng.chance(0.7) ? 'crash' : 'reload', who: rng.chance(0.3) ? 'host' : 'guest', at: rng.int(4, 20) }
    : null;
  if (strategy.onlinePrefs) scenario.prefs = strategy.onlinePrefs(scenario.prefs);
  const profiles = profilesFor(scenario, strategy);

  const errors = [];
  const offsite = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    const msg = args.map((a) => (a instanceof Error ? a.stack ?? a.message : String(a))).join(' ');
    if (!HARNESS_NOISE.test(msg) && !FIREBASE_NOISE.test(msg)) errors.push(msg.slice(0, 600));
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockImplementation(() => true);
  installMediaStubs();
  stubNetwork(offsite);
  const user = userEvent.setup({ delay: null });

  const seats = profiles.map((profile, i) => makeSeat({
    game, name: profile.name, profile, prefs: scenario.prefs, isHost: i === 0, user, errors,
  }));
  try {
    for (const s of seats) await s.mount();
    const record = await playTable({ seats, game, strategy, scenario, rng, debug: DEBUG });
    if (offsite.length) record.findings.push(...offsite.map((m) => ({ kind: 'network', severity: 'fail', message: m })));
    return record;
  } finally {
    for (const s of seats) s.unmount();
  }
}

const selected = games.filter((g) => !ONLY_GAME || g.id === ONLY_GAME);

describe.each(selected.map((g) => [g.id, g]))('%s online', (id, game) => {
  const strategy = strategies[id];
  it.each(seeds)('seed %i', async (seed) => {
    expect(strategy, `no playtest strategy for ${id}`).toBeTruthy();
    const record = await runOne(game, strategy, seed);
    records.push(record);
    if (record.outcome !== 'pass') {
      const trace = record.trace.slice(-10).map((t) => `  ${t.step}. [${t.screen}] ${t.action}`).join('\n');
      throw new Error(`${record.failure.kind}: ${record.failure.message}\n${trace}\n${record.lastScreen ?? ''}\n  repro: ${record.repro}`);
    }
  });
});
