// Play history: one line per finished game, per profile, kept on this device.
// The pure half — the hook that records (hooks/useRecordResult.js) and the
// hub's record strip (hub/RecordStrip.jsx) are thin over it.
//
// Stored under one arcade-wide key, `{ [profileId]: Entry[] }`, newest last:
//
//   { at, game, won, place, size, score?, with: [names], others?, fp }
//
//   at     ms, this device's clock (it only ever orders one device's games)
//   game   the registry id
//   won    a shared first place counts; a table of one never does (a quiz on
//          your own is "Finished", not "Winner" — see utils/podium.js)
//   place  1-based, or null where the game has no ranking (AniRank unscored)
//   size   how many sat at the table
//   with   everyone else's name, as they were that game — names, not ids, so a
//          line still reads right after that friend's profile is deleted
//   others everyone else's result, [{ name, place, won }] in `with`'s order —
//          what head-to-head is counted from. Added after the first lines were
//          written, so it is ABSENT on those, and they count as "games
//          together" with no winner between the two of you rather than as a
//          guess at one.
//   fp     the game's fingerprint, for the duplicate check below
//
// Keyed by PROFILE, not by device user: local play records every seated
// profile, so a friend who plays on your phone builds up their own record.
// Online, each device records only its own player (RoomShell's
// HistoryScopeContext), since the other players' devices record theirs.

import { profileIdFromName } from './profileStats.js';

export const HISTORY_KEY = 'aniarcade_history';
// Enough for a long season of game nights; old lines go first. A line is
// ~200 bytes at a table of four (`others` is most of it), so a full profile is
// ~40 KB — small beside its anime list.
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

const cleanPlace = (place) => (Number.isInteger(place) && place > 0 ? place : null);

// A stored `others` is kept only whole: one unreadable row would shift every
// later name against `with`, so a bad array costs the line its head-to-head
// rather than crediting a result to the wrong friend.
function cleanOthers(others) {
  if (!Array.isArray(others)) return null;
  if (!others.every((o) => o && typeof o === 'object' && typeof o.name === 'string')) return null;
  return others.map((o) => ({ name: o.name, place: cleanPlace(o.place), won: o.won === true }));
}

// Repairs whatever is stored. Runs on every read, like normalizeProfile: a
// half-written or hand-edited value must cost one bad line, never the hub.
export function normalizeHistory(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [id, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const entries = list.filter(isEntry).map((e) => {
      const others = cleanOthers(e.others);
      return {
        at: e.at,
        game: e.game,
        won: e.won === true,
        place: cleanPlace(e.place),
        size: Number.isInteger(e.size) && e.size > 0 ? e.size : 1,
        ...(typeof e.score === 'number' && Number.isFinite(e.score) ? { score: e.score } : {}),
        with: Array.isArray(e.with) ? e.with.filter((n) => typeof n === 'string') : [],
        ...(others ? { others } : {}),
        fp: typeof e.fp === 'string' ? e.fp : '',
      };
    });
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
  // Every seat's result, worked out once: each line carries its own as
  // won/place and everybody else's as `others`.
  const result = (p) => {
    const won = !solo && winnerIds.includes(p.id);
    return { won, place: cleanPlace(places[p.id] ?? (won ? 1 : null)) };
  };
  const out = {};
  for (const player of table) {
    if (!forIds.includes(player.id)) continue;
    const rest = table.filter((p) => p.id !== player.id);
    const score = scores[player.id];
    out[player.id] = {
      at,
      game,
      ...result(player),
      size: table.length,
      ...(typeof score === 'number' && Number.isFinite(score) ? { score } : {}),
      with: rest.map((p) => p.name),
      others: rest.map((p) => ({ name: p.name, ...result(p) })),
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

// Who came out ahead between two seats at one table: 1 you, -1 them, 0 a tie,
// null when the game did not rank the two of you against each other.
//
// Places first, where both have one. Without them a win still beats a loss —
// AniFake records a side's win with no places, and the fake who walked did
// beat each crew member. Two losers with no places (crewmates the fake beat,
// an unscored AniRank round nobody won) were never ranked against each other,
// so that is no result rather than a tie: a tie is something you played for.
function compare(me, them) {
  if (me.place != null && them.place != null) return Math.sign(them.place - me.place);
  if (me.won !== them.won) return me.won ? 1 : -1;
  return me.won ? 0 : null;
}

/**
 * One profile's whole record, for the record screen:
 *
 *   played / won   totals
 *   games          a row per game played, in `gameIds` order: played, won, the
 *                  best place and score reached, and when it was last played
 *   rivals         a row per person played with, most games together first:
 *                  { key, name, together, you, them, tied }. Grouped by the
 *                  folded name (a profile id IS one), so a friend met locally
 *                  and online is one row; `name` is the newest spelling.
 *                  you/them/tied count only lines that carry `others` — the
 *                  ones written before it existed are games together and no more.
 *   streak         { current, best } wins in a row, over games a person could
 *                  win: a table of one is never a win, so it neither extends
 *                  nor breaks a streak
 *   log            every line, newest first
 */
export function recordDetail(entries = [], gameIds = []) {
  const byGame = {};
  const rivals = new Map();
  let run = 0;
  let best = 0;

  for (const e of entries) {
    const g = (byGame[e.game] ??= { played: 0, won: 0, bestPlace: null, bestScore: null, lastAt: 0 });
    g.played += 1;
    if (e.won) g.won += 1;
    if (e.place != null && (g.bestPlace == null || e.place < g.bestPlace)) g.bestPlace = e.place;
    if (typeof e.score === 'number' && (g.bestScore == null || e.score > g.bestScore)) g.bestScore = e.score;
    g.lastAt = Math.max(g.lastAt, e.at);

    const rows = e.others ?? e.with.map((name) => ({ name }));
    for (const o of rows) {
      const key = profileIdFromName(o.name);
      if (!key) continue;
      const r = rivals.get(key) ?? { key, name: o.name, together: 0, you: 0, them: 0, tied: 0 };
      r.name = o.name;
      r.together += 1;
      const c = e.others ? compare(e, o) : null;
      if (c === 1) r.you += 1;
      else if (c === -1) r.them += 1;
      else if (c === 0) r.tied += 1;
      rivals.set(key, r);
    }

    if (e.size >= 2) {
      run = e.won ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }

  return {
    played: entries.length,
    won: entries.filter((e) => e.won).length,
    games: gameIds.filter((id) => byGame[id]).map((id) => ({ id, ...byGame[id] })),
    rivals: [...rivals.values()].sort((a, b) => b.together - a.together || a.name.localeCompare(b.name)),
    streak: { current: run, best },
    log: [...entries].reverse(),
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
