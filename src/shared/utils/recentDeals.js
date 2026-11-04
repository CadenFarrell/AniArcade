// What each game dealt in its last few games on this device, so the next deal
// can prefer what the table has not just seen. Without it every deal was
// independent, and since every deal also leans toward the characters and shows
// the most players hold, a table playing again got largely the same faces
// (measured on AniTurf: consecutive boards shared about half their faces).
//
// AniQuiz's `aniquiz/recent.js` was the first of these and keeps its own,
// two-tier shape (clue ids for three games, shows for one); this is the plain
// version every other game shares: a list of ids per game, newest first.
//
// Only the device that DEALS remembers — locally the one device, online the
// host's — and nothing reaches room state: a deal only ever needs its own
// device's memory, and a guest's memory would be of games it never dealt.
//
// It is a PREFERENCE, never a filter (`preferFresh`): a pool that dealt before
// still deals, it just reaches the familiar ids last. A small shared list is
// exactly where repeats are loudest and exactly where a filter would leave
// nothing to deal.
//
// localStorage, guarded like hub/howToSeen.js: a browser that throws on storage
// simply has no memory. Not in PRESERVED_KEYS — a crash reset forgetting what
// was dealt is harmless.

export const RECENT_DEALS_KEY = 'aniarcade_recent_deals';
export const RECENT_GAMES = 3;
// A deal of a few hundred categories should not grow storage without bound.
const MAX_IDS_PER_GAME = 200;

const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);

/** A stored map repaired: `{ [gameId]: string[][] }`, newest game first. */
export function cleanMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [game, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const games = list.map(strings).filter((ids) => ids.length).slice(0, RECENT_GAMES);
    if (games.length) out[game] = games;
  }
  return out;
}

/** `map` with `ids` remembered as `gameId`'s newest game. */
export function withDealt(map, gameId, ids) {
  const clean = cleanMap(map);
  const game = [...new Set(strings(ids))].slice(0, MAX_IDS_PER_GAME);
  if (!game.length) return clean;
  return { ...clean, [gameId]: [game, ...(clean[gameId] ?? [])].slice(0, RECENT_GAMES) };
}

/** Every id `gameId` dealt in its last `games` games, as a Set. */
export function recentFrom(map, gameId, games = RECENT_GAMES) {
  return new Set((cleanMap(map)[gameId] ?? []).slice(0, games).flat());
}

/**
 * The pool to draw from: only the items not dealt lately, when at least `need`
 * of them are left; otherwise the whole pool, as before. `keyOf(item)` is the
 * id the deal remembers. A soft preference by construction — it can only ever
 * narrow a pool that would still deal.
 */
export function preferFresh(pool, keyOf, recent, need = 1) {
  if (!recent?.size) return pool;
  const fresh = pool.filter((item) => !recent.has(keyOf(item)));
  return fresh.length >= need ? fresh : pool;
}

function readMap() {
  try {
    return cleanMap(JSON.parse(localStorage.getItem(RECENT_DEALS_KEY) || '{}'));
  } catch {
    return {};
  }
}

/** What `gameId` dealt lately on this device. */
export function readRecentDeals(gameId, games = RECENT_GAMES) {
  return recentFrom(readMap(), gameId, games);
}

/** Remember a game's deal as `gameId`'s newest. */
export function rememberDealt(gameId, ids) {
  try {
    localStorage.setItem(RECENT_DEALS_KEY, JSON.stringify(withDealt(readMap(), gameId, ids)));
  } catch {
    // The next deal just will not know about this one.
  }
}
