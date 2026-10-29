import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ref, runTransaction, set } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import { useRoomCore } from '../../../shared/hooks/useRoomCore';
import { useDeadline } from '../../../shared/hooks/useDeadline';
import { dealRoles } from '../roles';
import { firstDeal, roundDeal } from '../deal';
import * as rules from '../rules';

// Per-game, so a saved AniDraft room cannot clobber another game's.
const ROOM_KEY = 'anidraft_online_room';

const initialState = (localProfile) => ({
  view: 'lobby',
  hostId: localProfile.id,
  game: null,
  players: [localProfile],
});

// Named fields only, for the reason rules.normalizeGame gives. The roster's
// lists are repaired too: RTDB drops a player's empty animeList, and every
// board after the first is dealt from those copies.
const normalizeState = (val) => ({
  view: val.view,
  hostId: val.hostId ?? null,
  presence: val.presence ?? {},
  players: (val.players ?? []).map((p) => ({
    ...p,
    animeList: (p.animeList ?? []).map((a) => ({ ...a, characters: a.characters ?? [] })),
  })),
  game: rules.normalizeGame(val.game),
});

/**
 * The Firebase twin of useDraftRound.
 *
 * **Nothing is secret, so there is no secrets/ node.** The board, the picks and
 * the teams are the table's; ballots sit in state/game beside them and the
 * screens show only who has voted until the vote closes (rules.js says why that
 * is enough). So any device may deal: the host deals the first board at Start,
 * and whichever phone presses "Next round" deals the next one inside the
 * transaction that opens it, from the stored game (what it has used and
 * drafted), so a second press aborts rather than dealing twice.
 *
 * Every handler acts as THIS device's seat.
 */
