import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onValue, ref, remove, runTransaction, set } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import { useRoomCore } from '../../../shared/hooks/useRoomCore';
import { useDeadline } from '../../../shared/hooks/useDeadline';
import { readRecentDeals, rememberDealt } from '../../../shared/utils/recentDeals';
import { isRightGuess, nameIndex, offerChoices } from '../deal';
import * as rules from '../rules';
import { useRoomSketch } from './useSketch';

// Per-game, so a saved AniSketch room cannot clobber another game's.
const ROOM_KEY = 'anisketch_online_room';

const initialState = (localProfile) => ({
  view: 'lobby',
  hostId: localProfile.id,
  game: null,
  // Stamps every offer dealt into secrets/ (and names every turn's sketch
  // node), so last game's — never cleared — cannot pass for this game's.
  gameNo: 0,
  players: [localProfile],
});

// Named fields only, for the reason rules.normalizeGame gives. The roster's
// lists are repaired too: RTDB drops a player's empty animeList, and the
// offer and the judge's name index are built from those copies.
const normalizeState = (val) => ({
  view: val.view,
  hostId: val.hostId ?? null,
  presence: val.presence ?? {},
  gameNo: val.gameNo ?? 0,
  players: (val.players ?? []).map((p) => ({
    ...p,
    animeList: (p.animeList ?? []).map((a) => ({ ...a, characters: a.characters ?? [] })),
  })),
  game: rules.normalizeGame(val.game),
});

const choiceList = (raw) => rules.listOf(raw).map(rules.normalizeCharacter).filter(Boolean);

/**
 * The Firebase twin of useSketchRound.
 *
 * **The offer and the pick are the one secret, and only the drawer may hold
 * them**, so they go in `secrets/{drawerId}` (owner-read), dealt by the
 * drawer's OWN device: no other phone, the host's included, ever draws or
 * holds them (AniTurf's and AniChain's rule). Each offer is stamped with the
 * game, the turn and the deal number and shows only when all three match.
 *
 * The cost, as in AniChain, is that only the drawer's device can answer for
 * the character: it judges every typed guess against its own pick
 * (settleGuesses), publishes who it was once the turn is over, and a turn
 * whose drawer leaves is void — nobody else can say who it was.
 *
 * **The drawing is its own node, `sketch/{gameNo}-{turn}`** (useRoomSketch,
 * sketch.js): everyone reads it, the drawer writes it, and the next drawer's
 * device deletes the turn before so a room never carries more than one
 * finished drawing.
 *
 * Every handler acts as THIS device's seat.
 */
