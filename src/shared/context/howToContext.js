import { createContext, useContext } from 'react';

// Opens the open game's How to play sheet (shared/components/HowToSheet.jsx),
// for the button on its cover page (ModePicker). The top bar's icon was the one
// way back to the rules and was easy to miss; the cover, where a player is
// deciding whether to start, is where a labelled one belongs. HubScreen owns the
// sheet and provides this around the active game, so no <Game>Game.jsx had to
// pass anything; a game mounted alone (a component test) gets null and the
// cover draws no button, as it draws a bare panel with no tile character.
export const HowToContext = createContext(null);

export const useOpenHowTo = () => useContext(HowToContext);
