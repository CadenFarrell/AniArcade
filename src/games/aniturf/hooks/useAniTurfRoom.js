import { useCallback, useEffect, useMemo, useState } from 'react';
import { ref, onValue, set, update, runTransaction } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import { useRoomCore } from '../../../shared/hooks/useRoomCore';
import { drawBoard } from '../utils/board';
import * as rules from '../rules';

const ROOM_KEY = 'aniturf_online_room';

const initialState = (localProfile) => ({
  view: 'lobby',
  hostId: localProfile.id,
  settings: null,
  game: null,
  totalScores: {},
  // Stamps every key a clue-giver deals into secrets/, so last game's key —
  // still sitting there, never cleared — cannot pass for this game's.
  roundNumber: 0,
  // The lobby's team choices: `teams/{playerId}` is the side a player picked
  // (anyone may set their own; the host may move anyone), `givers/{team}` the
  // crown the host handed out. Both are only preferences until Start, which
  // settles them with rules.splitTeams / resolveGivers against who is here.
  lobby: { teams: {}, givers: {} },
  players: [localProfile],
});

const normalizeState = (val) => {
  const players = (val.players ?? []).map((p) => ({
    ...p,
    animeList: (p.animeList ?? []).map((a) => ({ ...a, characters: a.characters ?? [] })),
  }));
  return {
    view: val.view,
    hostId: val.hostId ?? null,
    settings: val.settings ?? null,
    presence: val.presence ?? {},
    totalScores: val.totalScores ?? {},
    roundNumber: val.roundNumber ?? 0,
    lobby: { teams: val.lobby?.teams ?? {}, givers: val.lobby?.givers ?? {} },
    players,
    game: rules.normalizeGame(val.game),
  };
};

const toCells = (raw) => (Array.isArray(raw) ? raw : Object.values(raw ?? {})).filter((x) => x != null);

