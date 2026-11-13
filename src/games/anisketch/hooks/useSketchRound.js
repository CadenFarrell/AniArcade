import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDeadline } from '../../../shared/hooks/useDeadline';
import { readRecentDeals, rememberDealt } from '../../../shared/utils/recentDeals';
import { offerChoices } from '../deal';
import * as rules from '../rules';

// Local persistence for one AniSketch game: the rules decide, this only holds
// the state. The online twin (useSketchRoom) keeps the same handler names.
//
// **The offer lives beside the game, never in it** — `offer` is this hook's
// own state, as `secrets/{drawerId}` is online — and the game learns who was
// drawn only from publishReveal, on the way to the next turn. Every player is
// here, so the active roster is the whole table; the clock is Date.now().
export function useSketchRound(players, settings) {
  const ids = useMemo(() => players.map((p) => p.id), [players]);
  const [game, setGame] = useState(() => rules.startGame({ ids, ...settings }));
  const [offer, setOffer] = useState(() => dealOffer(players, game));

  // Rules run inside the updater so two quick taps both see current state.
  const apply = useCallback((fn) => setGame((g) => ({ ...g, ...(fn(g).patch || {}) })), []);

  // The bar drains on the screen's clock; the turn closes on a timer set for
  // the deadline itself (plus the grace a typed guess gets online).
  const deadline = game.phase === 'drawing' ? game.deadlineAt : null;
  const clock = useDeadline(deadline, { windowMs: game.drawMs });
  useEffect(() => {
    if (deadline == null) return undefined;
    const t = setTimeout(() => {
      apply((g) => rules.timeUp(g, g.deadlineAt + rules.GRACE_MS));
    }, Math.max(0, deadline - Date.now()));
    return () => clearTimeout(t);
  }, [deadline, apply]);

  const card = offer.turn === game.turn ? offer : { choices: [], pick: null };

  return {
    game,
    ids,
    clock,
    choices: card.choices,
    character: card.pick,
    /** The drawer picks (in private); the clock waits for "Start drawing". */
    choose: useCallback((key) => setOffer((o) => ({ ...o, pick: o.choices.find((c) => c.key === key) ?? o.pick })), []),
    start: useCallback(() => apply((g) => {
      const dealt = { ...g, ...rules.markDealt(g, g.deal).patch };
      return { patch: { ...rules.markDealt(g, g.deal).patch, ...rules.startDrawing(dealt, g.drawer, Date.now()).patch } };
    }), [apply]),
    got: useCallback((id) => apply((g) => rules.markGot(g, id, Date.now(), ids)), [apply, ids]),
    giveUp: useCallback(() => apply((g) => rules.giveUp(g, g.drawer)), [apply]),
    // The character goes into the game here, so the log has it; then the next
    // drawer's offer is dealt.
    next: useCallback(() => {
      let g = game;
      if (card.pick) g = { ...g, ...rules.publishReveal(g, g.turn, card.pick).patch };
      g = { ...g, ...rules.nextTurn(g, ids).patch };
      setGame(g);
      if (g.phase === 'choosing') setOffer(dealOffer(players, g));
    }, [game, card.pick, ids, players]),
  };
}

// The drawer's choices for the turn on screen, from the table's lists, never
// a character this game already drew. Remembered as dealt on this device, so
// the next game leans away from them (shared/utils/recentDeals.js).
function dealOffer(players, game) {
  const choices = offerChoices(players, game.drawer, {
    count: game.choices,
    used: rules.usedKeys(game),
    sharedFirst: game.sharedFirst,
    recent: readRecentDeals('anisketch'),
  });
  rememberDealt('anisketch', choices.map((c) => c.key));
  return { turn: game.turn, choices, pick: null };
}
