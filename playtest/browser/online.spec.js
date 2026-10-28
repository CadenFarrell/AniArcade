// Online play in real Chrome: three browser contexts — three devices, three
// anonymous uids — in one room on the Firebase emulator, driven by the same
// table loop as the jsdom online layer. One full game per game, plus one
// game where a guest's tab closes partway through.
//
// Skipped, not failed, when no emulator is listening: run it through
// `npm run playtest -- --layer browser`, or start one with
// `npx firebase emulators:start --only database,auth --project demo-aniguess`.
import { test, expect } from '@playwright/test';
import net from 'node:net';
import { GAMES, seedContext, routeNetwork, pageAdapter, auditor, writeRun } from './harness.js';
import { playTable } from '../core/table.js';
import { scenarioFor, profilesFor, FIXTURE_PROFILES } from '../core/scenarios.js';
import { makeRng } from '../core/rng.js';
import { strategies } from '../strategies/index.js';

const ONLY_GAME = process.env.PLAYTEST_GAME || null;
const seen = new Set();

const emulatorUp = () => new Promise((resolve) => {
  const s = net.connect({ host: '127.0.0.1', port: 9000 });
  s.once('connect', () => { s.destroy(); resolve(true); });
  s.once('error', () => resolve(false));
});

// Next game, same table (src/shared/utils/handoff.js): once AniWave's table
// finishes, its host takes everyone on to AniTag, and every browser has to
// land in AniTag's lobby, seated together, with nobody typing a code. Both
// games need no list, so the chain tests the handoff and nothing else.
const CHAIN = { aniwave: 'anitag' };
const cases = GAMES.filter((g) => !ONLY_GAME || g.id === ONLY_GAME)
  .map((g) => ({ game: g, seed: 1, chaos: null, chainTo: CHAIN[g.id] ?? null }));
// The departure case, on the game whose readiness gates are the most numerous.
if (!ONLY_GAME || ONLY_GAME === 'anifake') {
  cases.push({ game: GAMES.find((g) => g.id === 'anifake'), seed: 2, chaos: { kind: 'crash', who: 'guest', at: 8 } });
}

for (const { game, seed, chaos, chainTo } of cases) {
  const also = [chaos && 'a guest leaves', chainTo && `then on to ${chainTo}`].filter(Boolean).join(', ');
  test(`${game.id} online seed ${seed}${also ? ` (${also})` : ''}`, async ({ browser }, info) => {
    test.skip(!(await emulatorUp()), 'no Firebase emulator on 127.0.0.1:9000');
    const strategy = strategies[game.id];
    const scenario = scenarioFor(game, strategy, seed, { layer: 'online' });
    // Three browsers, unless the game cannot start with three: AniTurf's two
    // teams of two need four (its strategy's `onlinePlayers`).
    const n = Math.max(3, strategy.onlinePlayers?.[0] ?? 0, Math.min(strategy.players[1], 3));
    for (const p of FIXTURE_PROFILES) if (scenario.names.length < n && !scenario.names.includes(p.name)) scenario.names.push(p.name);
    scenario.names = scenario.names.slice(0, n);
    scenario.chaos = chaos;
    if (strategy.onlinePrefs) scenario.prefs = strategy.onlinePrefs(scenario.prefs);
    const profiles = profilesFor(scenario, strategy);
    const origin = info.project.use.baseURL;

    const seats = [];
    for (const [i, profile] of profiles.entries()) {
      const context = await browser.newContext({ viewport: info.project.use.viewport, baseURL: origin });
      await seedContext(context, {
        seed,
        storage: {
          aniguess_profiles: { [profile.id]: profile },
          aniarcade_active_profile: profile.id,
          aniarcade_game_prefs: { [game.id]: scenario.prefs },
        },
      });
      const offsite = [];
      await routeNetwork(context, { origin, offsite, allow: ['127.0.0.1:9000', '127.0.0.1:9099', 'localhost:9000', 'localhost:9099'] });
      const page = await context.newPage();
      const adapter = pageAdapter(page, { errors: [] });
      await page.goto(`/`);
      // Straight into this game: the hub tile path is the local layer's job.
      await page.getByRole('button', { name: /press start/i }).click({ timeout: 5000 }).catch(() => {});
      await page.locator('button', { hasText: game.title }).first().click();
      seats.push({ label: `s${i}`, name: profile.name, isHost: i === 0, adapter, page, offsite });
    }

    const audit = auditor(seats[0].page, { game: game.id, project: 'online', seen });
    const record = await playTable({
      seats, game, strategy, scenario, rng: makeRng(seed), layer: 'browser-online',
      onScreen: (seat, snap, screen, rec) => (seat.isHost ? audit(snap, screen, null, rec) : null),
    });
    record.repro = `npm run playtest -- --layer browser --game ${game.id}`;
    for (const s of seats) for (const m of s.offsite) record.findings.push({ kind: 'network', severity: 'warn', message: m });
    writeRun('browser-online', record);
    try {
      expect(record.outcome, `${record.failure?.kind}: ${record.failure?.message}\n${record.lastScreen ?? ''}`).toBe('pass');
      if (chainTo) {
        const next = GAMES.find((g) => g.id === chainTo);
        await seats[0].page.getByRole('button', { name: `Play ${next.title} next` }).click();
        for (const s of seats) {
          // The lobby's banner, with every player in its roster: the host made
          // the room and each guest joined it by itself.
          await expect(s.page.getByRole('heading', { level: 1, name: next.title })).toBeVisible({ timeout: 30_000 });
          await expect(s.page.getByText('Room code', { exact: true })).toBeVisible({ timeout: 30_000 });
          for (const p of profiles) {
            await expect(s.page.getByText(p.name, { exact: true }).first(), `${s.name} sees ${p.name} seated`)
              .toBeVisible({ timeout: 30_000 });
          }
        }
      }
    } finally {
      for (const s of seats) await s.page.context().close().catch(() => {});
    }
  });
}
