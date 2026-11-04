import { useCallback, useEffect, useMemo, useState } from 'react';
import { ref, onValue, get, set, runTransaction } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import { useRoomCore } from '../../../shared/hooks/useRoomCore';
import { useCustomCategories } from './useCustomCategories';
import { dealCategories, getCategory } from '../categories';
import * as rules from '../rules';

const ROOM_KEY = 'anitag_online_room';

// The Firebase-backed twin of useCategoriesRound. Same pure rules; the room
// lifecycle comes from shared/hooks/useRoomCore.js.
//
// A CLAUSE LIVES IN assignments/{playerId}: read AND write denied to the
// assignee, allowed to everyone else. A value about you that you alone must not
// learn — the AniGuess shape, already deployed, so no database.rules.json
// change was needed. (secrets/ is the opposite row of CLAUDE.md's table — only
// the owner reads it — and putting a clause there would show it to exactly the
// one player it is hidden from.)
//
// THE TABLE PICKS (the default): ONE SHARED PROPOSAL PER TARGET, in the
// target's own slot. AniGuess's OnlineCharacterAssignment, applied to a rule:
// every device but the target's watches assignments/{target}, anyone may write
// a proposal there (which wipes the approvals, because what was approved is no
// longer what is on the table), and the pick locks once every OTHER active
// player has approved it. The proposal's `category` field is the very field the
// round reads, so locking is only a flag in state/ (rules.recordPick) — the
// clause is already where it needs to be, and the target's device never wrote
// or read it. The proposer's approval rides in with the proposal, so at two
// players a pick is one tap.
//
// Each proposal carries a fresh `nonce` and an approval records the nonce it
// approved, so an approval that lands just after somebody else's
// counter-proposal counts for nothing rather than for the new one.
//
// RANDOM: NOBODY DEALS THEIR OWN, and the deal is split across two devices to
// guarantee it. The host writes every slot except its own; the first other
// seated player writes the host's. Both writes are legal under the deployed
// rule and the forbidden one is rejected by Firebase rather than by a
// client-side check, so a bug there is a PERMISSION_DENIED in the console
// instead of a silent leak. That is where this game escapes AniFake's "whoever
// computes the deal learns it" concession rather than inheriting it.
//
// ONE RESIDUAL LIMIT OF THAT SPLIT, recorded rather than designed around: the
// second dealer cannot read its own category, so when it draws the host's it
// cannot rule out the one clause it holds itself. It excludes every category it
// CAN see, leaving a roughly one-in-a-dozen chance the host and that one player
// end a round holding the same clause. Unfixable without a server — any device
// able to exclude every dealt category would by construction know its own.
//
// A PLAYER'S WRITTEN CATEGORIES NEVER ENTER ROOM STATE, either way. Each
// device draws or offers from the built-ins plus ITS OWN local list, and only
// the clause actually in play is published — the same rule AniWave applies to
// written spectra. Putting them in state/settings would have been simpler and
// would have published everything a player has ever written to everybody in the
// room, most of which no round will ever use.
const initialState = (localProfile) => ({
  view: 'lobby',
  hostId: localProfile.id,
  settings: null,
  game: null,
  totalScores: {},
  players: [localProfile],
});

function normalizeState(raw) {
  if (!raw) return raw;
  return {
    ...raw,
    players: Array.isArray(raw.players) ? raw.players.filter(Boolean) : [],
    totalScores: raw.totalScores ?? {},
    // Every clause revealed in an earlier round of this game, for the random
    // deal to exclude. Public by now (attachCategory wrote each onto its
    // result at the turn's end). RTDB drops the empty array.
    seenCategories: Array.isArray(raw.seenCategories) ? raw.seenCategories.filter(Boolean) : [],
    // The single point round state enters the hook — so nothing downstream, and
    // least of all rules.js, ever sees the shapes RTDB drops.
    game: rules.normalizeGame(raw.game),
  };
}

