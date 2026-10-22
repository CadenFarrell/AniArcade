// An invite link: the arcade's address plus which game and which room, so a
// host can drop it in a group chat instead of reading five characters aloud.
//
//   https://…/?game=aniturf&join=ABCDE
//
// The game rides along because room codes are app-wide (every game shares
// rooms/{code}) and a room does not record which game it is — the link has to
// say which tile to open. Pure, so the parsing that decides what a stranger's
// URL may do is tested without a DOM.

export const GAME_PARAM = 'game';
export const JOIN_PARAM = 'join';

// useRoomCore's alphabet: no 0/O/1/I. A code outside it cannot name a room, so
// it is refused here rather than sent off to fail a lookup.
const CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;

export function buildInviteUrl(base, gameId, code) {
  const url = new URL('/', base);
  url.searchParams.set(GAME_PARAM, gameId);
  url.searchParams.set(JOIN_PARAM, code);
  return url.toString();
}

// `{ gameId, code }` when the query names a registered game and a well-formed
// code, else null. A link to a game this build does not have (an old link, a
// typo) opens the plain hub rather than a broken screen.
export function readInvite(search, gameIds) {
  const params = new URLSearchParams(search);
  const gameId = params.get(GAME_PARAM);
  const code = (params.get(JOIN_PARAM) ?? '').trim().toUpperCase();
  if (!gameId || !gameIds.includes(gameId) || !CODE_RE.test(code)) return null;
  return { gameId, code };
}

// The same address with the invite taken off, or null when there was none to
// take. The hub reads an invite once and then removes it from the bar, so a
// refresh mid-game does not join the room all over again — and a player who
// left that room is not marched straight back into it.
export function stripInvite(href) {
  const url = new URL(href);
  if (!url.searchParams.has(GAME_PARAM) && !url.searchParams.has(JOIN_PARAM)) return null;
  url.searchParams.delete(GAME_PARAM);
  url.searchParams.delete(JOIN_PARAM);
  return url.toString();
}
