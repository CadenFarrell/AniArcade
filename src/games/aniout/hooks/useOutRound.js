import { useCallback, useMemo, useState } from 'react';
import * as rules from '../rules';

// Local persistence for one AniOut game: the rules decide, this only holds the
// state. The online twin (useOutRoom) keeps the same handler names, each
// taking the acting player's id, so OutRound never branches on where the state
// lives.
//
// Every player is here on one device, so the "active" roster is the whole table
// and nothing ever needs settling.
export function useOutRound(players, deal) {
  const ids = useMemo(() => players.map((p) => p.id), [players]);
  const [game, setGame] = useState(() => rules.startGame(ids, deal));

  // Rules run inside the updater so two quick taps both see current state.
  const apply = useCallback((fn) => {
    setGame((g) => ({ ...g, ...(fn(g).patch || {}) }));
  }, []);

  return {
    game,
    ids,
    pick: useCallback((id, choice) => apply((g) => rules.submitPick(g, deal, id, choice, ids)), [apply, deal, ids]),
    next: useCallback(() => apply((g) => rules.nextRound(g)), [apply]),
  };
}
