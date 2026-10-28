import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDeadline } from '../../../shared/hooks/useDeadline';
import { buildIndex, judgeName } from '../answers';
import * as rules from '../rules';

// Local persistence for one AniName game: the rules decide, this only holds the
// state. The online twin (useNameRoom) keeps the same handler names, each
// taking the acting player's id, so NameRound never branches on where the
// state lives.
//
// Every player is here on one device, so the "active" roster is the whole
// table and nothing ever needs settling. The clock is Date.now(): there is
// only one to agree with.
export function useNameRound(players, deal, pack) {
  const ids = useMemo(() => players.map((p) => p.id), [players]);
  const [game, setGame] = useState(() => rules.startGame(ids, deal));
  // The answer index is the table's lists plus the pack, built once a game.
  const index = useMemo(() => buildIndex(players, pack), [players, pack]);

  // Rules run inside the updater so two quick taps both see current state.
  const apply = useCallback((fn) => {
    setGame((g) => ({ ...g, ...(fn(g).patch || {}) }));
  }, []);

  // The bar drains on the screen's clock; the round closes on a timer set for
  // the deadline itself, so the close is a callback rather than a state change
  // made during an effect.
  const deadline = game.phase === 'naming' ? game.deadlineAt : null;
  const clock = useDeadline(deadline, { windowMs: game.namingMs });
  useEffect(() => {
    if (deadline == null) return undefined;
    const t = setTimeout(() => {
      apply((g) => rules.stopNaming(g, g.bid?.by, ids, Date.now() + rules.NAME_GRACE_MS));
    }, Math.max(0, deadline - Date.now()));
    return () => clearTimeout(t);
  }, [deadline, apply, ids]);

  return {
    game,
    index,
    clock,
    bid: useCallback((id, n) => apply((g) => rules.placeBid(g, id, n, ids, Date.now())), [apply, ids]),
    pass: useCallback((id) => apply((g) => rules.pass(g, id, ids, Date.now())), [apply, ids]),
    name: useCallback((id, text) => apply((g) => {
      const judged = judgeName(index, rules.currentCategory(g, deal), text);
      return rules.addName(g, id, { ...judged, text }, ids, Date.now());
    }), [apply, index, deal, ids]),
    done: useCallback((id) => apply((g) => rules.stopNaming(g, id, ids, Date.now())), [apply, ids]),
    judge: useCallback((id, i, accept) => apply((g) => rules.judgeAnswer(g, id, i, accept, ids)), [apply, ids]),
    next: useCallback(() => apply((g) => rules.nextRound(g, ids)), [apply, ids]),
  };
}
