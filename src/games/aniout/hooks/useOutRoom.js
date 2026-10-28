import { useCallback, useEffect, useRef } from 'react';
import { ref, runTransaction, set } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import { useRoomCore } from '../../../shared/hooks/useRoomCore';
import { dealGame } from '../deal';
import * as rules from '../rules';

// Per-game, so a saved AniOut room cannot clobber another game's.
const ROOM_KEY = 'aniout_online_room';

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
 * The Firebase twin of useOutRound.
 *
 * **The answer and the picks are in state/, a stated concession** — AniQuiz's
 * and AniPeek's. Everyone looks at the same cards, so there is no device that
 * may hold the odd one and none that may not: secrets/ and assignments/ both
 * hide a value from SOME players, and this one is hidden from all of them until
 * the reveal. A pick is the same story — a secrets/ node would hide it from the
 * table, but the deal it is graded against already sits in state/, so a player
 * reading the database could read the answer itself. The screens never show
 * either before the reveal; that is the guarantee, the same one every other
 * game here gives about its own state/.
 *
 * Every handler acts as THIS device's seat and ignores the id OutRound passes
 * first, so a phone can only ever move for its own player.
 */
export function useOutRoom() {
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

  // Every move is one transaction on state/game, normalized inside the
  // callback (it sees the raw stored value). An empty patch — a rule's guard
  // tripping, e.g. a second device pressing Next on a round that already moved —
  // aborts rather than rewriting the same value.
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
  const pick = useCallback((_, choice) =>
    applyGame((g, d) => rules.submitPick(g, d, me, choice, rosterRef.current.activeIds)), [applyGame, me, rosterRef]);
  // Anyone may press Next; the second device's transaction aborts on a round
  // that has already moved.
  const next = useCallback(() => applyGame((g) => rules.nextRound(g)), [applyGame]);

  // --- Departure reconciliation ---
  //
  // useRoomCore has already moved the crown. What an absence breaks in THIS
  // game is the pick gate: the last player everyone was waiting on may be the
  // one who left. settleIfComplete answers that; any device may run it — a
  // transaction that aborts if somebody got there first.
  //
  // The one-shot key names the round and the phase, because the view stays
  // 'round' all game and useRoomCore only re-arms keys on a view change.
  const turnKey = game ? `${game.round}:${game.phase}` : '';
  useEffect(() => {
    if (!roomCode || !state || !myPlayerId || state.view !== 'round' || !game || !deal) return;
    const ids = roster.activeIds;

    if (roster.active.length < rules.ONLINE_MIN_PLAYERS && game.phase !== 'finished') {
      once('end', () => applyGame((g) => rules.endGame(g)));
      return;
    }
    if (game.phase === 'finished') {
      once('finished-results', () => patchState({ view: 'results' }));
      return;
    }
    const { patch } = rules.settleIfComplete(game, deal, ids);
    if (patch && Object.keys(patch).length) {
      once(`settle:${turnKey}:${ids.join(',')}`, () =>
        applyGame((g, d) => rules.settleIfComplete(g, d, rosterRef.current.activeIds)));
    }
  }, [roomCode, state, myPlayerId, game, deal, roster, turnKey, once, applyGame, patchState, rosterRef]);

  return {
    ...core,
    view: state?.view,
    deal,
    game,
    startGame, returnToLobby,
    pick, next,
  };
}
