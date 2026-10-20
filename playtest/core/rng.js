// Seeded randomness, so a failing run can be replayed exactly.
//
// Two consumers share one seed per run: the BOT's choices (which option, what
// to type, when to quit) come from `makeRng(seed)`, and the GAME's own
// Math.random — every deal, shuffle and draw in rules.js — is replaced by a
// second stream derived from the same seed. Without the second, the bot would
// make the same choices against a different deck each time and a "replay"
// would be a different game.

// mulberry32: tiny, fast, and good enough for picking buttons. Not crypto.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  const rng = {
    seed,
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    pick: (list) => (list.length ? list[Math.floor(next() * list.length)] : undefined),
    shuffle: (list) => {
      const a = [...list];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    word: () => rng.pick(WORDS),
  };
  return rng;
}

// The game's stream is offset from the bot's so the two never move in lockstep.
export const gameSeed = (seed) => (seed ^ 0x9e3779b9) >>> 0;

// Plausible clue words: real enough that a typed-answer screen sees letters,
// spaces and an apostrophe, never so long that typing them slows a run down.
const WORDS = [
  'sword', 'ramen', 'rival', 'school', 'mecha', 'ghost', 'idol', 'train',
  'ocean', 'demon', "hero's", 'spirit', 'moon', 'cafe', 'storm', 'fox',
];
