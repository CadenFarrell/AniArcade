import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onValue, ref, runTransaction, set, update } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import { useRoomCore } from '../../../shared/hooks/useRoomCore';
import { useDeadline } from '../../../shared/hooks/useDeadline';
import { splitTeams } from '../../../shared/utils/teams';
import { castIndex, isRightGuess, validWord } from '../chainWords';
import { dealCard, drawCharacter } from '../deal';
import * as rules from '../rules';

// Per-game, so a saved AniChain room cannot clobber another game's.
const ROOM_KEY = 'anichain_online_room';

const initialState = (localProfile) => ({
  view: 'lobby',
  hostId: localProfile.id,
  game: null,
  // Stamps every card dealt into secrets/, so last game's card — still sitting
  // there, never cleared — cannot pass for this game's.
  gameNo: 0,
  // The lobby's team choices (`teams/{playerId}` → 'red' | 'blue'): anyone may
  // set their own, the host anyone's. Only a preference until Start, which
  // settles them with splitTeams against who is here. `shape` is the host's
  // table setting as it stands, published so every phone can show the teams
  // card when a team game is coming.
  lobby: { teams: {}, shape: 'pair' },
  players: [localProfile],
});

// Named fields only, for the reason rules.normalizeGame gives. The roster's
// lists are repaired too: RTDB drops a player's empty animeList, and the cast
// index the banned words and the judge read is built from those copies.
const normalizeState = (val) => ({
  view: val.view,
  hostId: val.hostId ?? null,
  presence: val.presence ?? {},
  gameNo: val.gameNo ?? 0,
  lobby: { teams: val.lobby?.teams ?? {}, shape: rules.SHAPES.includes(val.lobby?.shape) ? val.lobby.shape : 'pair' },
  players: (val.players ?? []).map((p) => ({
    ...p,
    animeList: (p.animeList ?? []).map((a) => ({ ...a, characters: a.characters ?? [] })),
  })),
  game: rules.normalizeGame(val.game),
});

const charList = (raw) => rules.listOf(raw).map(rules.normalizeCharacter).filter(Boolean);
const bannedList = (raw) => rules.listOf(raw)
  .filter((b) => b && typeof b.word === 'string')
  .map((b) => ({ word: b.word, from: b.from ?? 'cast' }));

/**
 * The Firebase twin of useChainRound.
 *
 * **The card is the one secret, and only the two givers may hold it.** It is
 * hidden from everyone else, so it goes in `secrets/{giverId}` (owner-read),
 * written into BOTH givers' nodes by the FIRST giver's device — AniTurf's
 * "nobody deals a key but its owner", stretched to a pair: no guesser's
 * device, the host's included, ever draws or holds it. Each card is stamped
 * with the game, the turn and the deal number, and is shown only when all
 * three match, so a stale card is invisible rather than wrong.
 *
 * The cost, as in AniTurf, is that only a giver's device can answer for it:
 *   - it judges every guess (settleGuesses, against its own card);
 *   - it publishes the character once the turn is over (publishReveal);
 *   - and a turn whose givers have both gone is void, with nobody to tell.
 * Words are checked against the banned list on the giver's own device before
 * they are sent — the list is part of the card.
 *
 * Every handler acts as THIS device's seat.
 */
