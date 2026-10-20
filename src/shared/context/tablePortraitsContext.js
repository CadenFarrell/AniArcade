import { createContext, useContext } from 'react';
import { portraitFor } from '../utils/portrait';

// The table's faces, shared out once for the whole roster (portraitsFor: each
// player their best-known character nobody seated before them already wears),
// so a player wears the same face in the turn strip, on the pass-the-device
// panel and on the results screen as their setup slot gave them.
//
// Provided by each game's view-router (shared/components/TablePortraits.jsx)
// around everything past setup. Keyed by player id, so a screen that only holds
// ids and names — AniTag's seat order — still finds the face.
export const TablePortraitsContext = createContext(null);

export function useTablePortraits() {
  return useContext(TablePortraitsContext);
}

/**
 * One player's portrait. From the table's share-out when there is one; else
 * their own best-known character, when the object carries a list; else null,
 * which every consumer draws as the bare panel with their initial.
 */
export function usePlayerPortrait(player) {
  const shared = useContext(TablePortraitsContext);
  if (!player) return null;
  if (shared?.has(player.id)) return shared.get(player.id);
  return Array.isArray(player.animeList) ? portraitFor(player) : null;
}
