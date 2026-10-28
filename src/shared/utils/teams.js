// Two teams, Red and Blue: who is on which, and how a table splits. Lifted out
// of AniTurf's rules.js when AniChain needed the same split — two copies of
// "an unchosen player joins the smaller side" is the kind that drifts.
//
// Pure. A team is a list of player ids in seat order.

export const TEAMS = ['red', 'blue'];
export const TEAM_NAMES = { red: 'Red', blue: 'Blue' };

export const other = (team) => (team === 'red' ? 'blue' : 'red');

/**
 * The teams from the seat order plus whatever each player chose. A player who
 * has not chosen joins the smaller side so far, so a table that never touches
 * the teams card is split evenly in seat order — and adding a player never
 * reshuffles anyone seated before them.
 */
export function splitTeams(ids, chosen = {}) {
  const teams = { red: [], blue: [] };
  for (const id of ids) {
    const pick = chosen?.[id] === 'red' || chosen?.[id] === 'blue'
      ? chosen[id]
      : (teams.red.length <= teams.blue.length ? 'red' : 'blue');
    teams[pick].push(id);
  }
  return teams;
}

/** Which team `id` is on in anything carrying `teams` (a game, a lobby), or null. */
export function teamOf(holder, id) {
  if (holder?.teams?.red?.includes(id)) return 'red';
  if (holder?.teams?.blue?.includes(id)) return 'blue';
  return null;
}

/**
 * Whether a split can start with `min` a side: `{ ok, reason }`, the reason
 * naming the first team short, in the words a StartBar shows.
 */
export function teamsReady(teams, min) {
  for (const team of TEAMS) {
    if ((teams?.[team]?.length ?? 0) < min) {
      return { ok: false, reason: `${TEAM_NAMES[team]} needs ${min} players.` };
    }
  }
  return { ok: true, reason: null };
}
