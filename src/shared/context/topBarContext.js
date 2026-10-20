import { createContext, useContext } from 'react';

// Split from TopBar.jsx for the reason profileContext.js gives — react-refresh's
// only-export-components rule flags a hook exported alongside a component.
//
// The value is the bar's two SLOTS as DOM nodes: `{ left, right }`, each null
// until the bar has mounted. Controls that belong in the bar but are owned deep
// inside a game — HubButton at every game root, the room code and Leave in
// RoomShell — portal themselves into these rather than being lifted up, so the
// game keeps owning its own handlers and the bar never learns what a room is.
export const TopBarContext = createContext(null);

/**
 * The bar's slots, or null when there is no bar at all.
 *
 * Null is a real answer, not an error: a component test that mounts one game
 * screen on its own has no hub around it, and the controls fall back to placing
 * themselves (see HubButton.jsx). Distinguish it from `{ left: null }`, which
 * means a bar exists but has not attached its nodes yet — render nothing for
 * that one frame rather than the fallback, or the control flashes in the corner.
 */
export function useTopBar() {
  return useContext(TopBarContext);
}
