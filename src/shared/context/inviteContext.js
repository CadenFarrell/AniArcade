import { createContext, useContext } from 'react';

// The open game's invite, provided by HubScreen around the active game:
//
//   gameId      which game this is — what the lobby's Share button builds a
//               link to (shared/utils/inviteLink.js)
//   code        a room code from the link this page was opened with, still to
//               be joined, or null
//   routed      the cover page (ModePicker) has already sent the player on to
//               the online screen once, so pressing Back to it does not bounce
//               them forward again
//   markRouted  set `routed`
//   consume     the join was attempted: forget the code
//   handoff     { from, create } when this game was opened by a room's "Next
//               game" (shared/utils/handoff.js), else null. `create` is the
//               host's device, which makes the room and writes its code back
//               to `from`; everyone else arrives with `code` set and joins.
//   nextGames   the games a room's results may take the table on to
//   follow      ({ gameId, code?, from?, leave }) => open that game for the
//               handoff, running `leave` (the old room's leaveRoom) on the way
//
// Null when a game is mounted alone (a component test): no Share button, no
// invite, every screen exactly as before.
export const InviteContext = createContext(null);

export const useInvite = () => useContext(InviteContext);
