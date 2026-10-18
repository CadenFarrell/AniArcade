import { useMemo } from 'react';
import { poolSummary } from '../clues';
import { BOARD } from '../rules';
import { showKeysFor } from '../utils/pool';

// What a pool comes to, and whether it can fill what was asked for. Computed
// here so the setup screen and the lobby gate Start on the same numbers — and
// on the table's topic switches, since a board of switched-off topics is as
// unplayable as a board of no shows.
export function usePoolReport(pack, players, values) {
  return useMemo(() => {
    if (!pack) return null;
    const keys = showKeysFor(players, values.pool, pack);
    const summary = poolSummary(pack, keys, values.topicsOff);
    const playable = values.format === BOARD ? summary.playableTopics >= 2 : summary.clues > 0;
    return { ...summary, playable };
  }, [pack, players, values.pool, values.format, values.topicsOff]);
}
