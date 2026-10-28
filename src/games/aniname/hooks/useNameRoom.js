import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ref, runTransaction, set } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import { useRoomCore } from '../../../shared/hooks/useRoomCore';
import { useDeadline } from '../../../shared/hooks/useDeadline';
import { buildIndex, judgeName } from '../answers';
import { dealGame } from '../deal';
import * as rules from '../rules';

// Per-game, so a saved AniName room cannot clobber another game's.
const ROOM_KEY = 'aniname_online_room';

const initialState = (localProfile) => ({
  view: 'lobby',
  hostId: localProfile.id,
  deal: null,
  game: null,
  players: [localProfile],
});

// Named fields only, for the reason rules.normalizeGame gives. The roster's
// lists are repaired too: RTDB drops a player's empty animeList, and the
// answer index is built from those copies.
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
 * The Firebase twin of useNameRound.
 *
 * **Nothing here is secret.** Bids are open, the category is everyone's, and
 * the answers appear on every phone as they are typed, so everything lives in
 * state/. The deal carries only categories; the answers a category is graded
 * against are rebuilt on each device from the room's copies of the profiles
 * plus its own fact pack (answers.js), and the NAMER's device grades each
 * name as it is typed. A namer could forge a verdict; the table watches every
 * answer land, which is the same trust every other game here puts in state/.
 *
 * Every handler acts as THIS device's seat and ignores the id NameRound passes
 * first, so a phone can only ever move for its own player.
 */
export function useNameRoom(pack = null) {
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
  const players = state?.players;
  const now = useCallback(() => Date.now() + serverOffsetRef.current, [serverOffsetRef]);

  // Seated players' lists plus this device's pack: what a typed name is graded
  // against. Every device builds the same one (bar a pack mid-deploy).
  const order = game?.order;
  const seated = useMemo(
    () => (order ? (players ?? []).filter((p) => order.includes(p.id)) : []),
    [players, order],
  );
  const index = useMemo(() => buildIndex(seated, pack), [seated, pack]);

  // Transaction callbacks are created once per action and must not close over
  // a stale render's deal or index.
  const dealRef = useRef(deal);
  const indexRef = useRef(index);
  useEffect(() => { dealRef.current = deal; indexRef.current = index; }, [deal, index]);

  // Every move is one transaction on state/game, normalized inside the
  // callback (it sees the raw stored value). An empty patch aborts.
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
  const startGame = useCallback(async (settings, dealPack) => {
    if (!isHost) return;
    const dealtIn = rosterRef.current.active;
    const res = dealGame(dealtIn, settings, dealPack);
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
  const ids = useCallback(() => rosterRef.current.activeIds, [rosterRef]);
  const bid = useCallback((_, n) => applyGame((g) => rules.placeBid(g, me, n, ids(), now())), [applyGame, me, now, ids]);
  const pass = useCallback(() => applyGame((g) => rules.pass(g, me, ids(), now())), [applyGame, me, now, ids]);
  // Graded HERE, before the transaction, against this device's index: the
  // transaction callback may re-run on a conflict, and grading is pure, so the
  // judged entry it appends is the same each time.
  const name = useCallback((_, text) => applyGame((g, d) => {
    const judged = judgeName(indexRef.current, rules.currentCategory(g, d), text);
    return rules.addName(g, me, { ...judged, text }, ids(), now());
  }), [applyGame, me, now, ids]);
  const done = useCallback(() => applyGame((g) => rules.stopNaming(g, me, ids(), now())), [applyGame, me, now, ids]);
  const judge = useCallback((_, i, accept) => applyGame((g) => rules.judgeAnswer(g, me, i, accept, ids())), [applyGame, me, ids]);
  // Anyone may press Next; the second device's transaction aborts.
  const next = useCallback(() => applyGame((g) => rules.nextRound(g, ids())), [applyGame, ids]);

  // --- The clock ---
  //
  // The screen's clock drains to the real deadline; a second one, NAME_GRACE_MS
  // later, closes the round, so a name sent in the last instant lands first.
  // Any device may close it — a transaction that aborts if one already did —
  // so a namer who closed their tab mid-round cannot hold the room.
  const clock = useDeadline(game?.phase === 'naming' ? game.deadlineAt : null, {
    offsetMs: core.serverOffset,
    windowMs: game?.namingMs ?? null,
  });
  const graceClock = useDeadline(
    game?.phase === 'naming' && game.deadlineAt != null ? game.deadlineAt + rules.NAME_GRACE_MS : null,
    { offsetMs: core.serverOffset },
  );
  useEffect(() => {
    if (state?.view !== 'round' || game?.phase !== 'naming' || !graceClock.expired) return;
    once(`expire:${game.round}`, () => applyGame((g) => rules.stopNaming(g, me, ids(), now())));
  }, [graceClock.expired, state?.view, game?.phase, game?.round, once, applyGame, me, now, ids]);

  // --- Departure reconciliation ---
  //
  // useRoomCore has already moved the crown. What an absence breaks here: a
  // bid turn waiting on someone gone, a high bidder gone mid-auction, or the
  // namer gone mid-round. settleIfComplete answers each; any device may run
  // it. The one-shot key names round, phase, turn and bid, because the view
  // stays 'round' all game.
  const turnKey = game ? `${game.round}:${game.phase}:${game.turnId}:${game.bid?.by ?? ''}:${game.bid?.n ?? ''}` : '';
  useEffect(() => {
    if (!roomCode || !state || !myPlayerId || state.view !== 'round' || !game || !deal) return;
    const active = roster.activeIds;

    if (roster.active.length < rules.ONLINE_MIN_PLAYERS && game.phase !== 'finished') {
      once('end', () => applyGame((g) => rules.endGame(g)));
      return;
    }
    if (game.phase === 'finished') {
      once('finished-results', () => patchState({ view: 'results' }));
      return;
    }
    const { patch } = rules.settleIfComplete(game, active);
    if (patch && Object.keys(patch).length) {
      once(`settle:${turnKey}:${active.join(',')}`, () =>
        applyGame((g) => rules.settleIfComplete(g, rosterRef.current.activeIds, now())));
    }
  }, [roomCode, state, myPlayerId, game, deal, roster, turnKey, once, applyGame, patchState, rosterRef, now]);

  return {
    ...core,
    view: state?.view,
    deal,
    game,
    index,
    clock,
    startGame, returnToLobby,
    bid, pass, name, done, judge, next,
  };
}
