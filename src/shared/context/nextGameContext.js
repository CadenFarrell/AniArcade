import { createContext, useContext } from 'react';

// The "Next game" panel for a room's FINAL results (shared/utils/handoff.js),
// as a rendered node. RoomShell provides it when a game's router marks the
// screen with `nextGame`, and ResultsLayout draws it under the game's own
// recap, inside the page's column — so no game's results component had to
// learn it exists, and the between-rounds screens that share ResultsLayout
// (AniGuess's RoundEnd, AniTag's round end) never show it. Null otherwise.
export const NextGameSlotContext = createContext(null);

export const useNextGameSlot = () => useContext(NextGameSlotContext);
