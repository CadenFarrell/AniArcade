import { useCallback, useMemo, useState } from 'react';
import * as rules from '../rules';
import { getAxis, isOpinion } from '../axes';

// Local (single-device) persistence for one AniRank round. Mirrors
// src/games/anitune/hooks/useAniTuneRound.js: all the actual game logic lives in
// the pure module, this only decides where the state is kept.
//
// The hot-seat rotation is the one thing that exists only here — online, every
// device places at once. It needs no branch for open rounds: the seat is the
// head of rules.pendingPlacers, which in an open round means "first player who
// has not locked in", so locking in passes the device on by itself.
export function useAniRankRound(players, deck, options = {}) {
  const { subjectId, scoring = true, blind = true, pace = 'card' } = options;
  // A spec, not an id: a built-in's id or a custom prompt's whole definition.
  const axis = getAxis(options.axis);
  const opinion = isOpinion(axis);
  const [state, setState] = useState(
    () => rules.startRound(players, deck, opinion ? subjectId : null, { blind, pace })
  );

  const playerIds = useMemo(() => players.map((p) => p.id), [players]);
  const pending = rules.pendingPlacers(state, playerIds);
  const currentPlacer = players.find((p) => p.id === pending[0]) ?? null;

  // Every open-round mutation funnels through here so each one resolves the hot
  // seat the same way `place` does — from the state being updated, never from a
  // render's closure, which two taps in one tick would share.
  const applyToSeat = useCallback((fn) => {
    setState((s) => {
      const who = rules.pendingPlacers(s, playerIds)[0];
      if (!who) return s;
      return { ...s, ...fn(s, who).patch };
    });
  }, [playerIds]);

  const place = useCallback((slotIndex) => {
    setState((s) => {
      const who = rules.pendingPlacers(s, playerIds)[0];
      if (!who) return s;
      const placed = { ...s, ...rules.placeItem(s, who, slotIndex).patch };
      // Seat pace: each board runs on its own card, and the round ends when
      // every board is full (rules.roundFinished) — no shared cursor to move.
      if (rules.isSeatPace(placed)) return placed;
      // The device passes on until everyone has committed this show; only then
      // is the next one revealed.
      if (!rules.everyonePlaced(placed, playerIds)) return placed;
      return { ...placed, ...rules.advanceCursor(placed).patch };
    });
  }, [playerIds]);

  const placeCard = useCallback((itemId, slotIndex) => (
    applyToSeat((s, who) => rules.placeCard(s, who, itemId, slotIndex))
  ), [applyToSeat]);

  const clearSlot = useCallback((slotIndex) => (
    applyToSeat((s, who) => rules.clearSlot(s, who, slotIndex))
  ), [applyToSeat]);

  const lockIn = useCallback(() => (
    applyToSeat((s, who) => rules.lockIn(s, who))
  ), [applyToSeat]);

  const board = currentPlacer
    ? rules.normalizeBoard(state.boards[currentPlacer.id], deck.length)
    : [];

  return {
    state,
    deck: state.deck,
    // At seat pace each board is on its own card, so the counter is the hot
    // seat's own progress rather than the shared cursor.
    cursor: rules.isSeatPace(state) && currentPlacer
      ? rules.placedCount(state.boards[currentPlacer.id]) : state.cursor,
    open: rules.isOpen(state),
    seatPace: rules.isSeatPace(state),
    item: rules.currentItem(state, currentPlacer?.id ?? null),
    board,
    // The hot seat's unplaced cards. Empty in a blind round, which has no tray.
    tray: currentPlacer ? rules.unplacedCards(state, currentPlacer.id) : [],
    boardFull: board.length > 0 && board.every(Boolean),
    currentPlacer,
    axis,
    // How many of the table are still to place this card — the "3 of 4" line.
    placedThisItem: playerIds.length - pending.length,
    // And who, for the row of faces (RankSeats).
    pendingIds: pending,
    finished: rules.roundFinished(state, playerIds),
    scores: useMemo(
      () => rules.finalScores(state, playerIds, { opinion, scoring }),
      [state, playerIds, opinion, scoring]
    ),
    place, placeCard, clearSlot, lockIn,
  };
}