// The Firebase-backed twin of useAniTurfRound. Same rules; the room lifecycle
// is shared/hooks/useRoomCore.js.
//
// The two secrets are each team's key (its footing) and the traps each team
// planted against the other. Each is known to exactly ONE person — that team's
// clue-giver — and hidden from everyone else, their own guessers included. So,
// asking "who must not see it": everybody but the owner, which is secrets/
// (owner-read), never assignments/ (everyone-but-owner) and never state/.
//
// And nobody deals a key but its owner. AniFake's host computes every card and
// so, for an instant, holds the answer; here each clue-giver's OWN device makes
// its team's footing (rules.makeFooting) and writes it to its own secrets/
// node, so no other device — the host's included — ever holds it, not even in
// passing. The cost is that only that device can answer for it, which is the
// shape of the whole claim protocol below.
//
// A claim is answered by two devices, each telling the room only what it was
// dealt:
//   1. a guesser asks (state/game/pending), one claim at a time;
//   2. their own clue-giver's device says whether the square is footing — a
//      miss resolves there and then;
//   3. on footing, the OTHER clue-giver's device says whether it trapped the
//      square, and resolves the claim.
// Each device likewise checks its own team's route after every move: a detour
// when the board still has a way across (written to its own secret only), a
// declared cut when it has none — nobody else could know either.
export function useAniTurfRoom() {
  const core = useRoomCore({
    storageKey: ROOM_KEY,
    playersPath: 'players',
    initialState,
    normalizeState,
  });
  const {
    roomCode, myPlayerId, state, isHost, players,
    patchState, bestEffort, once, setSyncError, rosterRef, roster,
  } = core;

  const game = state?.game ?? null;
  const roundNumber = state?.roundNumber ?? 0;

  // --- my key ----------------------------------------------------------------
  //
  // secrets/ is a sibling of state/, so useRoomCore's subscription never sees
  // it. `loaded` matters more here than in AniFake: this device WRITES its own
  // key when it finds none, and acting on the empty value before the first
  // snapshot arrives would deal a second key over the real one on every
  // refresh.
  const [secret, setSecret] = useState({ loaded: false, value: null });
  useEffect(() => {
    if (!roomCode || !myPlayerId) return undefined;
    const db = getFirebaseDb();
    const unsub = onValue(
      ref(db, `rooms/${roomCode}/secrets/${myPlayerId}`),
      (snap) => setSecret({ loaded: true, value: snap.val() ?? null }),
      () => setSecret({ loaded: true, value: null }),
    );
    return () => { unsub(); setSecret({ loaded: false, value: null }); };
  }, [roomCode, myPlayerId]);

  const myTeam = game ? rules.teamOf(game, myPlayerId) : null;
  const amGiver = Boolean(myTeam) && game?.clueGivers?.[myTeam] === myPlayerId;
  // A key from an earlier game, or from before this team's crown changed
  // hands, is still sitting in secrets/; the stamps are what make it
  // invisible rather than wrong.
  const raw = secret.value;
  const stamp = game?.keyStamp?.[myTeam] ?? null;
  const key = useMemo(() => (
    amGiver && raw && raw.forRound === roundNumber && raw.team === myTeam && raw.forKey === stamp
      ? { footing: toCells(raw.footing), traps: toCells(raw.traps), detour: raw.detour ? { ...raw.detour, squares: toCells(raw.detour.squares) } : null }
      : null
  ), [amGiver, raw, roundNumber, myTeam, stamp]);

  // --- writes ----------------------------------------------------------------

  // Every change to the game is one transaction on state/game, so two devices
  // acting at once cannot lose each other's write. Returns false on a failed
  // write so a `once` re-arms — the same contract as AniFake's applyGame.
  const applyGame = useCallback((fn) => {
    const db = getFirebaseDb();
    return runTransaction(ref(db, `rooms/${roomCode}/state/game`), (stored) => {
      const current = rules.normalizeGame(stored);
      if (!current) return undefined;
      const { patch } = fn(current);
      if (!patch || Object.keys(patch).length === 0) return undefined;
      return { ...current, ...patch };
    }).catch((e) => {
      setSyncError(e?.message || 'Could not sync with the room — check your connection.');
      return false;
    });
  }, [roomCode, setSyncError]);

  const chooseTeam = useCallback((playerId, team) => (
    patchState({ [`lobby/teams/${playerId}`]: team })
  ), [patchState]);

  const setGiver = useCallback((team, playerId) => (
    isHost ? patchState({ [`lobby/givers/${team}`]: playerId }) : Promise.resolve()
  ), [isHost, patchState]);

  const startGame = useCallback(async (settings) => {
    if (!isHost) return;
    // Seated from the players actually here, in join order.
    const here = rosterRef.current.active;
    const ids = here.map((p) => p.id);
    const teams = rules.splitTeams(ids, state?.lobby?.teams);
    const ready = rules.teamsReady(teams);
    if (!ready.ok) { setSyncError(ready.reason); return; }
    const { board, enough, available } = drawBoard(here, { sharedOnly: settings.sharedOnly });
    if (!enough) {
      setSyncError(`Only ${available} characters to draw from — the board needs ${rules.CELLS}.`);
      return;
    }
    const nextRound = roundNumber + 1;
    const db = getFirebaseDb();
    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), false));
    await patchState({
      settings,
      roundNumber: nextRound,
      game: rules.startGame({
        board,
        teams,
        clueGivers: rules.resolveGivers(teams, state?.lobby?.givers),
        startTeam: rules.pickStartTeam(),
        traps: settings.traps,
        round: nextRound,
      }),
      view: 'play',
    });
  }, [isHost, rosterRef, state, roundNumber, roomCode, patchState, bestEffort, setSyncError]);

  // My traps go into my own secret first, then the room hears only THAT I
  // planted. In that order, so the room can never move on to clues while the
  // traps it will be asked about are still in flight.
  const plantTraps = useCallback(async (cells) => {
    if (!amGiver || !key) return false;
    const db = getFirebaseDb();
    const stored = await update(ref(db, `rooms/${roomCode}/secrets/${myPlayerId}`), { traps: cells })
      .then(() => true)
      .catch((e) => { setSyncError(e?.message || 'Could not plant the traps — check your connection.'); return false; });
    if (!stored) return false;
    return applyGame((g) => rules.plant(g, myTeam));
  }, [amGiver, key, roomCode, myPlayerId, myTeam, applyGame, setSyncError]);

  const giveClue = useCallback((word, number) => (
    applyGame((g) => (g.clueGivers[myTeam] === myPlayerId
      ? rules.giveClue(g, myTeam, word, number, myPlayerId)
      : { patch: {} }))
  ), [applyGame, myTeam, myPlayerId]);

  const requestClaim = useCallback((cell) => (
    applyGame((g) => (g.clueGivers[myTeam] === myPlayerId
      ? { patch: {} } // a clue-giver never claims: their key is on their screen
      : rules.requestClaim(g, myTeam, cell, myPlayerId)))
  ), [applyGame, myTeam, myPlayerId]);

  const stop = useCallback(() => applyGame((g) => rules.stopGuessing(g, myTeam)), [applyGame, myTeam]);

  // Banks the game exactly once (the bankedAt claim, as in AniFake), then
  // shows the results. Any device may press it.
  const finishGame = useCallback(async () => {
    const snapshot = state?.game;
    if (!snapshot || snapshot.phase !== 'over') return false;
    const db = getFirebaseDb();
    const claim = await runTransaction(ref(db, `rooms/${roomCode}/state/bankedAt`), (cur) => (
      cur === roundNumber ? undefined : roundNumber
    )).catch(() => null);
    if (!claim) return false;
    if (claim.committed) await patchState({ totalScores: rules.applyWin(state.totalScores ?? {}, snapshot) });
    await runTransaction(ref(db, `rooms/${roomCode}/state/view`), (cur) => (cur === 'results' ? undefined : 'results'))
      .catch(() => {});
    return true;
  }, [state, roomCode, roundNumber, patchState]);

  // Back to the lobby with the same sides, the crown moved on one seat in each
  // team, and the room open again for anyone new.
  const returnToLobby = useCallback(async () => {
    const db = getFirebaseDb();
    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), true));
    const patch = { view: 'lobby', game: null };
    if (game) {
      const givers = rules.rotateGivers(game.teams, game.clueGivers);
      for (const team of rules.TEAMS) if (givers[team]) patch[`lobby/givers/${team}`] = givers[team];
      for (const team of rules.TEAMS) for (const id of game.teams[team]) patch[`lobby/teams/${id}`] = team;
    }
    return patchState(patch);
  }, [roomCode, game, patchState, bestEffort]);

  // --- my clue-giver duties --------------------------------------------------
  //
  // Everything this device answers for, because it alone holds the key. Each
  // is a one-shot keyed on what it is once PER — the deal on the key stamp, a
  // claim on its sequence number — since the view stays 'play' for the whole
  // game and useRoomCore only re-arms one-shots on a view change.
  useEffect(() => {
    if (!roomCode || !game || !amGiver) return;
    // Game over: my key is a secret no more, and the results show both. Only I
    // can publish it — nobody else can read it — so I do, once.
    if (game.phase === 'over') {
      if (key && !game.reveal?.[myTeam]) {
        once(`reveal:${roundNumber}:${myTeam}`, () => applyGame((g) => rules.publishKey(g, myTeam, key)));
      }
      return;
    }
    if (state?.view !== 'play') return;
    const stamp = game.keyStamp[myTeam];

    // Deal my own key. A fresh one at the start; a rebuilt one, agreeing with
    // the board, when the crown has just come to me mid-game.
    if (!key) {
      if (!secret.loaded) return;
      once(`deal:${roundNumber}:${myTeam}:${stamp}`, () => {
        const fresh = game.phase === 'plant' && game.marks.every((m) => m == null);
        const footing = fresh ? rules.makeFooting(myTeam) : rules.rebuildFooting(game, myTeam);
        const db = getFirebaseDb();
        return set(ref(db, `rooms/${roomCode}/secrets/${myPlayerId}`), {
          team: myTeam, forRound: roundNumber, forKey: stamp, footing, traps: [],
        }).then(() => true).catch(() => false);
      });
      return;
    }

    // Traps off: nothing to plant, so reading the key is planting.
    if (game.phase === 'plant' && !game.planted[myTeam]
      && rules.trapsFor(game.traps, myTeam, game.startTeam) === 0) {
      once(`plant:${roundNumber}:${myTeam}:${stamp}`, () => applyGame((g) => rules.plant(g, myTeam)));
    }

    const p = game.pending;
    // 2. My team's claim: is it footing?
    if (game.phase === 'guess' && p && p.team === myTeam && !p.footing) {
      const footing = key.footing.includes(p.cell);
      once(`foot:${roundNumber}:${p.seq}`, () => applyGame((g) => {
        if (g.pending?.seq !== p.seq) return { patch: {} };
        // A miss needs nobody else; nor does footing when traps are off.
        if (!footing || !g.traps) return rules.resolveClaim(g, { cell: p.cell, footing, trapped: false, by: p.by });
        return rules.markFooting(g, p.seq);
      }));
    }
    // 3. The other team's claim landed on their footing: did I trap it?
    if (game.phase === 'guess' && p && p.team !== myTeam && p.footing) {
      const trapped = key.traps.includes(p.cell);
      once(`trap:${roundNumber}:${p.seq}`, () => applyGame((g) => (
        g.pending?.seq === p.seq && g.pending.footing
          ? rules.resolveClaim(g, { cell: p.cell, footing: true, trapped, by: p.by })
          : { patch: {} }
      )));
    }

    // Is my team cut off? Keyed on the board, so each new move asks again. A
    // detour, when the board still has a way across, is written to my own
    // secret only — the room never learns a route was cut, which would tell
    // the other team they had just taken one of our squares. No way across at
    // all, and the team loses.
    if ((game.phase === 'clue' || game.phase === 'guess') && !rules.routeAlive(key.footing, game.marks, myTeam)) {
      once(`cut:${roundNumber}:${myTeam}:${game.marks.join(',')}`, () => {
        const next = rules.rerouteFooting(game, myTeam, key.footing);
        if (!next) {
          return applyGame((g) => (
            rules.routeAlive(key.footing, g.marks, myTeam) ? { patch: {} } : rules.declareCut(g, myTeam)
          ));
        }
        const db = getFirebaseDb();
        return update(ref(db, `rooms/${roomCode}/secrets/${myPlayerId}`), {
          footing: next,
          detour: rules.nextDetour(game, myTeam, key.detour, next.filter((i) => !key.footing.includes(i))),
        }).then(() => true).catch(() => false);
      });
    }
  }, [roomCode, game, amGiver, myTeam, key, secret.loaded, state?.view, roundNumber, myPlayerId, once, applyGame]);

  // --- departures ------------------------------------------------------------
  //
  // useRoomCore has already moved the host's crown. What is left is the two
  // roles a game cannot do without: each team's clue-giver (the only device
  // that can answer for its key) and at least one guesser. Any device may run
  // these; each is a transaction that re-checks inside, so racing devices
  // agree.
  useEffect(() => {
    if (!roomCode || !game || state?.view !== 'play' || game.phase === 'over') return;
    const { activeIds, departedIds } = roster;
    if (!activeIds.length) return;
    for (const team of rules.TEAMS) {
      const giver = game.clueGivers[team];
      if (giver && departedIds.includes(giver)) {
        once(`migrate:${team}:${giver}`, () => applyGame((g) => (
          g.clueGivers[team] === giver ? rules.promoteGiver(g, team, activeIds) : { patch: {} }
        )));
      } else if (!rules.guessersLeft(game, team, activeIds).length) {
        once(`forfeit:${team}:${activeIds.join(',')}`, () => applyGame((g) => (
          rules.guessersLeft(g, team, activeIds).length ? { patch: {} } : rules.forfeit(g, team)
        )));
      }
    }
  }, [roomCode, game, state?.view, roster, once, applyGame]);

  const byId = new Map(players.map((p) => [p.id, p]));
  // The table in team order, Red then Blue — the order the strips and results
  // seat them in, so a face sits in the same place on every screen.
  const seated = game
    ? [...game.teams.red, ...game.teams.blue].map((id) => byId.get(id)).filter(Boolean)
    : players;

  return {
    uid: core.uid, roomCode, myPlayerId,
    error: core.error, syncError: core.syncError,
    dismissError: core.dismissError, dismissSyncError: core.dismissSyncError,
    createRoom: core.createRoom, joinRoom: core.joinRoom, leaveRoom: core.leaveRoom,
    // Next game, same table: shared/utils/handoff.js.
    handoff: core.handoff,
    updateMyProfile: core.updateMyProfile, setView: core.setView,
    view: state?.view,
    hostId: core.hostId, isHost, hostName: core.hostName,
    players,
    seatedPlayers: seated,
    lobby: state?.lobby ?? { teams: {}, givers: {} },
    settings: state?.settings ?? null,
    totalScores: state?.totalScores ?? {},
    game,
    myTeam,
    amGiver,
    key,
    activePlayers: core.activePlayers,
    activeIds: core.activeIds,
    departedIds: core.departedIds,
    playerStatuses: core.playerStatuses,
    dropping: core.dropping,
    graceMs: core.graceMs,
    startGame, chooseTeam, setGiver, plantTraps, giveClue, requestClaim, stop, finishGame, returnToLobby,
    guard: core.guard,
  };
}
