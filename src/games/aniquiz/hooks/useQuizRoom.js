import { useCallback, useEffect, useRef } from 'react';
import { ref, runTransaction, set } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import { useRoomCore } from '../../../shared/hooks/useRoomCore';
import { useDeadline } from '../../../shared/hooks/useDeadline';
import { buildDeal } from '../deal';
import * as rules from '../rules';

// Per-game, so a saved AniQuiz room cannot clobber another game's.
const ROOM_KEY = 'aniquiz_online_room';

const initialState = (localProfile) => ({
  view: 'lobby',
  hostId: localProfile.id,
  settings: null,
  deal: null,
  game: null,
  players: [localProfile],
});

// Named fields only, for the reason rules.normalizeGame gives. The roster's
// lists are repaired too: RTDB drops a player's empty animeList, and the pool
// is computed from those copies.
const normalizeState = (val) => ({
  view: val.view,
  hostId: val.hostId ?? null,
  settings: val.settings ?? null,
  presence: val.presence ?? {},
  players: (val.players ?? []).map((p) => ({
    ...p,
    animeList: (p.animeList ?? []).map((a) => ({ ...a, characters: a.characters ?? [] })),
  })),
  deal: rules.normalizeDeal(val.deal),
  game: rules.normalizeGame(val.game),
});

/**
 * The Firebase twin of useQuizRound.
 *
 * **The answer key is in state/, and that is a stated concession rather than
 * an oversight.** Every clue carries its `accept` list and the deal names the
 * Daily Double, so a member reading raw RTDB could see both. AniTune's round
 * has the same property and for the same structural reason: everyone answers
 * the same clue, so there is no device that may hold the key and no device that
 * may not — secrets/ and assignments/ both describe a value hidden from SOME
 * players, and this is a value hidden from all of them until the reveal. Moving
 * it off-room means a grader nobody can see, which is a server. The screens
 * never render an answer before its reveal; that is the guarantee, and it is
 * the same one every other game here gives about its own state/.
 *
 * Grading happens in the transaction, from the clue in the deal, so it needs no
 * pack. Only the host's device deals, so only the host needs the pack loaded to
 * start — a guest whose pack failed still plays, minus typed-answer hints.
 */
