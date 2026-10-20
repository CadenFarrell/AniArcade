// Turns (game, seed) into one scenario: who sits down, which settings, whether
// the run goes through the settings UI, and whether something goes wrong
// partway. A scenario is a function of the seed ALONE — that is what makes
// `--seed 7` a replay rather than a different game with the same number.
//
// Coverage: each axis's values are shuffled once per game, and seeds 1..len
// walk that order, so within the first max(len) seeds every value of every
// option has been played at least once. Past that, each axis draws its value
// from its OWN hash of the seed. A shared walk would march axes of equal
// length in lockstep forever — with three on/off options, the board format
// would only ever be played typed and untimed.
import { makeRng, mulberry32 } from './rng.js';
import { readFileSync } from 'node:fs';

// Read, not imported: vitest would take a JSON import and plain Node (the
// Playwright runner) would demand an import attribute vitest's transform does
// not expect. Every consumer of this file runs in Node, so fs serves both.
// `import.meta.dirname` rather than `new URL(…, import.meta.url)`, for
// smoke/harness.js's reason: under jsdom the global URL is jsdom's own class.
const FIXTURE = JSON.parse(readFileSync(`${import.meta.dirname}/../fixtures/profiles.json`, 'utf8'));

export const FIXTURE_PROFILES = FIXTURE;

const hash = (s) => [...s].reduce((h, ch) => (Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0), 2166136261);

function shuffled(values, seed) {
  const r = mulberry32(seed);
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const at = (values, key, gameId, seed) => {
  const order = shuffled(values, hash(`${gameId}:${key}`));
  return seed >= 1 && seed <= order.length
    ? order[seed - 1]
    // Through mulberry32 rather than `hash % len`: FNV's low bit is just the
    // XOR of its input's low bits, so for any two on/off axes `% 2` came out
    // perfectly correlated — the lockstep this exists to avoid.
    : order[Math.floor(mulberry32(hash(`${gameId}:${key}:${seed}`))() * order.length)];
};

/**
 * strategy.axes:     { prefKey: [values] } — seeded into aniarcade_game_prefs
 * strategy.players:  [min, max]
 * strategy.variants: optional [{ name, ... }] — a strategy-level choice that is
 *                    not a pref (AniRank's format picker, a gating case)
 * strategy.chaos:    which chaos kinds this game supports (default hub+reload)
 */
export function scenarioFor(game, strategy, seed, { layer = 'local' } = {}) {
  const rng = makeRng(hash(`${game.id}#${seed}`));
  const [min, max] = strategy.players;
  const counts = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const players = at(counts, 'players', game.id, seed);

  const prefs = {};
  for (const [key, values] of Object.entries(strategy.axes ?? {})) prefs[key] = at(values, key, game.id, seed);

  const variant = strategy.variants?.length ? at(strategy.variants, 'variant', game.id, seed) : null;

  // The main profile is always the first fixture player (the hub's "main"),
  // the rest are drawn in a seeded order so different players meet.
  const rest = rng.shuffle(FIXTURE.slice(1)).slice(0, players - 1);
  const names = [FIXTURE[0].name, ...rest.map((p) => p.name)];

  const kinds = strategy.chaos ?? ['hub', 'reload'];
  const chaos = layer === 'local' && kinds.length && rng.chance(0.25)
    ? { kind: rng.pick(kinds), at: rng.int(2, 18) }
    : null;

  return {
    seed,
    names,
    prefs: strategy.adjustPrefs ? strategy.adjustPrefs(prefs, { players, variant }) : prefs,
    // A fifth of runs reach the settings through the settings card instead of
    // seeding them, so the controls themselves get pressed.
    uiSettings: rng.chance(0.2),
    variant,
    chaos,
  };
}

// The profiles for a scenario, possibly altered by its variant (an emptied
// list for a gating case), in the stored shape seedProfiles writes.
export function profilesFor(scenario, strategy) {
  const chosen = scenario.names.map((n) => structuredClone(FIXTURE.find((p) => p.name === n)));
  return strategy.profilesFor ? strategy.profilesFor(chosen, scenario) : chosen;
}