export function useCategoriesRoom() {
  const core = useRoomCore({
    storageKey: ROOM_KEY,
    playersPath: 'players',
    initialState,
    normalizeState,
  });
  const {
    roomCode, myPlayerId, state, isHost, players, hostId,
    patchState, once, setSyncError, roster,
  } = core;

  // This device's own written categories — read here rather than passed in,
  // because both dealing effects live in this hook and neither screen that
  // renders them has any reason to hold the list. See the header for why they
  // are never published.
  const { categories: myCustom } = useCustomCategories();

  const game = state?.game ?? null;
  const settings = state?.settings ?? null;
  // Read off the ROUND, not off settings: the round is what rules.js acts on,
  // and a lobby that could still write settings mid-game would otherwise change
  // how a round already in flight is being set up.
  const tablePicks = rules.isTablePicked(game);
  // Memoized because it feeds two effects' dependency arrays: the bare
  // conditional mints a new [] every render when the setting is off, which
  // re-runs both deal effects forever.
  const extraCategories = useMemo(
    () => (settings?.useCustom === false ? [] : myCustom),
    [settings?.useCustom, myCustom],
  );
  const playerIds = useMemo(() => players.map((p) => p.id), [players]);
  const activeIds = roster.activeIds;
  const departedIds = roster.departedIds;

  const seatId = game?.seatId ?? null;
  const iAmSeat = !!seatId && seatId === myPlayerId;

  // WHO OWES AN ANSWER — resolved once here and passed everywhere else. See
  // rules.requiredJudges.
  const judgeIds = useMemo(
    () => (game ? rules.requiredJudges(game, playerIds, departedIds) : []),
    [game, playerIds, departedIds],
  );
  const iMustRule = (
    !!myPlayerId
    && judgeIds.includes(myPlayerId)
    && typeof game?.pending?.verdicts?.[myPlayerId] !== 'boolean'
  );

  // --- the hot seat's category ------------------------------------------------
  //
  // assignments/ is a SIBLING of state/, so useRoomCore's subscription never
  // sees it and this needs its own. Precedent: useRoom.js's assignments listener
  // and useAniFakeRoom's dealt-card listener.
  //
  // Watches the SEAT rather than this device: what a judge needs to rule is the
  // clause of whoever is naming, and what this device is denied is only its own.
  // So the subscription simply never opens on the seat's own device — there is
  // nothing for it to be refused, and no error path to swallow.
  const [seatSpec, setSeatSpec] = useState(null);
  useEffect(() => {
    // No setState in this branch: the previous run's cleanup already nulled it
    // on any dependency change, and it starts null. Setting it here as well is
    // the synchronous-setState-in-an-effect that react-hooks forbids, and it
    // would be a redundant cascading render even where it is legal.
    if (!roomCode || !seatId || seatId === myPlayerId) return undefined;
    const db = getFirebaseDb();
    const node = ref(db, `rooms/${roomCode}/assignments/${seatId}`);
    const unsub = onValue(node, (snap) => setSeatSpec(snap.val() ?? null), () => setSeatSpec(null));
    return () => { unsub(); setSeatSpec(null); };
  }, [roomCode, seatId, myPlayerId]);

  // A category from a previous round is still sitting in that node. The stamp is
  // what makes it invisible rather than wrong — assignments are STAMPED, never
  // cleared, because a clear is N writes that can half-fail and leave the
  // previous answer readable. Same trick as AniGuess's assignment stamp and
  // AniFake's forRound/forDeal pair.
  const seatCategory = (
    game && game.phase !== 'picking' && seatSpec && seatSpec.forRound === game.round
      && rules.toSpec(seatSpec.category)
      ? getCategory(seatSpec.category)
      : null
  );

  // --- the table picks: the shared proposal ----------------------------------
  //
  // Whose clause the table is picking right now. Derived from the picks and the
  // ACTIVE roster on every render — a target who closes their tab is simply
  // skipped, and nobody can be stuck waiting on a pick for somebody absent.
  const pickTargetId = game ? rules.pickingFor(game, playerIds, departedIds) : null;
  const iAmPickTarget = !!pickTargetId && pickTargetId === myPlayerId;

  // The live proposal, on every device EXCEPT the target's — whose device is
  // refused the node, so the subscription is simply never opened there, exactly
  // as the seat's own clause is never read on the seat's device.
  const [proposalRaw, setProposalRaw] = useState(null);
  useEffect(() => {
    if (!roomCode || !pickTargetId || pickTargetId === myPlayerId) return undefined;
    const db = getFirebaseDb();
    const node = ref(db, `rooms/${roomCode}/assignments/${pickTargetId}`);
    const unsub = onValue(node, (snap) => setProposalRaw(snap.val() ?? null), () => setProposalRaw(null));
    return () => { unsub(); setProposalRaw(null); };
  }, [roomCode, pickTargetId, myPlayerId]);

  // Stamped with the round like every assignment, so last round's clause in
  // the same slot reads as "nothing proposed yet" rather than as a proposal.
  // Memoized because it feeds a callback and an effect: a fresh object on
  // every render would rebuild both every time.
  const currentRound = game?.round;
  const proposal = useMemo(() => (
    currentRound != null && proposalRaw && proposalRaw.forRound === currentRound
      && rules.toSpec(proposalRaw.category) && typeof proposalRaw.nonce === 'string'
      ? {
        spec: rules.toSpec(proposalRaw.category),
        by: typeof proposalRaw.by === 'string' ? proposalRaw.by : null,
        nonce: proposalRaw.nonce,
        approvals: proposalRaw.approvals ?? {},
      }
      : null
  ), [proposalRaw, currentRound]);
  // Everybody whose approval the pick needs: every active player but the
  // target. A departure shrinks it, so a closed tab cannot hold a pick open.
  const approverIds = useMemo(
    () => (pickTargetId ? activeIds.filter((id) => id !== pickTargetId) : []),
    [activeIds, pickTargetId],
  );
  // Approvals count only against the nonce they were given for — see the
  // header — and only from players still here.
  const approvedIds = proposal
    ? approverIds.filter((id) => proposal.approvals[id] === proposal.nonce)
    : [];
  const allApproved = !!proposal && approverIds.length > 0
    && approvedIds.length === approverIds.length;

  // The clauses already locked in this round that this device can read, so
  // "Deal one at random" does not hand two players the same one. Read once per
  // target rather than subscribed: a locked clause does not change, and the
  // set only grows when the target moves on.
  //
  // Keyed on primitives (a joined id list, the round) rather than on `game`,
  // which is a new object on every write and would re-read them all each time.
  const [takenLabels, setTakenLabels] = useState([]);
  const picking = game?.phase === 'picking';
  const pickRound = game?.round ?? 0;
  const pickedKey = game ? Object.keys(game.picked ?? {}).sort().join(',') : '';
  useEffect(() => {
    if (!roomCode || !picking || iAmPickTarget) return undefined;
    const ids = pickedKey.split(',').filter((id) => id && id !== myPlayerId);
    let live = true;
    const db = getFirebaseDb();
    Promise.all(ids.map((id) => get(ref(db, `rooms/${roomCode}/assignments/${id}`))))
      .then((snaps) => {
        if (!live) return;
        setTakenLabels(snaps
          .map((snap) => snap.val())
          .filter((v) => v?.forRound === pickRound && rules.toSpec(v.category))
          .map((v) => getCategory(v.category).label));
      })
      // A failed read only means the random button might repeat a clause.
      .catch(() => {});
    return () => { live = false; };
  }, [roomCode, picking, pickRound, pickedKey, iAmPickTarget, myPlayerId]);

  // --- dealing (a random deal only) --------------------------------------------

  const seated = useMemo(
    () => (roster.activeIds.length ? roster.activeIds : playerIds),
    [roster.activeIds, playerIds],
  );
  // Deterministic, so every device agrees who the second dealer is without a
  // write. Re-derives if that player leaves, which is what re-arms the one-shot
  // below rather than leaving the host's slot empty forever.
  const secondDealerId = seated.find((id) => id !== hostId) ?? null;

  // The host deals every slot but its own.
  useEffect(() => {
    if (!roomCode || !game || !isHost || state?.view !== 'round' || tablePicks) return;
    const others = seated.filter((id) => id !== hostId);
    if (!others.length) return;
    // Keyed on the round: useRoomCore clears its one-shots on a VIEW change and
    // the view stays 'round' all game, so without the round in the key this
    // fires once and round two is dealt nothing. The `secret:${round}` note in
    // useWavelengthRoom is the same lesson.
    once(`deal:${game.round}`, async () => {
      const db = getFirebaseDb();
      // Self-healing rather than trusting the latch: if a slot this device is
      // responsible for is already stamped for this round, the deal happened.
      const probe = await get(ref(db, `rooms/${roomCode}/assignments/${others[0]}`));
      if (probe.val()?.forRound === game.round) return;
      const dealt = dealCategories(others, Math.random, {
        pool: settings?.categoryPool,
        extra: extraCategories,
        exclude: state?.seenCategories ?? [],
      });
      await Promise.all(others.map((id) => set(
        ref(db, `rooms/${roomCode}/assignments/${id}`),
        { category: dealt[id], forRound: game.round },
      )));
    });
  }, [roomCode, game, tablePicks, isHost, hostId, seated, settings, extraCategories, state?.view, state?.seenCategories, once]);

  // One other device deals the host's, because the host may not deal its own.
  useEffect(() => {
    if (!roomCode || !game || state?.view !== 'round' || tablePicks) return;
    if (!hostId || myPlayerId !== secondDealerId) return;
    // Keyed on this dealer as well as the round, so a dealer who leaves before
    // writing hands the job on rather than latching it closed.
    once(`dealhost:${game.round}:${myPlayerId}`, async () => {
      const db = getFirebaseDb();
      const hostSlot = ref(db, `rooms/${roomCode}/assignments/${hostId}`);
      const existing = await get(hostSlot);
      if (existing.val()?.forRound === game.round) return;
      // Everything this device is ALLOWED to see, so the host does not get a
      // clause somebody else already holds. Its own is the one it cannot rule
      // out — see the header for why that is unfixable without a server.
      const visible = await Promise.all(
        seated
          .filter((id) => id !== myPlayerId && id !== hostId)
          .map((id) => get(ref(db, `rooms/${roomCode}/assignments/${id}`))),
      );
      const taken = visible
        .map((snap) => snap.val()?.category)
        .filter((spec) => rules.toSpec(spec));
      const dealt = dealCategories([hostId], Math.random, {
        pool: settings?.categoryPool,
        extra: extraCategories,
        exclude: [...taken, ...(state?.seenCategories ?? [])],
      });
      await set(hostSlot, { category: dealt[hostId], forRound: game.round });
    });
  }, [roomCode, game, tablePicks, hostId, myPlayerId, secondDealerId, seated, settings,
      extraCategories, state?.view, state?.seenCategories, once]);

  // --- round mutations --------------------------------------------------------
  //
  // Every mutation of the round funnels through one transaction on state/game so
  // two devices acting at the same instant can't lose each other's write. The
  // callback re-normalizes, because a transaction callback sees the RAW stored
  // value rather than the subscription's repaired one.
  const applyRound = useCallback((fn) => {
    const db = getFirebaseDb();
    return runTransaction(ref(db, `rooms/${roomCode}/state/game`), (raw) => {
      const current = rules.normalizeGame(raw);
      if (!current) return; // abort — no round yet
      const { patch } = fn(current);
      if (!patch || Object.keys(patch).length === 0) return; // abort — rule no-op
      return { ...current, ...patch };
    }).catch((e) => {
      setSyncError(e?.message || 'Could not sync with the room — check your connection.');
    });
  }, [roomCode, setSyncError]);

  const startGame = useCallback(async (nextSettings) => {
    if (!isHost) return;
    // Deal from the players actually here: a departed player should not be
    // handed the opening turn.
    const ids = roster.active.map((p) => p.id);
    await patchState({
      settings: nextSettings,
      totalScores: {},
      bankedRound: null,
      seenCategories: null,
      game: rules.startRound(ids.length ? ids : playerIds, {
        round: 0,
        cap: nextSettings.proposalCap,
        source: nextSettings.categorySource,
      }),
      view: 'round',
    });
  }, [isHost, patchState, roster, playerIds]);

  /**
   * THE TABLE PICKS: this device proposes a clause for the current target.
   *
   * ONE WRITE OF THE WHOLE NODE, deliberately: it replaces the previous
   * proposal AND its approvals in one go, so nothing approved for one clause can
   * survive onto another. Carries this device's own approval, under a fresh
   * nonce — proposing is approving.
   */
  const proposeCategory = useCallback(async (spec) => {
    const category = rules.toSpec(spec);
    if (!category || !roomCode || !myPlayerId || !game || !pickTargetId) return;
    if (pickTargetId === myPlayerId) return;
    const nonce = Math.random().toString(36).slice(2, 10);
    try {
      await set(ref(getFirebaseDb(), `rooms/${roomCode}/assignments/${pickTargetId}`), {
        category, by: myPlayerId, forRound: game.round, nonce, approvals: { [myPlayerId]: nonce },
      });
    } catch (e) {
      setSyncError(e?.message || 'Could not save that category — check your connection.');
    }
  }, [roomCode, myPlayerId, game, pickTargetId, setSyncError]);

  /** Approves — or takes back approval of — the proposal on screen. */
  const approveProposal = useCallback(async (approve) => {
    if (!roomCode || !myPlayerId || !pickTargetId || !proposal) return;
    try {
      await set(
        ref(getFirebaseDb(), `rooms/${roomCode}/assignments/${pickTargetId}/approvals/${myPlayerId}`),
        approve ? proposal.nonce : null,
      );
    } catch (e) {
      setSyncError(e?.message || 'Could not save your approval — check your connection.');
    }
  }, [roomCode, myPlayerId, pickTargetId, proposal, setSyncError]);

  const propose = useCallback((text) => (
    applyRound((g) => rules.proposeName(g, myPlayerId, text))
  ), [applyRound, myPlayerId]);

  const declare = useCallback((guess) => (
    applyRound((g) => rules.declareCategory(g, myPlayerId, guess))
  ), [applyRound, myPlayerId]);

  /**
   * This device rules.
   *
   * Recomputes the required list INSIDE the transaction rather than passing the
   * memo in, so the answer this write is checked against is the one the stored
   * round implies at the moment it lands — not the one this device rendered
   * some seconds ago with a different roster.
   *
   * Who may call this at all is requiredJudges' answer and this hook's job to
   * enforce — rules.judge deliberately takes no roster, for the reason stated
   * there. The screen only renders the buttons for a judge who owes an answer,
   * and rules.judge refuses anyone not on the list anyway.
   */
  const rule = useCallback((verdict) => (
    applyRound((g) => rules.judge(
      g, myPlayerId, verdict, rules.requiredJudges(g, playerIds, departedIds),
      // The roster again, for the seat rather than for the verdict: a settled
      // name hands the seat on, and rules.judge has no other way to know who
      // sits next. Resolved inside the transaction with everything else.
      playerIds, departedIds,
    ))
  ), [applyRound, myPlayerId, playerIds, departedIds]);

  const pass = useCallback(() => (
    applyRound((g) => rules.passTurn(g, myPlayerId))
  ), [applyRound, myPlayerId]);

  // The host's version, for a hot seat who has stopped responding without
  // disconnecting. A different rules function rather than pass-with-a-flag —
  // see rules.abandonTurn.
  const abandonTurn = useCallback(() => (
    applyRound((g) => rules.abandonTurn(g))
  ), [applyRound]);

  const nextTurn = useCallback(() => (
    applyRound((g) => rules.nextTurn(g, playerIds, departedIds))
  ), [applyRound, playerIds, departedIds]);

  const nextRound = useCallback(async () => {
    if (!isHost || !game) return;
    const ids = roster.activeIds.length ? roster.activeIds : playerIds;
    // The round's clauses, revealed on its results, join what the next random
    // deal leaves out. Local play has always excluded last round's; online the
    // deal used to exclude nothing, so a short game could hand a player the
    // clause they had just solved.
    const revealed = Object.values(game.results ?? {}).map((r) => r?.category).filter((c) => rules.toSpec(c));
    await patchState({
      seenCategories: [...(state?.seenCategories ?? []), ...revealed],
      game: rules.startRound(ids, {
        round: game.round + 1,
        // Both from the ROUND rather than from settings, so neither can drift
        // mid-session if the lobby is ever able to write settings again.
        cap: game.cap,
        source: game.source,
      }),
    });
  }, [isHost, game, state?.seenCategories, patchState, roster, playerIds]);

  const finish = useCallback(() => (
    isHost ? patchState({ view: 'results' }) : undefined
  ), [isHost, patchState]);

  // Back to the lobby with the settings intact, so a table can retune and go
  // again without re-entering the room code.
  const returnToLobby = useCallback(() => (
    isHost ? patchState({ view: 'lobby', game: null, bankedRound: null }) : undefined
  ), [isHost, patchState]);

  // --- locking a pick ------------------------------------------------------------
  //
  // Once every other active player has approved the proposal on screen, any
  // device that can see it locks it in — not only the host, who may be the
  // target and so cannot see it at all. Keyed on the nonce, so a
  // counter-proposal re-arms it, and the transaction re-checks that the target
  // is still the one being picked for, so two devices racing lock it once.
  // Opening the round rides in the same write when this was the last pick.
  useEffect(() => {
    if (!game || state?.view !== 'round' || game.phase !== 'picking') return;
    if (!allApproved || !pickTargetId || iAmPickTarget) return;
    const target = pickTargetId;
    once(`pick:${game.round}:${target}:${proposal.nonce}`, () => applyRound((g) => {
      if (rules.pickingFor(g, playerIds, departedIds) !== target) return { patch: {} };
      const picked = rules.recordPick(g, target);
      if (!Object.keys(picked.patch).length) return picked;
      const begun = rules.beginNaming({ ...g, ...picked.patch }, activeIds);
      return { patch: { ...picked.patch, ...begun.patch } };
    }));
  }, [game, state?.view, allApproved, pickTargetId, iAmPickTarget, proposal, once, applyRound,
      playerIds, departedIds, activeIds]);

  // --- opening the first go ------------------------------------------------------
  //
  // Normally the last lock opens it (above). This is the backstop for the one
  // case that does not: the last player still waiting for a clause LEAVES, so
  // "everyone here has one" becomes true with no pick at all. Host-only and
  // latched; the latch is safe against the roster shrinking further, because
  // "everyone here has a clause" over a smaller roster is still true.
  useEffect(() => {
    if (!isHost || !game || state?.view !== 'round') return;
    if (game.phase !== 'picking') return;
    if (!rules.everyonePicked(game, activeIds)) return;
    once(`begin:${game.round}`, () => applyRound((g) => rules.beginNaming(g, activeIds)));
  }, [isHost, game, state?.view, activeIds, once, applyRound]);

  // --- settling a pending nobody is left to answer ------------------------------
  //
  // THE ONE THING A DEPARTURE BREAKS THAT NO OTHER MECHANISM REPAIRS. Normally
  // rules.judge settles the moment the last required verdict lands, so this
  // never fires. But the required set SHRINKS when somebody leaves, so a
  // pending that could not settle a minute ago can settle now with no new
  // verdict at all — and nobody is going to submit one, because the device that
  // owed it is gone. See rules.settlePending.
  //
  // Deliberately NOT one-shotted and deliberately not host-only. The
  // transaction is idempotent (settlePending refuses outside `judging`) and
  // self-limiting — once it commits, the phase changes and this stops matching
  // — so the worst case is a few devices firing one aborted write each. A
  // `once` would need a key naming a pending, which has no id, and host-only
  // would break in exactly the case where the host is the one who left.
  useEffect(() => {
    if (!game || state?.view !== 'round' || game.phase !== 'judging') return;
    if (!game.pending) return;
    const required = rules.requiredJudges(game, playerIds, departedIds);
    const settleable = required.every((id) => typeof game.pending.verdicts?.[id] === 'boolean');
    if (!settleable) return;
    applyRound((g) => rules.settlePending(
      g, rules.requiredJudges(g, playerIds, departedIds), playerIds, departedIds,
    ));
  }, [game, state?.view, playerIds, departedIds, applyRound]);

  // --- publishing the answer --------------------------------------------------
  //
  // The hot seat's own device is DENIED their category, so at the end of their
  // round they are the one person who still does not know what it was. Any
  // other device may say, and the first to notice does — which is why this is
  // not gated on being the judge: a judge who leaves between ruling and
  // revealing costs nothing, and two devices racing write the same value once
  // (attachCategory refuses to overwrite).
  useEffect(() => {
    if (!game || game.phase !== 'turnEnd' || !seatId) return;
    if (iAmSeat || !seatCategory) return;
    if (game.results?.[seatId]?.category) return;
    once(`tell:${game.round}:${seatId}`, () => (
      applyRound((g) => rules.attachCategory(g, seatId, seatSpec?.category))
    ));
  }, [game, seatId, iAmSeat, seatCategory, seatSpec, once, applyRound]);

  // --- banking ----------------------------------------------------------------
  //
  // The host folds a finished round into the totals, claimed with a
  // compare-and-set so a re-render — or two devices racing — cannot double-count
  // an applyRoundScores that is deliberately not idempotent.
  useEffect(() => {
    if (!isHost || !roomCode || !game) return;
    if (game.phase !== 'roundEnd') return;
    if (state?.bankedRound === game.round) return;
    once(`bank:${game.round}`, async () => {
      const db = getFirebaseDb();
      const claim = await runTransaction(
        ref(db, `rooms/${roomCode}/state/bankedRound`),
        (cur) => (cur === game.round ? undefined : game.round),
      );
      if (!claim.committed) return;
      await patchState({
        totalScores: rules.applyRoundScores(
          state?.totalScores ?? {},
          rules.finalScores(game, playerIds),
        ),
      });
    });
  }, [isHost, roomCode, game, state, playerIds, patchState, once]);

  // --- departure reconciliation ----------------------------------------------
  //
  // The generic half (host migration, the one-shot itself) is useRoomCore's.
  // What stays here is deciding what an absence BROKE — and for AniTag that is
  // exactly ONE role. A departed JUDGE repairs itself: judgeIdFor derives the
  // role from the roster on every render, and a pending they owed is settled by
  // the settler above. A departed pick TARGET is skipped by pickingFor, and a
  // departed approver stops being counted. A departed spectator was never
  // blocking anything. Only the hot seat holds a turn nobody else can finish.
  //
  // Keyed on the seat as well as the round, so handing the turn to a successor
  // who then also leaves re-arms this rather than latching it closed.
  useEffect(() => {
    if (!game || !state || state.view !== 'round') return;
    if (game.phase === 'roundEnd') return;
    if (!game.seatId || !departedIds.includes(game.seatId)) return;
    once(`seat:${game.round}:${game.seatId}`, () => (
      applyRound((g) => rules.skipDepartedSeat(g, playerIds, departedIds))
    ));
  }, [game, state, departedIds, playerIds, once, applyRound]);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const toPlayers = useCallback(
    (ids) => ids.map((id) => byId.get(id)).filter(Boolean),
    [byId],
  );

  return {
    ...core,
    game,
    settings,
    tablePicks,
    phase: game?.phase ?? 'naming',
    seatId,
    iAmSeat,
    // Everyone who still owes an answer on the pending item — the one judge, as
    // a list (see rules.requiredJudges) — and whether this device is it.
    judgeIds,
    iMustRule,
    judges: toPlayers(judgeIds),
    pendingJudges: toPlayers(
      judgeIds.filter((id) => typeof game?.pending?.verdicts?.[id] !== 'boolean'),
    ),
    seat: byId.get(seatId) ?? null,
    // This device's own name, which useRoomCore does not return.
    myName: byId.get(myPlayerId)?.name ?? 'You',
    // Null on the hot seat's own device, always — and by a Firebase rule rather
    // than by this line. Every other device holds it from the deal or the pick.
    seatCategory,
    // THE TABLE PICKS: who for, the proposal on screen and its approvals. All
    // null or empty on the target's own device, which is refused the node.
    pickTarget: byId.get(pickTargetId) ?? null,
    iAmPickTarget,
    proposal: proposal ? getCategory(proposal.spec) : null,
    proposedBy: proposal?.by ? (byId.get(proposal.by)?.name ?? null) : null,
    approvedNames: toPlayers(approvedIds).map((p) => p.name),
    approvalsNeeded: approverIds.length,
    iApproved: !!proposal && !!myPlayerId && proposal.approvals[myPlayerId] === proposal.nonce,
    takenLabels,
    pickedCount: game ? activeIds.filter((id) => rules.hasPicked(game, id)).length : 0,
    // Whether this device has what it needs to play its part of the go. The seat
    // needs nothing; everyone else waits on the seat's clause, whether it was
    // dealt or picked. During the pick there is nothing to wait for — PickPhase
    // is the screen.
    dealReady: game?.phase === 'picking' || iAmSeat || !!seatCategory,
    pending: game?.pending ?? null,
    trail: game ? rules.trailFor(game, seatId) : [],
    // EVERY trail, not just the seat's — see the local hook for why. Public in
    // both, which is what makes handing the whole map to a screen safe: the
    // clauses are hidden and the evidence about them never was.
    trails: game?.trails ?? {},
    used: game ? rules.proposalsUsed(game, seatId) : 0,
    left: game ? rules.proposalsLeft(game, seatId) : 0,
    usedFor: (playerId) => (game ? rules.proposalsUsed(game, playerId) : 0),
    leftFor: (playerId) => (game ? rules.proposalsLeft(game, playerId) : 0),
    // The rotation, with departures marked — the one thing local play has no
    // equivalent of, and the reason this passes departedIds and that does not.
    order: (game ? rules.turnOrder(game, playerIds, departedIds) : []).map((row) => ({
      ...row, name: byId.get(row.playerId)?.name ?? 'Someone',
    })),
    lastPlayed: game?.lastPlayed ?? null,
    cap: game?.cap ?? 0,
    roundComplete: game ? rules.roundComplete(game, activeIds) : false,
    explain: game ? rules.explainRound(game, playerIds) : [],
    roundScores: game ? rules.finalScores(game, playerIds) : {},
    totalScores: state?.totalScores ?? {},
    roundNumber: (game?.round ?? 0) + 1,
    totalRounds: settings?.rounds ?? 0,
    isFinalRound: (game?.round ?? 0) + 1 >= (settings?.rounds ?? 0),
    startGame,
    proposeCategory,
    approveProposal,
    propose,
    declare,
    rule,
    pass,
    abandonTurn,
    nextTurn,
    nextRound,
    finish,
    returnToLobby,
  };
}
