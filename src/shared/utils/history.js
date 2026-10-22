// Play history: one line per finished game, per profile, kept on this device.
// The pure half — the hook that records (hooks/useRecordResult.js) and the
// hub's record strip (hub/RecordStrip.jsx) are thin over it.
//
// Stored under one arcade-wide key, `{ [profileId]: Entry[] }`, newest last:
//
//   { at, game, won, place, size, score?, with: [names], fp }
//
//   at     ms, this device's clock (it only ever orders one device's games)
//   game   the registry id
//   won    a shared first place counts; a table of one never does (a quiz on
//          your own is "Finished", not "Winner" — see utils/podium.js)
//   place  1-based, or null where the game has no ranking (AniRank unscored)
//   size   how many sat at the table
//   with   everyone else's name, as they were that game — names, not ids, so a
//          line still reads right after that friend's profile is deleted
//   fp     the game's fingerprint, for the duplicate check below
//
// Keyed by PROFILE, not by device user: local play records every seated
// profile, so a friend who plays on your phone builds up their own record.
// Online, each device records only its own player (RoomShell's
// HistoryScopeContext), since the other players' devices record theirs.

export const HISTORY_KEY = 'aniarcade_history';
// Enough for a long season of game nights; old lines go first. A line is
// ~120 bytes, so a full profile is ~25 KB — small beside its anime list.
export const MAX_PER_PROFILE = 200;
// A results screen can mount twice for one game: a refresh on an online results
// screen, AniGuess's detour from its leaderboard into a list and back. The same
// fingerprint within this window is that, not a second game — two real games
// would have to end with identical tables, places and running totals.
export const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;

const isEntry = (e) =>
  e && typeof e === 'object'
  && typeof e.at === 'number' && Number.isFinite(e.at)
  && typeof e.game === 'string' && e.game !== '';

// Repairs whatever is stored. Runs on every read, like normalizeProfile: a
// half-written or hand-edited value must cost one bad line, never the hub.
export function normalizeHistory(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [id, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const entries = list.filter(isEntry).map((e) => ({
      at: e.at,
      game: e.game,
      won: e.won === true,
      place: Number.isInteger(e.place) && e.place > 0 ? e.place : null,
      size: Number.isInteger(e.size) && e.size > 0 ? e.size : 1,
      ...(typeof e.score === 'number' && Number.isFinite(e.score) ? { score: e.score } : {}),
      with: Array.isArray(e.with) ? e.with.filter((n) => typeof n === 'string') : [],
      fp: typeof e.fp === 'string' ? e.fp : '',
    }));
    if (entries.length) out[id] = entries;
  }
  return out;
}

/**
 * The lines one finished game adds: `{ [profileId]: entry }` for each id in
 * `forIds` that sat at the table.
 *
 *   table      [{ id, name }], everyone who played
 *   winnerIds  who won — empty when nobody did (an unscored AniRank round)
 *   places     optional { id: position }; a winner without one is placed 1st
 *   scores     optional { id: number }
 */
export function entriesForGame({ game, table, winnerIds = [], places = {}, scores = {}, forIds, at }) {
  const solo = table.length < 2;
  const fp = fingerprint({ game, table, winnerIds, places, scores });
  const out = {};
  for (const player of table) {
    if (!forIds.includes(player.id)) continue;
    const won = !solo && winnerIds.includes(player.id);
    const place = places[player.id] ?? (won ? 1 : null);
    const score = scores[player.id];
    out[player.id] = {
      at,
      game,
      won,
      place: Number.isInteger(place) && place > 0 ? place : null,
      size: table.length,
      ...(typeof score === 'number' && Number.isFinite(score) ? { score } : {}),
      with: table.filter((p) => p.id !== player.id).map((p) => p.name),
      fp,
    };
  }
  return out;
}

export function fingerprint({ game, table, winnerIds = [], places = {}, scores = {} }) {
  const ids = table.map((p) => p.id).sort();
  return JSON.stringify([
    game, ids, [...winnerIds].sort(),
    ids.map((id) => places[id] ?? null), ids.map((id) => scores[id] ?? null),
  ]);
}

// Adds a game's lines to the stored map, skipping any profile whose latest line
// is the same game seen moments ago (DUPLICATE_WINDOW_MS), and trimming each
// profile to its newest MAX_PER_PROFILE. Returns a new map; never mutates.
export function addEntries(history, entries) {
  const next = { ...history };
  for (const [id, entry] of Object.entries(entries)) {
    const list = next[id] ?? [];
    const last = list[list.length - 1];
    if (last && last.fp === entry.fp && entry.at - last.at < DUPLICATE_WINDOW_MS) continue;
    next[id] = [...list, entry].slice(-MAX_PER_PROFILE);
  }
  return next;
}

/**
 * One profile's record, for the hub strip: totals, a row per game in
 * `gameIds` order (games never played are left out), and the newest `recent`
 * lines, newest first.
 */
export function summarize(entries = [], gameIds = [], recent = 5) {
  const byGame = {};
  for (const e of entries) {
    const g = (byGame[e.game] ??= { played: 0, won: 0 });
    g.played += 1;
    if (e.won) g.won += 1;
  }
  const known = gameIds.filter((id) => byGame[id]);
  return {
    played: entries.length,
    won: entries.filter((e) => e.won).length,
    games: known.map((id) => ({ id, ...byGame[id] })),
    recent: entries.slice(-recent).reverse(),
  };
}

// `{ places, scores }` from a ranked list — computeRankedPlayers' or AniQuiz's
// standings' shape, `{ id, position, total }` — for a results screen to hand
// straight to useRecordResult.
export function fromRanked(ranked = []) {
  return {
    places: Object.fromEntries(ranked.filter((p) => p.position != null).map((p) => [p.id, p.position])),
    scores: Object.fromEntries(ranked.filter((p) => typeof p.total === 'number').map((p) => [p.id, p.total])),
  };
}

// When a game was, as a short label for the record strip: "Today",
// "Yesterday", a weekday within the week, a date before that. Calendar days in
// the viewer's own timezone, not 24-hour spans — a game at 11pm is "Yesterday"
// at breakfast.
export function whenLabel(at, now = Date.now()) {
  const day = (ms) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return new Date(at).toLocaleDateString(undefined, { weekday: 'long' });
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
