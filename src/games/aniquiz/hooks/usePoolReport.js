import { useMemo } from 'react';
import { poolSummary } from '../clues';
import { BOARD, TYPED } from '../rules';
import { showKeysFor } from '../utils/pool';
import { portraitsFrom } from '../utils/portraits';

// What a pool comes to, and whether it can fill what was asked for. Computed
// here so the setup screen and the lobby gate Start on the same numbers — and
// on the table's topic switches and answer style, since a board of
// switched-off (or, typed, choice-only) topics is as unplayable as a board of
// no shows. The portraits are the players' own, as the deal reads them.
export function usePoolReport(pack, players, values) {
  return useMemo(() => {
    if (!pack) return null;
    const keys = showKeysFor(players, values.pool, pack);
    const summary = poolSummary(pack, keys, values.topicsOff, {
      choices: values.answerStyle !== TYPED,
      portraits: portraitsFrom(players),
    });
    const playable = values.format === BOARD ? summary.playableTopics >= 2 : summary.clues > 0;
    return { ...summary, playable };
  }, [pack, players, values.pool, values.format, values.topicsOff, values.answerStyle]);
}
