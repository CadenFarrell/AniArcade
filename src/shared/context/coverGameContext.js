import { createContext, useContext } from 'react';

// The open game's descriptor, for the page behind every one of its screens:
// Backdrop draws its cover — speed-line burst, screentone slash, kana down the
// edge — in this game's ink. HubScreen provides it around the active game, so
// no screen has to pass its game to Backdrop by hand (there are some forty).
// Outside a game (the hub's own screens, a component mounted alone in a test)
// it is null and Backdrop falls back to the arcade's own cover.
export const CoverGameContext = createContext(null);

export const useCoverGame = () => useContext(CoverGameContext);