export function useChainRoom(pack = null) {
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
  const ids = useCallback(() => rosterRef.current.activeIds, [rosterRef]);

  // Seated players' lists plus this device's pack: the cast the banned words
  // and the judge read. Every device builds the same one.
  const order = game?.order;
  const seated = useMemo(
    () => (order ? (players ?? []).filter((p) => order.includes(p.id)) : []),
    [players, order],
  );
  const index = useMemo(() => castIndex(seated, pack), [seated, pack]);

  // --- my card ---------------------------------------------------------------
  //
  // secrets/ is a sibling of state/, so useRoomCore's subscription never sees
  // it. `loaded` matters because the dealing device WRITES when it finds no
  // card, and acting on the empty value before the first snapshot would deal
  // over the real one on every refresh (AniTurf's guard).
  const [secret, setSecret] = useState({ loaded: false, value: null });
  useEffect(() => {
    if (!roomCode || !me) return undefined;
    const db = getFirebaseDb();
    const unsub = onValue(
      ref(db, `rooms/${roomCode}/secrets/${me}`),
      (snap) => setSecret({ loaded: true, value: snap.val() ?? null }),
      () => setSecret({ loaded: true, value: null }),
    );
    return () => { unsub(); setSecret({ loaded: false, value: null }); };
  }, [roomCode, me]);

  const turn = game ? rules.turnNo(game) : null;
  const amGiver = Boolean(game?.givers?.includes(me));
  const raw = secret.value;
  const sameTurn = Boolean(raw && game && raw.forGame === gameNo && raw.forTurn === turn);
  const card = useMemo(() => {
    if (!amGiver || !sameTurn || raw.deal !== game.deal) return null;
    const character = rules.normalizeCharacter(raw.character);
    return character ? { character, banned: bannedList(raw.banned), skipped: charList(raw.skipped) } : null;
  }, [amGiver, sameTurn, raw, game?.deal]);

  // Transaction callbacks are created once per action and must not close over
  // a stale render's card or index.
  const cardRef = useRef(card);
  const indexRef = useRef(index);
  useEffect(() => { cardRef.current = card; indexRef.current = index; }, [card, index]);

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

  const chooseTeam = useCallback((playerId, team) => (
    patchState({ [`lobby/teams/${playerId}`]: team })
  ), [patchState]);

  const setLobbyShape = useCallback((shape) => (
    isHost ? patchState({ 'lobby/shape': shape }) : Promise.resolve()
  ), [isHost, patchState]);

  // The host seats the players actually here, in join order, and opens the
  // first turn. The card is the first giver's device's to deal (below).
  const startGame = useCallback(async (settings) => {
    if (!isHost) return;
    const here = rosterRef.current.active;
    const playerIds = here.map((p) => p.id);
    const teams = rules.isTeamShape(settings.shape) ? splitTeams(playerIds, state?.lobby?.teams) : null;
    const db = getFirebaseDb();
    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), false));
    await patchState({
      gameNo: gameNo + 1,
      game: rules.startGame({ ids: playerIds, ...settings, teams }),
      view: 'round',
    });
  }, [isHost, rosterRef, state?.lobby?.teams, roomCode, gameNo, patchState, bestEffort]);

  // Back to the lobby with the same sides, and the room open again.
  const returnToLobby = useCallback(async () => {
    const db = getFirebaseDb();
    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), true));
    const patch = { view: 'lobby', game: null };
    for (const team of ['red', 'blue']) for (const id of game?.teams?.[team] ?? []) patch[`lobby/teams/${id}`] = team;
    return patchState(patch);
  }, [roomCode, game, patchState, bestEffort]);

  /**
   * My word, checked against my card first. Returns the refusal reason (the
   * word panel shows it), or null once sent.
   */
  const addWord = useCallback(async (text) => {
    const check = validWord(text, cardRef.current?.banned ?? []);
    if (!cardRef.current) return 'Your card hasn’t arrived yet.';
    if (!check.ok) return check.reason;
    await applyGame((g) => rules.addWord(g, me, check.word, { now: now(), activeIds: ids() }));
    return null;
  }, [applyGame, me, now, ids]);
  const guess = useCallback((text) => applyGame((g) => rules.guess(g, me, text, { now: now() })), [applyGame, me, now]);
  const pass = useCallback(() => applyGame((g) => rules.passWord(g, me, { now: now() })), [applyGame, me, now]);
  const skip = useCallback(() => applyGame((g) => rules.skip(g, me)), [applyGame, me]);
  // Anyone may press Next; the second device's transaction aborts.
  const next = useCallback(() => applyGame((g) => rules.nextTurn(g, ids())), [applyGame, ids]);

  // --- the clock -------------------------------------------------------------
  //
  // The guess window after each word. The screen's countdown drains to it, and
  // its running out is what lets the next word (or the end of a capped chain)
  // through — so this re-renders the hook when it does.
  const windowClock = useDeadline(game ? rules.windowEndsAt(game) : null, {
    offsetMs: core.serverOffset,
    windowMs: rules.GUESS_MS,
  });

  // --- my giver duties -------------------------------------------------------
  //
  // Each is a one-shot keyed on what it is once PER — the game, the turn and
  // the deal; the guesses waiting — since the view stays 'round' all game and
  // useRoomCore only re-arms one-shots on a view change.
  const active = roster.activeIds;
  const judgeId = game?.givers?.find((id) => active.includes(id)) ?? null;
  const pendingKey = game ? game.guesses.filter((g) => g.verdict === 'pending').map((g) => `${g.by}@${g.n}`).join(',') : '';
  useEffect(() => {
    if (!roomCode || !game || state?.view !== 'round' || !amGiver) return;

    // Deal: the first giver here draws the card and writes it into both
    // givers' nodes in one update, and only then opens the chain.
    if (game.phase === 'deal' && judgeId === me) {
      if (!secret.loaded) return;
      once(`deal:${gameNo}:${turn}:${game.deal}`, async () => {
        // Characters already dealt this game: everything the log has revealed,
        // plus — after a skip — what this turn's givers already turned down.
        const prev = sameTurn && raw.deal < game.deal ? raw : null;
        const skipped = prev ? [...charList(prev.skipped), rules.normalizeCharacter(prev.character)].filter(Boolean) : [];
        const used = [
          ...game.log.flatMap((e) => [e.character, ...e.skipped]).filter(Boolean).map((c) => c.key),
          ...skipped.map((c) => c.key),
        ];
        const guessers = game.shape === 'rivals'
          ? game.order.filter((id) => !game.givers.includes(id))
          : rules.guessersFor(game, game.givers[0]);
        const character = drawCharacter(seated, { givers: game.givers, guessers, used, pool: game.pool });
        if (!character) return applyGame((g) => rules.endGame(g));
        const dealt = dealCard(indexRef.current, character);
        const node = { forGame: gameNo, forTurn: turn, deal: game.deal, character, banned: dealt.banned, skipped };
        const db = getFirebaseDb();
        const writes = Object.fromEntries(game.givers.map((id) => [`rooms/${roomCode}/secrets/${id}`, node]));
        const stored = await update(ref(db), writes).then(() => true).catch((e) => {
          setSyncError(e?.message || 'Could not deal the card — check your connection.');
          return false;
        });
        if (!stored) return false;
        return applyGame((g) => rules.markDealt(g, node.deal));
      });
      return;
    }

    // Judge what is waiting, against my card.
    if (game.phase === 'chain' && card && judgeId === me && pendingKey) {
      once(`judge:${gameNo}:${turn}:${pendingKey}`, () => applyGame((g) => (
        rules.settleGuesses(g, (text) => isRightGuess(indexRef.current, cardRef.current?.character, text))
      )));
    }

    // The turn is over: the character is a secret no more, and only a giver's
    // device can say who it was.
    if (game.phase === 'over' && !game.reveal && sameTurn) {
      const character = rules.normalizeCharacter(raw.character);
      if (character) {
        once(`reveal:${gameNo}:${turn}`, () => applyGame((g) => rules.publishReveal(g, turn, {
          character, skipped: charList(raw.skipped),
        })));
      }
    }
  }, [roomCode, game, state?.view, amGiver, judgeId, me, secret.loaded, sameTurn, raw, gameNo, turn, card,
    pendingKey, seated, once, applyGame, setSyncError]);

  // --- the table's duties ----------------------------------------------------
  //
  // Any device may run these; each is a transaction that re-checks inside.
  // A capped chain closes once its last window does; a giver gone, or nobody
  // left to guess, voids the turn; below the shape's minimum, the game ends.
  const capKey = game ? `${gameNo}:${turn}:${game.chain.length}:${windowClock.expired}:${pendingKey}` : '';
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
    if (game.phase === 'chain' && game.chain.length >= game.cap && rules.windowOpen(game, now(), active)) {
      once(`out:${capKey}`, () => applyGame((g) => rules.outOfWords(g, { now: now(), activeIds: rosterRef.current.activeIds })));
    }
  }, [roomCode, state, game, active, gameNo, turn, capKey, once, applyGame, patchState, rosterRef, now]);

  const byId = new Map(players.map((p) => [p.id, p]));
  // The table in seat order — Red then Blue in the team shapes — so a face
  // sits in the same place on every screen.
  const seatedPlayers = game
    ? (game.teams ? [...game.teams.red, ...game.teams.blue] : game.order).map((id) => byId.get(id)).filter(Boolean)
    : players;

  return {
    ...core,
    view: state?.view,
    lobby: state?.lobby ?? { teams: {}, shape: 'pair' },
    game,
    gameNo,
    seatedPlayers,
    index,
    card,
    amGiver,
    windowClock,
    now,
    startGame, returnToLobby, chooseTeam, setLobbyShape,
    addWord, guess, pass, skip, next,
  };
}
