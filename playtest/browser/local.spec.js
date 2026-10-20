// Local play in real Chrome, at a phone's size and a laptop's: every game,
// hub tile to results, through the production build — with a screenshot,
// a layout pass and an axe pass on every distinct screen the bots reach.
//
// Pass/fail is the same as the jsdom layer (crashes, console errors, dead
// ends). Layout and accessibility results are FINDINGS in the report, not
// failures, so problems the app already has do not turn every run red.
import { test, expect } from '@playwright/test';
import { GAMES, seedContext, routeNetwork, pageAdapter, auditor, writeRun } from './harness.js';
import { playGame } from '../core/driver.js';
import { scenarioFor, profilesFor } from '../core/scenarios.js';
import { makeRng } from '../core/rng.js';
import { strategies } from '../strategies/index.js';

const ONLY_GAME = process.env.PLAYTEST_GAME || null;
const ONLY_SEED = process.env.PLAYTEST_SEED ? Number(process.env.PLAYTEST_SEED) : null;
const RUNS = Number(process.env.PLAYTEST_BROWSER_RUNS || 2);
const seeds = ONLY_SEED != null ? [ONLY_SEED] : Array.from({ length: RUNS }, (_, i) => i + 1);
// One audit per screen per game per viewport across every seed in this worker.
const seen = new Set();

for (const game of GAMES.filter((g) => !ONLY_GAME || g.id === ONLY_GAME)) {
  for (const seed of seeds) {
    test(`${game.id} seed ${seed}`, async ({ page, context }, info) => {
      const strategy = strategies[game.id];
      expect(strategy, `no playtest strategy for ${game.id}`).toBeTruthy();
      const scenario = scenarioFor(game, strategy, seed);
      const profiles = profilesFor(scenario, strategy);
      const storage = {
        aniguess_profiles: Object.fromEntries(profiles.map((p) => [p.id, p])),
        aniarcade_active_profile: profiles[0].id,
        aniarcade_game_prefs: { [game.id]: scenario.prefs },
      };
      const extra = {};
      strategy.seedStorage?.({ setItem: (k, v) => { extra[k] = JSON.parse(v); } }, scenario, profiles);
      await seedContext(context, { storage: { ...storage, ...extra }, seed });
      const offsite = [];
      await routeNetwork(context, { origin: info.project.use.baseURL, offsite });
      const errors = [];
      const adapter = pageAdapter(page, { errors });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const layer = `browser-${info.project.name}`;
      const record = await playGame({
        adapter, game, strategy, scenario, rng: makeRng(seed), layer, budgetMs: 400_000,
        onScreen: auditor(page, { game: game.id, project: info.project.name, seen }),
      });
      record.repro = `npm run playtest -- --layer browser --game ${game.id} --seed ${seed}`;
      for (const m of offsite) record.findings.push({ kind: 'network', severity: 'warn', message: m });
      for (const m of new Set(adapter.refused)) record.findings.push({ kind: 'click-refused', severity: 'info', message: m });
      writeRun(layer, record);
      const trace = record.trace.slice(-8).map((t) => `  ${t.step}. [${t.screen}] ${t.action}`).join('\n');
      expect(record.outcome, `${record.failure?.kind}: ${record.failure?.message}\n${trace}`).toBe('pass');
    });
  }
}
