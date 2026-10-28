// "Next game, same table": the host picks another game from a room's final
// results, and everyone still in the room is carried into that game's new room
// with no code to share. The whole handoff is one small node in the OLD room,
// `state/next`:
//
//   { gameId, by, byName }          written by the host the moment they pick
//   { gameId, by, byName, code }    `code` added once the new room exists
//
// In state/, not a sibling node: every member already reads and writes state/,
// and nothing in it is hidden from anyone, so no rule had to change. The host
// keeps write access after leaving, because leaving marks presence and never
// removes `memberUids` — which is what lets them write the code in after they
// have already moved on.
//
// Two writes rather than one because only the new game's own hook can build its
// room (initialState is per-game, and the old game's chunk does not have it).
// The host's device leaves, opens the new game, creates the room and writes the
// code back; the other devices wait in the old room until it appears, so the
// room stays alive (the last one out deletes it, and they are not out yet).
//
// The room is read straight off the raw snapshot in useRoomCore, before any
// game's normalizeState, since those rebuild state from named fields and would
// drop it.

const CODE_RE = /^[A-Z0-9]{5}$/;

// The repaired node, or null for anything that is not a usable handoff. A code
// that is present but malformed is dropped rather than followed: a follower
// would only land on "Room codes are 5 letters/numbers".
export function normalizeNext(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { gameId, by, byName, code } = raw;
  if (typeof gameId !== 'string' || !gameId || typeof by !== 'string' || !by) return null;
  return {
    gameId,
    by,
    byName: typeof byName === 'string' ? byName : '',
    code: typeof code === 'string' && CODE_RE.test(code) ? code : null,
  };
}

// The games a host may take the table on to: every available one except the
// game they are finishing (whose own "Back to lobby" already replays it).
export function nextGameChoices(games, currentId) {
  return games.filter((g) => g.available && g.id !== currentId);
}