export function useDraftRoom() {
  const core = useRoomCore({
    storageKey: ROOM_KEY,
    playersPath: 'players',
    initialState,
    normalizeState,
  });
  const {
    roomCode, myPlayerId, state, isHost, players,
    patchState, bestEffort, once, setSyncError, roster, rosterRef, serverOffsetRef,
  } = core;

  const game = state?.game ?? null;
  const now = useCallback(() => Date.now() + serverOffsetRef.current, [serverOffsetRef]);
  const me = myPlayerId;

  // Every seated player's profile, departed ones included — their lists are
  // still the table's pool. Read through a ref by the next-round transaction,
  // which is created once per press and must not close over a stale render.
  const order = game?.order;
  const seated = useMemo(
    () => (order ? order.map((id) => (players ?? []).find((p) => p.id === id)).filter(Boolean) : []),
    [players, order],
  );
  const seatedRef = useRef(seated);
  useEffect(() => { seatedRef.current = seated; }, [seated]);

  // --- writes ----------------------------------------------------------------

  // Every move is one transaction on state/game, normalized inside the
  // callback (it sees the raw stored value). An empty patch aborts. Returns
  // false on a failed write so a `once` re-arms.
  const applyGame = useCallback((fn) => {
    const db = getFirebaseDb();
    return runTransaction(ref(db, `rooms/${roomCode}/state/game`), (stored) => {
      const g = rules.normalizeGame(stored);
      if (!g) return undefined;
      const { patch } = fn(g);
      if (!patch || Object.keys(patch).length === 0) return undefined;
      return { ...g, ...patch };
    }).catch((e) => {
      setSyncError(e?.message || 'Could not sync with the room — check your connection.');
      return false;
    });
  }, [roomCode, setSyncError]);

  // The host seats the players actually here, in join order, and deals the
  // first round.
  const startGame = useCallback(async (settings) => {
    if (!isHost) return;
    const here = rosterRef.current.active;
    const db = getFirebaseDb();
    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), false));
    await patchState({
      game: rules.startGame({
        ids: here.map((p) => p.id),
        rounds: settings.rounds,
        pool: settings.pool,
        pickClock: settings.pickClock,
        ...firstDeal(here, { pool: settings.pool }),
        now: now(),
      }),
      view: 'round',
    });
  }, [isHost, rosterRef, roomCode, patchState, bestEffort, now]);

  // Back to the lobby, and the room open again.
  const returnToLobby = useCallback(async () => {
    const db = getFirebaseDb();
    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), true));
    return patchState({ view: 'lobby', game: null });
  }, [roomCode, patchState, bestEffort]);

  const pick = useCallback((card, slot) => applyGame((g) => rules.makePick(g, me, card, slot, { now: now() })), [applyGame, me, now]);
  // The host's alone, as the lobby's settings are: two phones shuffling at
  // once would each overwrite the other's roles.
  const reshuffle = useCallback(() => (isHost
    ? applyGame((g) => rules.reshuffleRoles(g, dealRoles(rules.ROLES_PER_ROUND, Math.random, g.roles)))
    : Promise.resolve()), [isHost, applyGame]);
  const vote = useCallback((choices) => applyGame((g) => rules.castBallot(g, me, choices)), [applyGame, me]);
  // Anyone may press these; `from` and the phase make a second press abort.
  const revealNext = useCallback((from) => applyGame((g) => rules.revealNext(g, from)), [applyGame]);
  const next = useCallback(() => applyGame((g) => rules.nextRound(g, { ...roundDeal(seatedRef.current, g), now: now() })), [applyGame, now]);

  // --- the clock -------------------------------------------------------------
  //
  // The pick clock, when the host set one. Its running out is what lets a
  // device pick for the picker, so this re-renders the hook when it does.
  const clock = useDeadline(game ? rules.pickEndsAt(game) : null, {
    offsetMs: core.serverOffset,
    windowMs: game?.pickClock ? game.pickClock * 1000 : null,
  });

  // --- the table's duties ----------------------------------------------------
  //
  // Any device may run these; each is a transaction that re-checks inside, and
  // each one-shot key names what it happens once per — the round and the pick,
  // or the round and who is here — since the view stays 'round' all game and
  // useRoomCore only re-arms one-shots on a view change.
  const active = roster.activeIds;
  const picker = game ? rules.currentPicker(game) : null;
  const picks = game?.picks.length ?? 0;
  useEffect(() => {
    if (!roomCode || !state || !game || state.view !== 'round') return;
    if (game.phase === 'finished') {
      once('finished-results', () => patchState({ view: 'results' }));
      return;
    }
    if (!rules.enoughPlayers(game, active)) {
      once('end', () => applyGame((g) => rules.endGame(g)));
      return;
    }
    if (game.phase === 'draft' && picker) {
      // The picker has gone, or their clock ran out: pick for them, pinned to
      // this pick so two phones doing it at once make one pick between them.
      const gone = !active.includes(picker);
      if (gone || clock.expired) {
        once(`auto:${game.round}:${picks}:${gone ? 'gone' : 'clock'}`, () => applyGame((g) => rules.autoPick(g, {
          now: now(), activeIds: rosterRef.current.activeIds, forPick: picks,
        })));
      }
      return;
    }
    // Every voter here has voted (a voter who left is not waited for).
    if (game.phase === 'vote' && rules.everyoneVoted(game, active)) {
      once(`close:${game.round}:${active.join(',')}`, () => applyGame((g) => rules.closeVote(g, rosterRef.current.activeIds)));
    }
  }, [roomCode, state, game, active, picker, picks, clock.expired, once, applyGame, patchState, rosterRef, now]);

  const byId = new Map(players.map((p) => [p.id, p]));
  // The table in seat order, so a face sits in the same place on every screen.
  const seatedPlayers = game ? game.order.map((id) => byId.get(id)).filter(Boolean) : players;

  return {
    ...core,
    view: state?.view,
    game,
    seatedPlayers,
    clock,
    now,
    startGame, returnToLobby,
    pick, reshuffle, vote, revealNext, next,
  };
}
