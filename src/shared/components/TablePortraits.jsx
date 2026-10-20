import { useMemo } from 'react';
import { TablePortraitsContext } from '../context/tablePortraitsContext';
import { portraitsFor } from '../utils/portrait';

// Shares the table's portraits out once, for everything inside it. `players` is
// the roster in SEAT order — the order the setup screen sat them in — because
// the share-out is first-come: a different order would hand a different face
// to whichever of two players shares a favourite.
//
// Null or empty `players` (still on the setup screen) provides nothing, and the
// consumers fall back to each player's own best.
export default function TablePortraits({ players, children }) {
  const portraits = useMemo(
    () => (players?.length ? portraitsFor(players) : null),
    [players],
  );
  return <TablePortraitsContext.Provider value={portraits}>{children}</TablePortraitsContext.Provider>;
}
