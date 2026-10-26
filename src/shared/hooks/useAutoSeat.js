import { useCallback } from 'react';
import { useProfileStore } from '../context/profileContext';
import { storage } from '../services/storage';
import { LAST_TABLES_KEY, autoSeat, normalizeLastTables, rememberedIds } from '../utils/autoSeat';
import { readHistory } from './useRecordResult';

/**
 * The couch, seated before anyone taps anything — for the local setup screens
 * of games that need more than one player (see utils/autoSeat.js for who and
 * why).
 *
 *   const { seat, remember } = useAutoSeat('anifake', MIN_PLAYERS);
 *   const [players, setPlayers] = useState(seat);
 *   …on Start: remember(players);
 *
 * `seat` belongs in the useState initializer: it reads storage, so it must run
 * once per mount, and the provider has the profiles synchronously on the first
 * render. `remember` is local Start only — an online lobby's table is whoever
 * joined, not who is on this couch.
 */
export function useAutoSeat(gameId, min) {
  const { profiles, activeId } = useProfileStore();

  const seat = useCallback(() => autoSeat({
    profiles,
    activeId,
    lastTable: normalizeLastTables(storage.getItem(LAST_TABLES_KEY))[gameId] ?? [],
    history: (activeId && readHistory()[activeId]) || [],
    min,
  }), [profiles, activeId, gameId, min]);

  const remember = useCallback((players) => {
    const tables = normalizeLastTables(storage.getItem(LAST_TABLES_KEY));
    storage.setItem(LAST_TABLES_KEY, { ...tables, [gameId]: rememberedIds(players) });
  }, [gameId]);

  return { seat, remember };
}
