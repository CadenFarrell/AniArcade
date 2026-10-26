import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ref, onValue, update, get, set, remove, runTransaction, query, orderByKey, endAt, limitToFirst,
} from 'firebase/database';
import { getFirebaseAuth, getFirebaseDb, ensureSignedIn } from '../services/firebase';
import { storage } from '../services/storage';
import { usePresence } from './usePresence';
import { GRACE_MS, rosterSnapshot, nextHostId, isLastToLeave } from '../utils/presence';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
const EMPTY_PLAYERS = []; // stable identity so the roster memo doesn't churn

function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

// How long a room may sit before anyone may delete it. Mirrors the 86400000 in
// database.rules.json — the rules are what enforce it; this only aims the query.
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
// The sweep asks for rooms a little older than the rules demand, so a device
// whose server-offset reading is a few seconds out cannot ask for one the rules
// still count as fresh — a query reaching past the gate is refused outright.
const SWEEP_MARGIN_MS = 5 * 60 * 1000;
const SWEEP_BATCH = 20;

// Rooms are deleted two ways, and neither needs a server of our own (the
// project stays on the free tier, so no Cloud Functions):
//
// - The last player to press Leave deletes the room on their way out
//   (leaveRoom, below).
// - Every other room — a tab closed mid-game, a table that wandered off — is
//   swept by the next device to create a room anywhere, once it is a day old.
//   Nothing can list rooms/ (a read there would cascade into every room's
//   secrets/), so createRoom also writes an index entry, and the index's rules
//   allow exactly one query: entries older than a day. Live codes stay
//   unlistable.
//
// The index entry is `roomIndex/{createdAt}_{code} → code`, keyed by the time
// as a 13-digit string, and that shape is forced. The obvious one —
// `roomIndex/{code} → createdAt`, queried orderByValue().endAt(cutoff) — cannot
// be gated: measured on the emulator, a rule comparing `query.endAt` (or
// `startAt`) to any NUMBER is refused, `query.endAt > 0` included. Compared as
// STRINGS it works, and equal-length digit strings sort the way the numbers do
// (until the year 2286), so the key carries the time and the query orders by
// key. The rules also check the key against rooms/{code}/createdAt, so nobody
// can file a live room as a stale one to get it swept.
//
// Each room used to live forever, holding a full copy of every player's
// profile, lists and all; on the free tier's 1 GB that only ever grew.
const indexKey = (createdAt, code) => `${createdAt}_${code}`;

async function deleteRoom(db, code, key = null) {
  // The leaver does not know when its room was made; anyone signed in may read
  // that, and the index entry is named by it.
  const entry = key ?? indexKey((await get(ref(db, `rooms/${code}/createdAt`))).val(), code);
  // The room first: the index entry's delete rule asks that the room be gone.
  await remove(ref(db, `rooms/${code}`));
  await remove(ref(db, `roomIndex/${entry}`));
}

async function sweepStaleRooms(db, serverNow) {
  const cutoff = String(serverNow - ROOM_TTL_MS - SWEEP_MARGIN_MS);
  const snap = await get(query(ref(db, 'roomIndex'), orderByKey(), endAt(cutoff), limitToFirst(SWEEP_BATCH)));
  const entries = Object.entries(snap.val() ?? {});
  // One at a time, and each on its own: a room someone else swept a moment ago
  // fails its delete, which must not stop the rest.
  for (const [key, code] of entries) {
    try { await deleteRoom(db, code, key); } catch { /* raced, or already gone */ }
  }
  return entries.length;
}

// A refusal from the rules. Firebase reports it as code PERMISSION_DENIED on
// some calls and only in the message on others.
const isPermissionDenied = (e) => /permission/i.test(`${e?.code ?? ''} ${e?.message ?? ''}`);

// Forces a fresh ID token. The database connection re-authenticates whenever
// the token changes, which is the point: see joinRoom.
async function refreshAuthToken() {
  try {
    await getFirebaseAuth()?.currentUser?.getIdToken(true);
  } catch {
    // Offline or signed out: the retry fails the same way and says so.
  }
}

