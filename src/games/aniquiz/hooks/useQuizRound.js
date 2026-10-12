import { useCallback, useMemo, useState } from 'react';
import * as rules from '../rules';

// Local persistence for one AniQuiz game: the rules decide, this only holds the
// state. The online twin (useQuizRoom) keeps the same handler names so the
// screens never branch on where the state lives.
//
// No shared clock here, deliberately — every rule is called with `now = null`.
// On one device the clock belongs to whoever is holding it and starts when they
// take it, which only the screen knows; LocalRound runs it per player and
// submits a blank when it runs out.
export function useQuizRound(players, deal, settings) {
  const ids = useMemo(() => players.map((p) => p.id), [players]);
  const [game, setGame] = useState(() => rules.startGame(ids, deal, settings, null));

  // Rules run inside the updater so two quick taps both see current state.
  const apply = useCallback((fn) => {
    setGame((g) => ({ ...g, ...(fn(g).patch || {}) }));
  }, []);

  return {
    game,
    pick: useCallback((cell) => apply((g) => rules.pickCell(g, deal, g.pickerId, cell, null)), [apply, deal]),
    wager: useCallback(
      (playerId, amount) => apply((g) => rules.placeWager(g, deal, playerId, amount, ids, null)),
      [apply, deal, ids],
    ),
    answer: useCallback(
      (playerId, text) => apply((g) => rules.submitAnswer(g, deal, playerId, text, ids)),
      [apply, deal, ids],
    ),
    next: useCallback(() => apply((g) => rules.advance(g, deal, ids, null)), [apply, deal, ids]),
  };
}
