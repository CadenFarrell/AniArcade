import { useCallback, useState } from 'react';
import * as rules from '../rules';

// One device, one game: the local twin of useAniTurfRoom. Both keys and both
// teams' traps live here in memory, because on a single device there is no one
// to hide them from but the people at the table — and the screens do that, by
// showing a key only between a handoff and its "hide".
//
// Every change goes through a functional setState, so two presses in one tick
// (a double-tapped Claim) each see the other's result rather than one render's
// stale game.
export function useAniTurfRound({ board, teams, clueGivers, traps, startTeam }) {
  const [state, setState] = useState(() => {
    let game = rules.startGame({ board, teams, clueGivers, startTeam, traps });
    // With traps off there is nothing to plant, so the game opens on the first
    // clue; the clue-giver meets their key on that screen instead.
    if (!traps) game = { ...game, planted: { red: true, blue: true }, phase: 'clue' };
    return {
      game,
      keys: { red: rules.makeFooting('red'), blue: rules.makeFooting('blue') },
      planted: { red: [], blue: [] }, // traps each team planted against the other
      // A team's latest detour — the squares it added and when — so its
      // clue-giver is told on their next clue screen (ClueTurn).
      detours: { red: null, blue: null },
      last: null, // the latest claim's outcome, for the impact frame
    };
  });

  const update = useCallback((fn) => setState((s) => {
    const patch = fn(s);
    return patch ? { ...s, ...patch } : s;
  }), []);

  const plantTraps = useCallback((team, cells) => update((s) => ({
    planted: { ...s.planted, [team]: cells },
    game: { ...s.game, ...rules.plant(s.game, team).patch },
  })), [update]);

  const giveClue = useCallback((word, number) => update((s) => {
    const team = s.game.turn;
    const { patch } = rules.giveClue(s.game, team, word, number, s.game.clueGivers[team]);
    return Object.keys(patch).length ? { game: { ...s.game, ...patch } } : null;
  }), [update]);

  const claim = useCallback((cell) => update((s) => {
    const team = s.game.turn;
    const footing = s.keys[team].includes(cell);
    const trapped = footing && s.planted[rules.other(team)].includes(cell);
    const { patch, outcome } = rules.resolveClaim(s.game, { cell, footing, trapped });
    if (!outcome) return null;
    let game = { ...s.game, ...patch };
    let { keys, detours } = s;
    // A claim or a miss can cut the other team's route; a trap can take back
    // the claim this team's own route depended on. Either team, then — but only
    // ever one on a single move (see rules.declareCut). A cut team gets a
    // detour if the board still has a way across, and loses if it has none.
    for (const t of rules.TEAMS) {
      if (game.phase === 'over' || rules.routeAlive(keys[t], game.marks, t)) continue;
      const next = rules.rerouteFooting(game, t, keys[t]);
      if (next) {
        detours = { ...detours, [t]: rules.nextDetour(game, t, detours[t], next.filter((i) => !keys[t].includes(i))) };
        keys = { ...keys, [t]: next };
      } else {
        game = { ...game, ...rules.declareCut(game, t).patch };
      }
    }
    return { game, keys, detours, last: { outcome, team, key: game.log.length } };
  }), [update]);

  const stop = useCallback(() => update((s) => {
    const { patch } = rules.stopGuessing(s.game, s.game.turn);
    return Object.keys(patch).length ? { game: { ...s.game, ...patch } } : null;
  }), [update]);

  return { ...state, plantTraps, giveClue, claim, stop };
}
