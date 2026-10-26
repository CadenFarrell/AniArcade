import { useCallback, useMemo, useState } from 'react';
import * as rules from '../rules';

// Local persistence for one AniPeek game: the rules decide, this only holds the
// state. The online twin (usePeekRoom) keeps the same handler names, each
// taking the acting player's id, so PeekRound never branches on where the
// state lives.
//
// Every player is here on one device, so the "active" roster is the whole table
// and nothing ever needs settling.
export function usePeekRound(players, deal) {
  const ids = useMemo(() => players.map((p) => p.id), [players]);
  const [game, setGame] = useState(() => rules.startGame(ids, deal));

  // Rules run inside the updater so two quick taps both see current state.
  const apply = useCallback((fn) => {
    setGame((g) => ({ ...g, ...(fn(g).patch || {}) }));
  }, []);

  return {
    game,
    bid: useCallback((id, n) => apply((g) => rules.placeBid(g, id, n, ids)), [apply, ids]),
    pass: useCallback((id) => apply((g) => rules.pass(g, id, ids)), [apply, ids]),
    uncover: useCallback((id, tile) => apply((g) => rules.uncoverTile(g, id, tile)), [apply]),
    hint: useCallback((id, kind) => apply((g) => rules.takeHint(g, deal, id, kind)), [apply, deal]),
    nameNow: useCallback((id) => apply((g) => rules.nameNow(g, id)), [apply]),
    answer: useCallback((id, text) => apply((g) => rules.submitAnswer(g, deal, id, text, ids)), [apply, deal, ids]),
    skip: useCallback(() => apply((g) => rules.skipCard(g, deal, ids)), [apply, deal, ids]),
    next: useCallback(() => apply((g) => rules.nextRound(g, ids)), [apply, ids]),
  };
}