export function useSketchRoom() {
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
  const gameNo = state?.gameNo ?? 0;
  const now = useCallback(() => Date.now() + serverOffsetRef.current, [serverOffsetRef]);
  const me = myPlayerId;
  const turn = game?.turn ?? 0;
  const amDrawer = Boolean(game && game.drawer === me);

  const order = game?.order;
  const seated = useMemo(
    () => (order ? (players ?? []).filter((p) => order.includes(p.id)) : []),
    [players, order],
  );
  const names = useMemo(() => nameIndex(seated), [seated]);

  // --- my offer ----------------------------------------------------------------
  //
  // secrets/ is a sibling of state/, so useRoomCore's subscription never sees
  // it. `loaded` matters because the drawer's device WRITES when it finds no
  // offer, and acting on the empty value before the first snapshot would deal
  // over the real one on every refresh (AniTurf's guard).
  const [secret, setSecret] = useState({ loaded: false, value: null });
  useEffect(() => {
    if (!roomCode || !me) return undefined;
    const unsub = onValue(
      ref(getFirebaseDb(), `rooms/${roomCode}/secrets/${me}`),
      (snap) => setSecret({ loaded: true, value: snap.val() ?? null }),
      () => setSecret({ loaded: true, value: null }),
    );
    return () => { unsub(); setSecret({ loaded: false, value: null }); };
  }, [roomCode, me]);

  const raw = secret.value;
  const mine = Boolean(amDrawer && raw && game && raw.forGame === gameNo && raw.forTurn === turn && raw.deal === game.deal);
  const choices = useMemo(() => (mine ? choiceList(raw.choices) : []), [mine, raw]);
  const character = useMemo(() => (mine ? choices.find((c) => c.key === raw.pick) ?? null : null), [mine, choices, raw]);

  // Transaction callbacks are created once per action and must not close over
  // a stale render's pick or names.
  const characterRef = useRef(character);
  const namesRef = useRef(names);
  useEffect(() => { characterRef.current = character; namesRef.current = names; }, [character, names]);

  // --- writes --------------------------------------------------------------------

  // Every move is one transaction on state/game, normalized inside the
  // callback (it sees the raw stored value). An empty patch aborts. Returns
  // false on a failed write so a `once` re-arms.
  const applyGame = useCallback((fn) => runTransaction(ref(getFirebaseDb(), `rooms/${roomCode}/state/game`), (stored) => {
    const g = rules.normalizeGame(stored);
    if (!g) return undefined;
    const { patch } = fn(g);
    if (!patch || Object.keys(patch).length === 0) return undefined;
    return { ...g, ...patch };
  }).catch((e) => {
    setSyncError(e?.message || 'Could not sync with the room — check your connection.');
    return false;
  }), [roomCode, setSyncError]);

  // The host seats the players actually here, in join order. The first offer
  // is the first drawer's device's to deal (below).
  const startGame = useCallback(async (settings) => {
    if (!isHost) return;
    const ids = rosterRef.current.active.map((p) => p.id);
    await bestEffort(set(ref(getFirebaseDb(), `rooms/${roomCode}/open`), false));
    await patchState({
      gameNo: gameNo + 1,
      game: rules.startGame({ ids, ...settings }),
      view: 'round',
    });
  }, [isHost, rosterRef, roomCode, gameNo, patchState, bestEffort]);

  const returnToLobby = useCallback(async () => {
    await bestEffort(set(ref(getFirebaseDb(), `rooms/${roomCode}/open`), true));
    return patchState({ view: 'lobby', game: null });
  }, [roomCode, patchState, bestEffort]);

  /** The drawer picks one: into my own secret first, then the clock starts. */
  const choose = useCallback(async (key) => {
    if (!mine || !choices.some((c) => c.key === key)) return;
    const stored = await set(ref(getFirebaseDb(), `rooms/${roomCode}/secrets/${me}/pick`), key)
      .then(() => true)
      .catch((e) => { setSyncError(e?.message || 'Could not save your pick — check your connection.'); return false; });
    if (stored) await applyGame((g) => rules.startDrawing(g, me, now()));
  }, [mine, choices, roomCode, me, applyGame, now, setSyncError]);

  const guess = useCallback((text) => applyGame((g) => rules.guess(g, me, text, { now: now() })), [applyGame, me, now]);
  const giveUp = useCallback(() => applyGame((g) => rules.giveUp(g, me)), [applyGame, me]);
  // Anyone may press Next; the second device's transaction aborts.
  const next = useCallback(() => applyGame((g) => rules.nextTurn(g, rosterRef.current.activeIds)), [applyGame, rosterRef]);

  // --- the drawing ---------------------------------------------------------------
  const turnKey = game ? `${gameNo}-${turn}` : null;
  const sketch = useRoomSketch(roomCode, turnKey, amDrawer && game?.phase === 'drawing', setSyncError);

  // --- the clock -----------------------------------------------------------------
  //
  // The screen's bar drains to the deadline; the turn closes GRACE_MS after
  // it, so this one re-renders the hook when THAT passes.
  const clock = useDeadline(game?.phase === 'drawing' ? game.deadlineAt : null, {
    offsetMs: core.serverOffset,
    windowMs: game?.drawMs,
  });
  const closing = useDeadline(game?.phase === 'drawing' ? game.deadlineAt + rules.GRACE_MS : null, { offsetMs: core.serverOffset });

  // --- my drawer duties ----------------------------------------------------------
  //
  // Each a one-shot keyed on what it is once PER — the game, the turn and the
  // deal; the guesses waiting — since the view stays 'round' all game and
  // useRoomCore only re-arms one-shots on a view change.
  const active = roster.activeIds;
  const pendingKey = game ? game.guesses.filter((g) => g.verdict === 'pending').map((g) => g.n).join(',') : '';
  useEffect(() => {
    if (!roomCode || !game || state?.view !== 'round' || !amDrawer) return;

    // Deal: draw my choices, write them into my own node, then say so.
    if (game.phase === 'choosing' && !game.dealt) {
      if (!secret.loaded) return;
      if (mine) {
        // Dealt already (a refresh between the write and markDealt).
        once(`dealt:${gameNo}:${turn}:${game.deal}`, () => applyGame((g) => rules.markDealt(g, game.deal)));
        return;
      }
      once(`deal:${gameNo}:${turn}:${game.deal}`, async () => {
        const offer = offerChoices(seated, me, {
          count: game.choices,
          used: rules.usedKeys(game),
          sharedFirst: game.sharedFirst,
          recent: readRecentDeals('anisketch'),
        });
        if (!offer.length) return applyGame((g) => rules.endGame(g));
        const db = getFirebaseDb();
        const node = { forGame: gameNo, forTurn: turn, deal: game.deal, choices: offer, pick: null };
        const stored = await set(ref(db, `rooms/${roomCode}/secrets/${me}`), node).then(() => true).catch((e) => {
          setSyncError(e?.message || 'Could not deal your choices — check your connection.');
          return false;
        });
        if (!stored) return false;
        rememberDealt('anisketch', offer.map((c) => c.key));
        // The turn before is over and revealed: its drawing is not needed.
        if (turn > 0) bestEffort(remove(ref(db, `rooms/${roomCode}/sketch/${gameNo}-${game.log.at(-1)?.turn ?? turn - 1}`)));
        return applyGame((g) => rules.markDealt(g, node.deal));
      });
      return;
    }

    // Judge what is waiting, against my pick.
    if (game.phase === 'drawing' && character && pendingKey) {
      once(`judge:${gameNo}:${turn}:${pendingKey}`, () => applyGame((g) => rules.settleGuesses(
        g,
        (text) => isRightGuess(namesRef.current, characterRef.current, text),
        rosterRef.current.activeIds,
      )));
    }

    // The turn is over: only my phone can say who it was.
    if (game.phase === 'revealed' && !game.reveal && !game.void && character) {
      once(`reveal:${gameNo}:${turn}`, () => applyGame((g) => rules.publishReveal(g, turn, characterRef.current)));
    }
  }, [roomCode, game, state?.view, amDrawer, secret.loaded, mine, character, gameNo, turn, pendingKey, seated, me,
    once, applyGame, setSyncError, bestEffort, rosterRef]);

  // --- the table's duties ----------------------------------------------------------
  //
  // Any device may run these; each is a transaction that re-checks inside.
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
    const { patch } = rules.settleIfComplete(game, active);
    if (patch && Object.keys(patch).length) {
      once(`settle:${gameNo}:${turn}:${active.join(',')}`, () =>
        applyGame((g) => rules.settleIfComplete(g, rosterRef.current.activeIds)));
      return;
    }
    if (game.phase === 'drawing' && closing.expired) {
      once(`time:${gameNo}:${turn}:${pendingKey}`, () => applyGame((g) => rules.timeUp(g, now())));
    }
  }, [roomCode, state, game, active, gameNo, turn, pendingKey, closing.expired, once, applyGame, patchState, rosterRef, now]);

  const byId = new Map(players.map((p) => [p.id, p]));
  const seatedPlayers = game ? game.order.map((id) => byId.get(id)).filter(Boolean) : players;

  return {
    ...core,
    view: state?.view,
    game,
    gameNo,
    seatedPlayers,
    amDrawer,
    choices,
    character,
    sketch,
    clock,
    startGame, returnToLobby,
    choose, guess, giveUp, next,
  };
}
