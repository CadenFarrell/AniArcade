import { profileIdFromName } from './profileStats';
import { computeRankedPlayers } from './ranking';

// Game night: a running table across every game one online table plays, in
// whatever rooms "Next game" (shared/utils/handoff.js) carries it through.
// Settled with Caden (2026-11-16): online only, a point for every player you
// finish above, and the host ends the night. Nothing here reaches the trophy
// page — the night lives and dies with its rooms.
//
// The whole of it is one node in the room, beside `state/next`:
//
//   state/night = {
//     games: [ { game, title, accent, results: [ { name, pts } ] } ],  oldest first
//     counted: true      the latch below: this room's current game is in `games`
//     ended: { by, byName }   the host called it; every device shows the champion
//   }
//
// In state/ for `next`'s reasons: nothing in it is hidden, and every member
// already writes there, so no rule changed. The host's device copies it into
// each new room it makes (`carriedNight`), read from the room the table is
// leaving — which followers hold open until the new code lands.
//
// `results` is a list, never a map keyed by name: a folded name may hold `.`,
// `$`, `/` or `[`, none of which Realtime Database takes in a key. A player is
// the same person from room to room by FOLDED NAME (profileIdFromName), as in
// play history's head-to-head — room player ids are per-room claims, and a
// friend's id on their own phone is not the id their profile has on yours.
//
// Each line carries its game's title and ink, so the recap needs no registry:
// shared code importing the hub's would pull the menu into every game's chunk.
//
// ONE LINE PER GAME. Every device's final results screen reports the same
// game, and that screen can mount twice (a refresh, AniGuess's leaderboard →
// list → back). The outcome cannot be the key: an AniTurf rematch with the
// same teams and the same winner is the same outcome and a second game, and
// two devices that disagreed on one score would each add a line. So the write
// is a transaction that appends unless `counted` is set, and `counted` is
// dropped when the ROOM is back in its lobby (LOBBY_VIEWS) — which every
// replay passes through ("Back to lobby") and a refresh does not.
//
// The lobby, and not "the room's view changed": that was the first version,
// and AniQuiz broke it. Its results screen comes up while the view is still
// 'round' (the game's phase is 'finished') and the view turns to 'results' a
// moment later, so the latch re-armed under a results screen that was still
// up and two slower phones each added the game again — "Tonight · 3 games"
// after one (the online playtest caught it, 2026-11-16). And the room's view,
// never what one device happens to be showing: a device on a loading screen
// would otherwise re-arm the latch the same way.

// The views a room waits in between games: 'lobby' everywhere but AniGuess,
// whose room starts and returns to 'setup'. night.test.js reads every game's
// `returnToLobby` and fails one that goes anywhere else — a game missing from
// this list would silently count one game a room, however many it played.
export const LOBBY_VIEWS = ['lobby', 'setup'];

const cleanPlace = (p) => (typeof p === 'number' && Number.isFinite(p) && p > 0 ? p : null);

/**
 * What one finished game is worth: `[{ name, pts }]` in table order, a point
 * for each player finished above — or null for a game that ranks nobody (a
 * table of one, an unscored AniRank round with no winner and no places).
 *
 * A place is `places[id]`, else 1st for a winner, exactly as history.js's
 * `entriesForGame` reads it; a player with neither is behind everyone placed,
 * level with the other unplaced. So a team game's winners (AniTurf writes 1
 * and 2) each beat every loser, and a tie beats nobody inside it.
 */
export function nightPoints({ table = [], winnerIds = [], places = {} }) {
  if (table.length < 2) return null;
  const placeOf = (p) => cleanPlace(places[p.id]) ?? (winnerIds.includes(p.id) ? 1 : null);
  const placed = table.map((p) => placeOf(p));
  if (placed.every((place) => place == null)) return null;
  const rank = placed.map((place) => place ?? Infinity);
  return table.map((p, i) => ({
    name: p.name,
    pts: rank.filter((other) => other > rank[i]).length,
  }));
}

