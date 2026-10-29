import { useCallback, useState } from 'react';
import { dealRoles } from '../roles';
import { firstDeal, roundDeal } from '../deal';
import * as rules from '../rules';

// Local persistence for one AniDraft game: the rules decide, this only holds
// the state. The online twin (useDraftRoom) keeps the same handler names.
//
// Everyone is on one device, so the "active" roster is the whole table, there
// is no pick clock (`now` stays null), and the device deals every board.
export function useDraftRound(players, settings) {
  const [game, setGame] = useState(() => rules.startGame({
    ids: players.map((p) => p.id),
    rounds: settings.rounds,
    pool: settings.pool,
    pickClock: 0,
    ...firstDeal(players, { pool: settings.pool }),
  }));

  // Rules run inside the updater so two quick taps both see current state. A
  // deal drawn in there may be drawn twice under StrictMode; only one lands.
  const apply = useCallback((fn) => {
    setGame((g) => {
      const { patch } = fn(g);
      return patch && Object.keys(patch).length ? { ...g, ...patch } : g;
    });
  }, []);

  return {
    game,
    pick: useCallback((card, slot) => apply((g) => rules.makePick(g, rules.currentPicker(g), card, slot)), [apply]),
    reshuffle: useCallback(() => apply((g) => rules.reshuffleRoles(g, dealRoles(rules.ROLES_PER_ROUND, Math.random, g.roles))), [apply]),
    // A ballot, and — when it was the last one — the vote's close in the same
    // update, so the reveal follows the last voter without another tap.
    vote: useCallback((voter, choices) => apply((g) => {
      const cast = rules.castBallot(g, voter, choices);
      if (!Object.keys(cast.patch).length) return cast;
      const closed = rules.closeVote({ ...g, ...cast.patch });
      return { patch: { ...cast.patch, ...closed.patch } };
    }), [apply]),
    revealNext: useCallback(() => apply((g) => rules.revealNext(g, g.shown)), [apply]),
    // `players` is fixed for a game: LocalGame remounts the round on a replay.
    next: useCallback(() => apply((g) => rules.nextRound(g, roundDeal(players, g))), [apply, players]),
  };
}
