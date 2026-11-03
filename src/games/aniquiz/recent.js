// What this device dealt in its last few games, so the next deal can prefer
// clues the table has not just seen (clues.js's `tiers`). Without it every
// deal was independent, and a small shared pool asked the same questions
// session after session.
//
// Only the device that DEALS remembers — locally that is the one device,
// online it is the host's — and nothing reaches room state, because only the
// host deals and grading reads only the clue.
//
// Clue ids are kept for RECENT_GAMES games, shows for the last game only. The
// exact repeated question is what feels stale, and ids are plentiful (a show
// can be asked a dozen ways). Shows are not: a 26-clue board on a 20-show
// shared list spends nearly every show, so remembering three games of shows
// would leave the "fresh show" preference nothing to choose from every time.
//
// localStorage, guarded like hub/howToSeen.js: a browser that throws on
// storage simply has no memory. Not in PRESERVED_KEYS — a crash reset
// forgetting which questions were asked is harmless.
import { showOf } from './clues';

export const RECENT_KEY = 'aniquiz_recent';
export const RECENT_GAMES = 3;

const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);

/** A stored list, repaired: newest first, at most RECENT_GAMES, garbage dropped. */
export function cleanList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((g) => g && typeof g === 'object')
    .map((g) => ({ ids: strings(g.ids), shows: strings(g.shows) }))
    .filter((g) => g.ids.length)
    .slice(0, RECENT_GAMES);
}

/** The `recent` a deal takes: every remembered clue id, and the last game's shows. */
export function recentFrom(list) {
  const games = cleanList(list);
  return {
    ids: new Set(games.flatMap((g) => g.ids)),
    shows: new Set(games[0]?.shows ?? []),
  };
}

/** Every clue a deal holds: a board's columns and final, or a quiz's questions. */
export function dealtClues(deal) {
  if (!deal || typeof deal !== 'object') return [];
  return [
    ...(Array.isArray(deal.categories) ? deal.categories.flatMap((c) => c?.clues ?? []) : []),
    ...(deal.final ? [deal.final] : []),
    ...(Array.isArray(deal.questions) ? deal.questions : []),
  ].filter(Boolean);
}

/** `list` with `deal` remembered as the newest game. */
export function withDeal(list, deal) {
  const clues = dealtClues(deal);
  if (!clues.length) return cleanList(list);
  const game = {
    ids: [...new Set(clues.map((c) => c.id).filter(Boolean))],
    shows: [...new Set(clues.map(showOf).filter(Boolean))],
  };
  return cleanList([game, ...cleanList(list)]);
}

function readList() {
  try {
    return cleanList(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function readRecent() {
  return recentFrom(readList());
}

export function rememberDeal(deal) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(withDeal(readList(), deal)));
  } catch {
    // The next deal just will not know about this one.
  }
}
