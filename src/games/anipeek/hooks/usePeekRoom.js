import { useCallback, useEffect, useRef } from 'react';
import { ref, runTransaction, set } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import { useRoomCore } from '../../../shared/hooks/useRoomCore';
import { dealGame } from '../deal';
import * as rules from '../rules';

// Per-game, so a saved AniPeek room cannot clobber another game's.
const ROOM_KEY = 'anipeek_online_room';

const initialState = (localProfile) => ({
  view: 'lobby',
  hostId: localProfile.id,
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
  presence: val.presence ?? {},
  players: (val.players ?? []).map((p) => ({
    ...p,
    animeList: (p.animeList ?? []).map((a) => ({ ...a, characters: a.characters ?? [] })),
  })),
  deal: rules.normalizeDeal(val.deal),
  game: rules.normalizeGame(val.game),
});

/**
 * The Firebase twin of usePeekRound.
 *
 * **The answer is in state/deal, a stated concession — AniQuiz's and AniTune's.**
 * Everyone is looking at the same portrait, so there is no device that may hold
 * the name and no device that may not: secrets/ and assignments/ both hide a
 * value from SOME players, and this one is hidden from all of them until the
 * reveal. The image URL itself is the same story — every phone has to load the
 * picture to draw the tiles over it. The screens never show either before the
 * reveal; that is the guarantee, the same one every other game here gives
 * about its own state/.
 *
 * Every handler acts as THIS device's seat and ignores the id PeekRound passes
 * first, so a phone can only ever move for its own player.
 */
export function usePeekRoom() {
  const core = useRoomCore({
    storageKey: ROOM_KEY,
    playersPath: 'players',
    initialState,
    normalizeState,
  });
  const {
    roomCode, myPlayerId, state, isHost, patchState, bestEffort, once, setSyncError,
    roster, rosterRef,
  } = core;

  const deal = state?.deal ?? null;
  const game = state?.game ?? null;

  // Transaction callbacks are created once per action and must not close over
  // a stale render's deal.
  const dealRef = useRef(deal);
  useEffect(() => { dealRef.current = deal; }, [deal]);

  // Every move is one transaction on state/game. An empty patch — a rule's
  // guard tripping, e.g. a second device pressing Next on a round that already
  // moved — aborts rather than rewriting the same value.
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
    const res = dealGame(dealtIn, settings, pack);
    if (res.error) {
      setSyncError(res.error);
      return;
    }
    const db = getFirebaseDb();
    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), false));
    await patchState({
      deal: res.deal,
      game: rules.startGame(dealtIn.map((p) => p.id), res.deal),
      view: 'round',
    });
  }, [isHost, rosterRef, roomCode, patchState, bestEffort, setSyncError]);

  const returnToLobby = useCallback(async () => {
    const db = getFirebaseDb();
    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), true));
    return patchState({ view: 'lobby', deal: null, game: null });
  }, [roomCode, patchState, bestEffort]);

  const me = myPlayerId;
  const bid = useCallback((_, n) =>
    applyGame((g) => rules.placeBid(g, me, n, rosterRef.current.activeIds)), [applyGame, me, rosterRef]);
  const pass = useCallback(() =>
    applyGame((g) => rules.pass(g, me, rosterRef.current.activeIds)), [applyGame, me, rosterRef]);
  const uncover = useCallback((_, tile) => applyGame((g) => rules.uncoverTile(g, me, tile)), [applyGame, me]);
  const hint = useCallback((_, kind) => applyGame((g, d) => rules.takeHint(g, d, me, kind)), [applyGame, me]);
  const nameNow = useCallback(() => applyGame((g) => rules.nameNow(g, me)), [applyGame, me]);
  const answer = useCallback((_, text) =>
    applyGame((g, d) => rules.submitAnswer(g, d, me, text, rosterRef.current.activeIds)), [applyGame, me, rosterRef]);
  // Any device may skip a portrait that did not load on it: the picture is the
  // same URL everywhere, so one phone failing is usually every phone failing,
  // and the rule refuses once a tile is open.
  const skip = useCallback(() =>
    applyGame((g, d) => rules.skipCard(g, d, rosterRef.current.activeIds)), [applyGame, rosterRef]);
  // Anyone may press Next; the second device's transaction aborts on a round
  // that has already moved.
  const next = useCallback(() =>
    applyGame((g) => rules.nextRound(g, rosterRef.current.activeIds)), [applyGame, rosterRef]);

  // --- Departure reconciliation ---
  //
  // useRoomCore has already moved the crown. What is left is what an absence
  // breaks in THIS game: a bid turn waiting on someone who has gone, or a
  // bidder who left mid-peek. settleIfComplete answers both; any device may
  // run it — a transaction that aborts if somebody got there first.
  //
  // The one-shot key names the round, the card and the phase, because the view
  // stays 'round' all game and useRoomCore only re-arms keys on a view change.
  const turnKey = game ? `${game.round}:${game.cardIndex}:${game.phase}:${game.turnId}:${game.bid?.n ?? ''}` : '';
  useEffect(() => {
    if (!roomCode || !state || !myPlayerId || state.view !== 'round' || !game || !deal) return;
    const ids = roster.activeIds;

    if (roster.active.length < rules.MIN_PLAYERS && game.phase !== 'finished') {
      once('end', () => applyGame((g) => rules.endGame(g)));
      return;
    }
    if (game.phase === 'finished') {
      once('finished-results', () => patchState({ view: 'results' }));
      return;
    }
    const { patch } = rules.settleIfComplete(game, ids);
    if (patch && Object.keys(patch).length) {
      once(`settle:${turnKey}:${ids.join(',')}`, () =>
        applyGame((g) => rules.settleIfComplete(g, rosterRef.current.activeIds)));
    }
  }, [roomCode, state, myPlayerId, game, deal, roster, turnKey, once, applyGame, patchState, rosterRef]);

  return {
    ...core,
    view: state?.view,
    deal,
    game,
    startGame, returnToLobby,
    bid, pass, uncover, hint, nameNow, answer, skip, next,
  };
}
