import { useMemo } from 'react';
import { poolSummary } from '../clues';
import { BOARD } from '../rules';
import { showKeysFor } from '../utils/pool';

// What a pool comes to, and whether it can fill what was asked for. Computed
// here so the setup screen and the lobby gate Start on the same numbers.
export function usePoolReport(pack, players, values) {
  return useMemo(() => {
    if (!pack) return null;
    const keys = showKeysFor(players, values.pool, pack);
    const summary = poolSummary(pack, keys);
    const playable = values.format === BOARD ? summary.playableTopics >= 2 : summary.clues > 0;
    return { ...summary, playable };
  }, [pack, players, values.pool, values.format]);
}
