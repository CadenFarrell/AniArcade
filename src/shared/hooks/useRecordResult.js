import { useEffect, useRef } from 'react';
import { useHistoryScope } from '../context/historyScopeContext';
import { storage } from '../services/storage';
import { HISTORY_KEY, addEntries, entriesForGame, normalizeHistory } from '../utils/history';

// Storage only, read fresh on every call, the way useProfile.js is. No provider:
// the one reader is the hub's record strip, which mounts each time the menu
// does, and the menu is never on screen while a game is writing.
export function readHistory() {
  return normalizeHistory(storage.getItem(HISTORY_KEY));
}

function recordGame(args) {
  const lines = entriesForGame({ ...args, at: Date.now() });
  if (!Object.keys(lines).length) return;
  storage.setItem(HISTORY_KEY, addEntries(readHistory(), lines));
}

/**
 * Called once by each game's FINAL results screen — never by a stop between
 * rounds (AniGuess's and AniTag's RoundEnd), which would count one game
 * several times.
 *
 *   game       the registry id
 *   table      the players who sat down ([{ id, name }]), departed included
 *   winnerIds  who won; [] when nobody did; null to record nothing at all (an
 *              AniFake round with no fake has no outcome to keep)
 *   places / scores   optional maps by player id
 *
 * Records on the first render that has a table, once per mount: a results
 * screen re-renders as presence changes, and none of that is a new game. A
 * remount (a refresh, a detour and back) is caught by history.js's
 * duplicate window instead.
 */
export function useRecordResult(game, table, winnerIds, { places, scores } = {}) {
  const scope = useHistoryScope();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || winnerIds == null || !table?.length) return;
    done.current = true;
    const forIds = scope ? [scope.onlyId].filter(Boolean) : table.map((p) => p.id);
    recordGame({
      game,
      table: table.map((p) => ({ id: p.id, name: p.name })),
      winnerIds,
      places: places ?? {},
      scores: scores ?? {},
      forIds,
    });
  });
}