export function useQuizRoom() {
  const core = useRoomCore({
    storageKey: ROOM_KEY,
    playersPath: 'players',
    initialState,
    normalizeState,
  });
  const {
    roomCode, myPlayerId, state, isHost, patchState, bestEffort, once, setSyncError,
    roster, rosterRef, serverOffsetRef,
  } = core;

  const deal = state?.deal ?? null;
  const game = state?.game ?? null;

  // The deal never changes mid-game, but transaction callbacks are created
  // once per action and must not close over a stale render's copy.
  const dealRef = useRef(deal);
  useEffect(() => { dealRef.current = deal; }, [deal]);

  const now = useCallback(() => Date.now() + serverOffsetRef.current, [serverOffsetRef]);

  // Every action is one transaction on state/game, so two devices answering in
  // the same instant cannot lose each other's write. An empty patch — a rule's
  // guard tripping — aborts rather than rewriting the same value.
  const applyGame = useCallback((fn) => {
    const db = getFirebaseDb();
    return runTransaction(ref(db, `rooms/${roomCode}/state/game`), (raw) => {
      const g = rules.normalizeGame(raw);
      if (!g || !dealRef.current) return undefined;
      const { patch } = fn(g, dealRef.current);
      if (!patch || Object.keys(patch).length === 0) return undefined;
      return { ...g, ...patch };
    }).catch((e) => {
      setSyncError(e?.message || 'Could not sync with the room — check your connection.');
    });
  }, [roomCode, setSyncError]);

  // The host deals from the players actually here, then publishes the deal and
  // the opening game in one patch, so no device ever sees a game with no deal.
  const startGame = useCallback(async (settings, pack) => {
    if (!isHost) return;
    const dealtIn = rosterRef.current.active;
    const res = buildDeal(pack, dealtIn, settings);
    if (res.error) {
      setSyncError(res.error);
      return;
    }
    const db = getFirebaseDb();
    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), false));
    await patchState({
      settings,
      deal: res.deal,
      game: rules.startGame(dealtIn.map((p) => p.id), res.deal, settings, now()),
      view: 'round',
    });
  }, [isHost, rosterRef, roomCode, patchState, bestEffort, setSyncError, now]);

  const returnToLobby = useCallback(async () => {
    const db = getFirebaseDb();
    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), true));
    return patchState({ view: 'lobby', deal: null, game: null });
  }, [roomCode, patchState, bestEffort]);

  const pick = useCallback((cell) =>
    applyGame((g, d) => rules.pickCell(g, d, myPlayerId, cell, now())), [applyGame, myPlayerId, now]);
  const wager = useCallback((amount) =>
    applyGame((g, d) => rules.placeWager(g, d, myPlayerId, amount, rosterRef.current.activeIds, now())),
  [applyGame, myPlayerId, now, rosterRef]);
  const answer = useCallback((text) =>
    applyGame((g, d) => rules.submitAnswer(g, d, myPlayerId, text, rosterRef.current.activeIds)),
  [applyGame, myPlayerId, rosterRef]);
  const revealNow = useCallback(() => applyGame((g, d) => rules.revealNow(g, d)), [applyGame]);
  // Anyone may press Next; advance only moves a revealed clue, so the second
  // device's transaction aborts on a game that has already moved.
  const next = useCallback(() =>
    applyGame((g, d) => rules.advance(g, d, rosterRef.current.activeIds, now())), [applyGame, now, rosterRef]);

  // --- The clock ---
  //
  // Two clocks, AniWave's arrangement: the one the screen draws drains to the
  // real deadline, because that is the number the table was promised, and a
  // second one offset by REVEAL_GRACE_MS gates the reveal, so answers sent in
  // the last instant land before the round closes on them.
  const clock = useDeadline(game?.deadlineAt ?? null, {
    offsetMs: core.serverOffset,
    windowMs: game?.answerMs ?? null,
  });
  const graceClock = useDeadline(
    game?.deadlineAt != null ? game.deadlineAt + rules.REVEAL_GRACE_MS : null,
    { offsetMs: core.serverOffset },
  );

  // The key names the clue, not just the view: the view stays 'round' all game,
  // so a key without the clue in it would fire once and never again.
  const clueKey = game ? `${game.round}:${game.cell ?? game.index}` : '';

  useEffect(() => {
    if (state?.view !== 'round' || !game || game.phase !== 'answering' || !graceClock.expired) return;
    once(`expire:${clueKey}`, () => applyGame((g, d) => rules.expireClue(g, d, rosterRef.current.activeIds)));
  }, [graceClock.expired, state?.view, game, clueKey, once, applyGame, rosterRef]);

  // --- Departure reconciliation ---
  //
  // useRoomCore has already moved the crown. What is left is what an absence
  // breaks in THIS game: a picker the board is waiting on, a Daily Double whose
  // finder left, a wager or an answer the room is waiting on from someone who
  // will never send it. settleIfComplete answers all of them, and any device
  // may run it — it is a transaction that aborts if somebody got there first.
  useEffect(() => {
    if (!roomCode || !state || !myPlayerId || state.view !== 'round' || !game || !deal) return;
    const ids = roster.activeIds;

    if (roster.active.length < 2 && game.phase !== 'finished') {
      once('end', () => applyGame((g) => rules.endGame(g)));
      return;
    }

    if (game.phase === 'finished') {
      once('finished-results', () => patchState({ view: 'results' }));
      return;
    }

    const { patch } = rules.settleIfComplete(game, deal, ids, null);
    if (patch && Object.keys(patch).length) {
      once(`settle:${game.phase}:${clueKey}:${ids.join(',')}`, () =>
        applyGame((g, d) => rules.settleIfComplete(g, d, rosterRef.current.activeIds, now())));
    }
  }, [roomCode, state, myPlayerId, game, deal, roster, clueKey, once, applyGame, patchState, rosterRef, now]);

  return {
    ...core,
    view: state?.view,
    settings: state?.settings ?? null,
    deal,
    game,
    clock,
    startGame, returnToLobby,
    pick, wager, answer, revealNow, next,
  };
}