// A stored list back as a dense array. Realtime Database hands a list back
// whole, with holes, or — once mostly empty — as an object keyed by index;
// map/forEach skip holes, so this is a plain index loop (the same repair as
// anirank/rules.js's normalizeBoard).
function dense(raw) {
  if (!raw || typeof raw !== 'object') return [];
  const out = [];
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) if (raw[i] != null) out.push(raw[i]);
    return out;
  }
  const keys = Object.keys(raw).map(Number).filter(Number.isInteger).sort((a, b) => a - b);
  for (const k of keys) if (raw[k] != null) out.push(raw[k]);
  return out;
}

function cleanLine(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.game !== 'string' || !raw.game) return null;
  const results = dense(raw.results)
    .filter((r) => r && typeof r.name === 'string' && r.name.trim())
    .map((r) => ({ name: r.name, pts: typeof r.pts === 'number' && Number.isFinite(r.pts) && r.pts > 0 ? r.pts : 0 }));
  if (results.length < 2) return null;
  return {
    game: raw.game,
    title: typeof raw.title === 'string' && raw.title ? raw.title : raw.game,
    // Absent rather than null when unknown: this object is written back by the
    // transaction, and the recap falls back to ink for a line with no accent.
    ...(typeof raw.accent === 'string' && raw.accent ? { accent: raw.accent } : {}),
    results,
  };
}

/** The repaired node, or null when there is no night to speak of. */
export function normalizeNight(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const games = dense(raw.games).map(cleanLine).filter(Boolean);
  if (!games.length) return null;
  const ended = raw.ended && typeof raw.ended === 'object' && typeof raw.ended.by === 'string' && raw.ended.by
    ? { by: raw.ended.by, byName: typeof raw.ended.byName === 'string' ? raw.ended.byName : '' }
    : null;
  return { games, counted: raw.counted === true, ended };
}

// The node as Realtime Database may store it: no nulls, no undefined (a write
// carrying `undefined` is refused outright).
function stored(night) {
  return {
    games: night.games,
    ...(night.counted ? { counted: true } : {}),
    ...(night.ended ? { ended: night.ended } : {}),
  };
}

/**
 * The transaction body for a finished game: the node with `line` appended and
 * the latch set, or `undefined` (abort — nothing to write) when this room's
 * game is already counted. `night` is the raw stored value.
 */
export function addNightLine(night, line) {
  const current = normalizeNight(night);
  const clean = cleanLine(line);
  if (!clean || current?.counted) return undefined;
  return stored({
    games: [...(current?.games ?? []), clean],
    counted: true,
    ended: current?.ended ?? null,
  });
}

/** Whether the room is back in its lobby with the last game's latch still set. */
export function nightLatchStale(night, view) {
  return Boolean(night?.counted) && LOBBY_VIEWS.includes(view);
}

/**
 * What the host's device writes into the next room: the games, and nothing of
 * this room's own moment — its latch is about a game played here, and a night
 * carried on is by definition not ended.
 */
export function carriedNight(night) {
  const current = normalizeNight(night);
  return current ? { games: current.games } : null;
}

/** Who took a line: everyone on its top score, or nobody when nobody beat anyone. */
export function lineWinners(line) {
  const top = Math.max(0, ...line.results.map((r) => r.pts));
  return top > 0 ? line.results.filter((r) => r.pts === top).map((r) => r.name) : [];
}

/**
 * The night's table, best first, ties sharing a place (computeRankedPlayers):
 * `[{ id, name, total, played, position }]`, where `id` is the folded name. A
 * player's name is the latest spelling they played under.
 */
export function nightStandings(night) {
  const rows = new Map();
  for (const line of night?.games ?? []) {
    for (const r of line.results) {
      const id = profileIdFromName(r.name);
      const row = rows.get(id) ?? { id, name: r.name, total: 0, played: 0 };
      rows.set(id, { ...row, name: r.name, total: row.total + r.pts, played: row.played + 1 });
    }
  }
  const players = [...rows.values()];
  const totals = Object.fromEntries(players.map((p) => [p.id, p.total]));
  return computeRankedPlayers(players, totals);
}