function readPath(obj, path) {
  return path.split('/').reduce((o, k) => (o == null ? o : o[k]), obj);
}

// Everything every online game needs from a room and nothing any one game needs
// alone: claiming a code, the membership/claims dance, the state subscription,
// who is still connected, and the one-shot helper the departure-reconciliation
// effects are built on. Both AniGuess and AniTune grew their own copy of this
// first; the copies had drifted (AniTune's host migration was the weaker of the
// two) which is exactly the failure mode this prevents.
//
// What stays in the game's own hook: its rules bindings, and its
// departure-reconciliation effect — noticing *that* someone left is generic,
// deciding what their absence broke is not.
//
// Options:
//   storageKey    per-game localStorage key. Per-game so two games' saved rooms
//                 can't clobber each other.
//   playersPath   where the roster lives under state/. AniGuess keeps it at
//                 'gameSession/players', AniTune at 'players'; both the join
//                 transaction and the roster read follow this.
//   initialState  (hostProfile) => the state/ subtree a new room starts with.
//   normalizeState (raw) => repaired state. Realtime Database does not store
//                 empty objects/arrays, so a {} or [] write simply doesn't
//                 exist on read-back. This runs at the single point state
//                 enters the hook, so nothing downstream — least of all
//                 rules.js, which calls .includes/.every unguarded — ever sees
//                 undefined where it expects a collection.
//   onExitRoom    optional: clear game-local state that isn't derived from the
//                 room (AniTune's in-progress "finding songs" flags).
export function useRoomCore({
  storageKey,
  playersPath = 'players',
  initialState,
  normalizeState,
  onExitRoom,
}) {
  const [uid, setUid] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [state, setState] = useState(null); // normalized /rooms/{code}/state subtree
  const [serverOffset, setServerOffset] = useState(0); // Firebase server clock skew, ms
  const [error, setError] = useState(''); // fatal: can't reach Firebase / room gone
  const [syncError, setSyncError] = useState(''); // transient: a write failed

  // Held in refs so exitRoom and the subscription keep a stable identity — a
  // caller passing an inline arrow would otherwise re-subscribe every render.
  const normalizeRef = useRef(normalizeState);
  useEffect(() => { normalizeRef.current = normalizeState; }, [normalizeState]);
  const onExitRef = useRef(onExitRoom);
  useEffect(() => { onExitRef.current = onExitRoom; }, [onExitRoom]);

  // Effects that schedule against server time read the offset through a ref so
  // they don't re-run every time it drifts by a millisecond.
  const serverOffsetRef = useRef(0);
  useEffect(() => { serverOffsetRef.current = serverOffset; }, [serverOffset]);

  const forgetSavedRoom = useCallback(() => storage.removeItem(storageKey), [storageKey]);

  const exitRoom = useCallback(() => {
    forgetSavedRoom();
    setRoomCode(null);
    setMyPlayerId(null);
    setState(null);
    onExitRef.current?.();
  }, [forgetSavedRoom]);

  // Sign in, then restore a saved room if there is one.
  const restoredRef = useRef(false);
  useEffect(() => {
    ensureSignedIn()
      .then((u) => {
        setUid(u);
        if (restoredRef.current) return;
        restoredRef.current = true;
        const saved = storage.getItem(storageKey);
        if (saved?.roomCode && saved?.playerId) {
          setRoomCode(saved.roomCode);
          setMyPlayerId(saved.playerId);
        }
      })
      .catch((e) => setError(e.message));
  }, [storageKey]);

  // Presence timestamps are stamped with the server's clock, so any window
  // measured against them has to use the server's clock too.
  useEffect(() => {
    const db = getFirebaseDb();
    const unsub = onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
      setServerOffset(snap.val() || 0);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    const db = getFirebaseDb();
    const stateRef = ref(db, `rooms/${roomCode}/state`);
    const unsubscribe = onValue(
      stateRef,
      (snap) => {
        const val = snap.val();
        if (!val) {
          // The room was deleted (or a saved code went stale) — don't strand
          // the player on a loading screen.
          exitRoom();
          setError('That room no longer exists. Create or join another one.');
          return;
        }
        setState(normalizeRef.current(val));
      },
      () => {
        // Permission denied — usually a saved room this device's uid no longer
        // has membership in (browser storage cleared, different profile).
        exitRoom();
        setError('Lost access to that room. Rejoin with the room code.');
      }
    );
    return () => unsubscribe();
  }, [roomCode, exitRoom]);

  // --- Who is still here -----------------------------------------------------

  // Publishes this device's presence and, crucially, arranges for Firebase to
  // mark it offline server-side when the tab closes or the network drops. Every
  // readiness gate in every game counts the roster, so a player who vanishes
  // stops the room dead unless the gates can see they've gone.
  const markLeft = usePresence(
    roomCode && myPlayerId ? `rooms/${roomCode}/state/presence/${myPlayerId}` : null
  );

  const presence = state?.presence ?? null;
  const players = readPath(state, playersPath) ?? EMPTY_PLAYERS;

  const [now, setNow] = useState(() => Date.now());
  const roster = useMemo(
    () => rosterSnapshot(players, presence ?? {}, now + serverOffset),
    [players, presence, now, serverOffset]
  );
  const rosterRef = useRef(roster);
  useEffect(() => { rosterRef.current = roster; }, [roster]);

  // A grace window expires without any database write, so it needs a clock —
  // but only while someone is mid-drop, so an idle room isn't re-rendering once
  // a second for the whole game. The stored `now` may be stale when the timer
  // starts, which only ever makes a player look *less* gone than they are; the
  // first tick corrects it, and graceRemainingMs clamps the countdown meanwhile.
  const someoneDropping = roster.dropping.length > 0;
  useEffect(() => {
    if (!someoneDropping) return undefined;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    // Hidden tabs have their timers throttled hard (Chrome drops to roughly one
    // wake-up a minute after a few minutes backgrounded), so someone coming back
    // from another app would otherwise stare at a frozen countdown until the
    // next throttled tick. Re-read the clock the instant they return.
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [someoneDropping]);

  // --- Who is in charge ------------------------------------------------------
  //
  // The host owns the settings, the Start button, and the round-end decision.
  //
  // Rooms created before the host role existed carry no hostId, and without a
  // fallback their lobby would be unstartable by anyone, forever. Fall back to
  // players[0] — the creator, since joinRoom only ever appends. Deliberately
  // *not* derived from the roster: presence status is time-based, so two
  // devices a few hundred ms apart could disagree about who the heir is and
  // both render a Start button. players[0] is a pure function of shared state,
  // so it cannot diverge. The migration effect below backfills a real hostId,
  // which is what makes the crown sticky once it has moved.
  const hostId = state?.hostId ?? players[0]?.id ?? null;
  const isHost = myPlayerId != null && hostId === myPlayerId;
  // Lobbies and round-end screens name the host, so resolve it once here
  // instead of repeating the lookup in each component.
  const hostName = players.find((p) => p.id === hostId)?.name ?? '';

  // --- Writes ----------------------------------------------------------------

  // Every mutation funnels through here so a rejected/offline write surfaces in
  // the UI instead of becoming a silent unhandled rejection.
  const guard = useCallback((promise) => {
    return Promise.resolve(promise).catch((e) => {
      setSyncError(e?.message || 'Could not sync with the room — check your connection.');
    });
  }, []);

  const dismissSyncError = useCallback(() => setSyncError(''), []);
  const dismissError = useCallback(() => setError(''), []);

  // The `open` flag and the pre-join `claims` read both depend on rules added
  // in database.rules.json after the first release. Until those are deployed
  // the paths are denied, so treat a failure as "unknown" and fall back to the
  // older, more permissive behaviour instead of blocking play outright.
  const bestEffort = useCallback(async (promise, fallback = undefined) => {
    try {
      return await promise;
    } catch {
      return fallback;
    }
  }, []);

  const rememberRoom = useCallback((code, playerId) => {
    storage.setItem(storageKey, { roomCode: code, playerId });
  }, [storageKey]);

  const initialStateRef = useRef(initialState);
  useEffect(() => { initialStateRef.current = initialState; }, [initialState]);

  const createRoom = useCallback(async (localProfile) => {
    // Both entry points may be clicked before anonymous sign-in has resolved;
    // without this the writes below would build a `.../memberUids/null` path.
    const myUid = uid ?? await ensureSignedIn();
    if (myUid !== uid) setUid(myUid);

    const db = getFirebaseDb();
    let code = null;
    let createdAt = null;
    for (let attempt = 0; attempt < 6 && !code; attempt++) {
      const candidate = generateRoomCode();
      // Server time, because the rules age a room against the server's `now`:
      // a phone whose clock runs a day fast would otherwise mint rooms the sweep
      // is allowed to take at once.
      const stamp = Date.now() + serverOffsetRef.current;
      const result = await runTransaction(ref(db, `rooms/${candidate}/createdAt`), (current) => {
        if (current !== null) return; // abort — code already taken
        return stamp;
      });
      if (result.committed) {
        code = candidate;
        createdAt = result.snapshot.val();
      }
    }
    if (!code) throw new Error('Could not create a room — please try again.');
    // Its own write after the claim, never in one batch with it: the index
    // rule checks the key against rooms/{code}/createdAt, and a batch is
    // judged against the tree as it stood before the batch.
    await bestEffort(set(ref(db, `roomIndex/${indexKey(createdAt, code)}`), code));

    // Firebase evaluates each path's rule in a multi-location update() against
    // the pre-update tree, not the merged result — so writing memberUids and
    // claims/state (whose rules depend on memberUids already existing) in one
    // batch fails. Write memberUids first and await it so the dependent
    // writes see it as already-committed.
    const playerId = localProfile.id;
    await update(ref(db), { [`rooms/${code}/memberUids/${myUid}`]: playerId });
    await update(ref(db), {
      [`rooms/${code}/claims/${playerId}`]: myUid,
      // The creator is the host: the only player who picks the settings, starts
      // the game, and decides at round end whether to keep playing. Stored in
      // shared state rather than derived per-device so everyone defers to the
      // same person — and stored as the *profile* id, because that is what
      // presence, claims and the turn rotation are all keyed by. The Firebase
      // uid never appears inside state/.
      [`rooms/${code}/state`]: initialStateRef.current(localProfile),
    });
    await bestEffort(set(ref(db, `rooms/${code}/open`), true));
    rememberRoom(code, playerId);
    setRoomCode(code);
    setMyPlayerId(playerId);
    // Not awaited: tidying up other people's dead rooms must never hold up
    // this one opening.
    sweepStaleRooms(db, Date.now() + serverOffsetRef.current).catch(() => {});
    return code;
  }, [uid, rememberRoom, bestEffort]);

  const joinOnce = useCallback(async (rawCode, localProfile) => {
    const myUid = uid ?? await ensureSignedIn();
    if (myUid !== uid) setUid(myUid);

    const db = getFirebaseDb();
    const code = rawCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) throw new Error('Room codes are 5 letters/numbers.');
    const createdSnap = await get(ref(db, `rooms/${code}/createdAt`));
    if (!createdSnap.exists()) throw new Error(`Room "${code}" not found.`);

    const playerId = localProfile.id;

    // Player ids are derived from the name, so two different people using the
    // same name would silently share one slot. Check the claim BEFORE writing
    // memberUids — that mapping is write-once, so a wrong guess here would
    // lock this device out of the room for good.
    const claimSnap = await bestEffort(get(ref(db, `rooms/${code}/claims/${playerId}`)));
    const claimedBy = claimSnap?.val() ?? null;
    const isRejoin = claimedBy === myUid;
    if (claimedBy && !isRejoin) {
      throw new Error(`"${localProfile.name}" is already playing in that room from another device. Use a different name.`);
    }

    // Late joins would leave the newcomer out of whatever the round already
    // dealt, so only let existing players back in once it has started.
    const openSnap = await bestEffort(get(ref(db, `rooms/${code}/open`)));
    if (openSnap?.val() === false && !isRejoin) {
      throw new Error(`Room "${code}" has already started its game.`);
    }

    await update(ref(db), { [`rooms/${code}/memberUids/${myUid}`]: playerId });
    if (!isRejoin) await update(ref(db), { [`rooms/${code}/claims/${playerId}`]: myUid });

    // Transactional so two people joining at the same moment can't clobber each
    // other's append. Rejoining refreshes the stored profile, picking up any
    // characters imported since.
    await runTransaction(ref(db, `rooms/${code}/state/${playersPath}`), (current) => {
      const list = current || [];
      const idx = list.findIndex((p) => p.id === playerId);
      if (idx === -1) return [...list, localProfile];
      const next = [...list];
      next[idx] = localProfile;
      return next;
    });

    rememberRoom(code, playerId);
    setRoomCode(code);
    setMyPlayerId(playerId);
  }, [uid, rememberRoom, bestEffort, playersPath]);

  // A join refused by the rules gets one retry on a fresh token. Found by the
  // AniTurf playtest: with three guests joining at once, one device could hold
  // a signed-in user while its database connection still evaluated as signed
  // out — its very first read (`createdAt`, readable by anyone signed in) came
  // back "Permission denied", and so did every press of Join after it, because
  // nothing made the connection pick up the token. A forced token refresh is
  // what makes the database re-authenticate. Every step of a join is safe to
  // repeat (memberUids and claims accept the same value again, the roster
  // write is a transaction), so retrying the whole of it is too.
  const joinRoom = useCallback(async (rawCode, localProfile) => {
    try {
      return await joinOnce(rawCode, localProfile);
    } catch (e) {
      if (!isPermissionDenied(e)) throw e;
      await refreshAuthToken();
      return joinOnce(rawCode, localProfile);
    }
  }, [joinOnce]);

  // Tell the room on the way out — but never let a slow network trap someone in
  // a room they've asked to leave, so the local exit doesn't wait on the write.
  //
  // The last one out deletes the room — after the presence write, so nothing is
  // still writing into it, and after exitRoom, so this device's own
  // subscription is already gone and doesn't report the deletion as "That room
  // no longer exists". "Last" counts only players who pressed Leave
  // (isLastToLeave): a crashed one may still refresh back in.
  const leaveRoom = useCallback(() => {
    const code = roomCode;
    const last = code != null && myPlayerId != null && isLastToLeave(rosterRef.current.statuses, myPlayerId);
    const written = markLeft();
    exitRoom();
    if (!last) return written;
    return written.then(() => deleteRoom(getFirebaseDb(), code)).catch(() => {});
  }, [roomCode, myPlayerId, markLeft, exitRoom]);

  // Republishes this device's profile into the room — used when a player
  // imports their AniList from the lobby after already joining. Transactional
  // so it can't clobber someone else joining at the same moment.
  const updateMyProfile = useCallback((profile) => {
    const db = getFirebaseDb();
    return guard(runTransaction(ref(db, `rooms/${roomCode}/state/${playersPath}`), (current) => {
      const list = current || [];
      const idx = list.findIndex((p) => p.id === profile.id);
      if (idx === -1) return list;
      const next = [...list];
      next[idx] = profile;
      return next;
    }));
  }, [roomCode, guard, playersPath]);

  const patchState = useCallback((patch) => {
    if (!roomCode) return Promise.resolve();
    const db = getFirebaseDb();
    const updates = {};
    for (const [key, value] of Object.entries(patch)) {
      updates[`rooms/${roomCode}/state/${key}`] = value;
    }
    return guard(update(ref(db), updates));
  }, [roomCode, guard]);

  const setView = useCallback((view) => patchState({ view }), [patchState]);

  // --- Departure reconciliation ----------------------------------------------
  //
  // The shared half. Effects that notice a player is gone and unstick whatever
  // they were blocking are per-game (only the game knows what an absence
  // broke), but they all need this one-shot and they all need the crown to
  // move first. Any device may run them: the state each one writes is derived
  // from shared state plus the shared roster, so two devices racing compute the
  // identical patch. The one-shot keys stop a single device retrying every
  // render, and re-arm when the roster or the phase moves on.
  const reconciledRef = useRef({});
  const once = useCallback((key, run) => {
    if (reconciledRef.current[key]) return;
    reconciledRef.current[key] = true;
    // A dropped connection is exactly when these run, so a failed write has to
    // re-arm rather than latch — otherwise one unlucky moment leaves the room
    // wedged with no second attempt. Returning false asks for the same.
    Promise.resolve()
      .then(run)
      .then((ok) => { if (ok === false) delete reconciledRef.current[key]; })
      .catch(() => { delete reconciledRef.current[key]; });
  }, []);

  // Every guard is scoped to one phase, so a phase change re-arms them all.
  // Without this a one-shot that has already fired stays latched for the life
  // of the room — and the next time the room genuinely needed it, nothing would
  // happen. The host-migration key below is the one exception: it encodes the
  // outgoing host instead, because a lobby can need to migrate twice without
  // the view ever changing.
  useEffect(() => { reconciledRef.current = {}; }, [roomCode, state?.view]);

  // The crown has to move before anything else: the host is the only one who
  // can start the game or move past a round end, so a room whose host has gone
  // is wedged until it does. Deliberately its own effect with no phase filter —
  // the lobby needs this most of all, being the one phase a room can sit in
  // indefinitely.
  //
  // Compares the *stored* hostId, never the derived one: in a legacy room the
  // derived value is players[0], and a transaction testing against that would
  // abort forever against the null actually in the tree.
  useEffect(() => {
    if (!roomCode || !state || !myPlayerId) return;
    const storedHostId = state.hostId ?? null;
    const needsHost = storedHostId === null
      // No crown was ever written (the room predates the host role). Claim one,
      // or its lobby stays unstartable for everyone.
      ? players.length > 0
      // Only migrate a host who is genuinely in the roster and genuinely gone.
      // activeIds still counts a player mid-drop, so this waits out the grace
      // window rather than moving the crown over a wifi blip.
      : players.some((p) => p.id === storedHostId) && !roster.activeIds.includes(storedHostId);
    if (!needsHost) return;

    const heir = nextHostId(players, roster.statuses);
    if (!heir || heir === storedHostId) return;
    // Keyed on the outgoing host so a second departure re-arms it — the
    // one-shot reset above is keyed on `view`, which never changes while a room
    // sits in the lobby. Every device races here; the compare-and-set picks
    // exactly one winner, so a slower device can't clobber a crown that has
    // already legitimately moved on.
    once(`host:${storedHostId ?? 'unset'}`, () => {
      const db = getFirebaseDb();
      return runTransaction(ref(db, `rooms/${roomCode}/state/hostId`), (cur) =>
        ((cur ?? null) === storedHostId ? heir : undefined)
      ).catch(() => {});
    });
  }, [roomCode, state, myPlayerId, players, roster, once]);

  return {
    uid, roomCode, myPlayerId, state, serverOffset, serverOffsetRef,
    // setSyncError for the rare caller that needs to report a failure *and*
    // return a value (guard() swallows the result); dismissSyncError for the UI.
    error, syncError, setSyncError, dismissError, dismissSyncError,
    createRoom, joinRoom, leaveRoom, exitRoom, updateMyProfile,
    patchState, setView, guard, bestEffort, once,
    view: state?.view,
    hostId, isHost, hostName,
    players,
    // The roster minus anyone who left or timed out. Components should count
    // these, not `players`, for anything the room has to wait on.
    activePlayers: roster.active,
    activeIds: roster.activeIds,
    departedIds: roster.departedIds,
    playerStatuses: roster.statuses,
    dropping: roster.dropping,
    roster, rosterRef,
    graceMs: GRACE_MS,
  };
}
