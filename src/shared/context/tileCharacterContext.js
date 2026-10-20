import { createContext, useContext } from 'react';

// The character standing on the hub tile that was tapped, carried into the
// game so its cover page (ModePicker) shows the same face — the tile reads as
// having opened, not as a new screen. HubScreen provides it around the active
// game; a game mounted alone (a component test) gets null, and the cover draws
// its bare panel, exactly as a tile with no character does.
export const TileCharacterContext = createContext(null);

export const useTileCharacter = () => useContext(TileCharacterContext);
