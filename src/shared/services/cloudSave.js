// Backup codes: the network half (the pure half and the why are in
// utils/cloudSave.js). Everything here goes through storage.js and a LAZY
// Firebase import, so:
//
// - a player who never turns backup on never downloads Firebase, and local
//   play keeps its "no third-party network" property (root CLAUDE.md);
// - the smoke suite's per-device mocks of firebase.js and storage.js reach this
//   module exactly as they reach the room hooks.
//
// RTDB holds `saves/{code}/data` (the whole save, one JSON string) and
// `saves/{code}/updatedAt` (server time of the last write). Every sync reads
// `updatedAt` first and fetches `data` only when it moved since this device
// last saw it, so an ordinary page load costs a few bytes rather than the whole
// save — the save is every profile's list, and the Spark tier's download
// allowance is 10 GB a month for the whole arcade.
//
// No transaction. Two devices pushing at the same moment can each overwrite the
// other's write, but every push MERGES first and each device still holds its own
// data locally, so the loser's next sync (which sees `updatedAt` moved) folds
// its changes back in. A transaction would hold a megabyte string in a retry
// loop to win a race that repairs itself.
import { storage } from './storage';
import { firebaseEnabled } from './firebaseConfig';
import { ACTIVE_PROFILE_KEY, PROFILES_KEY } from '../hooks/useProfile';
import { HISTORY_KEY } from '../utils/history';
import {
  cleanSave, countNewProfiles, makeCode, mergeSaves, normalizeCode, parseSave, serializeSave, hashSave,
} from '../utils/cloudSave';

// In PRESERVED_KEYS (utils/resetKeys.js): losing the code is losing the backup.
export const CLOUD_KEY = 'aniarcade_cloud_save';
// database.rules.json refuses a `data` string this long; checked here too, so a
// save that big says so instead of failing as a permission error.
export const MAX_SAVE_CHARS = 5_000_000;
const TIMEOUT_MS = 15_000;

export const cloudSaveAvailable = firebaseEnabled;

// ---- This device's link to its backup ------------------------------------
//
// `{ code, syncedAt, syncedHash, lastSyncedAt, deleted }`:
//   syncedAt     the save's server `updatedAt` as of this device's last sync —
//                "has anyone else written since?" is `updatedAt !== syncedAt`
//   syncedHash   hashSave of what that sync left, so "have I changed since?"
//                needs no second copy of the save in localStorage
//   lastSyncedAt this device's clock, for the "Backed up 2m ago" line
//   deleted      delete markers not yet folded into a sync (utils/cloudSave.js)

export function readCloudState() {
  const raw = storage.getItem(CLOUD_KEY);
  const code = normalizeCode(raw?.code);
  if (!code) return { code: null, syncedAt: null, syncedHash: null, lastSyncedAt: null, deleted: {} };
  return {
    code,
    syncedAt: typeof raw.syncedAt === 'number' ? raw.syncedAt : null,
    syncedHash: typeof raw.syncedHash === 'string' ? raw.syncedHash : null,
    lastSyncedAt: typeof raw.lastSyncedAt === 'number' ? raw.lastSyncedAt : null,
    deleted: cleanSave({ deleted: raw.deleted }).deleted,
  };
}

function writeCloudState(state) {
  if (state?.code) storage.setItem(CLOUD_KEY, state);
  else storage.removeItem(CLOUD_KEY);
}

// Called by ProfileProvider when a profile is deleted. Only while backup is on:
// a marker exists to stop another device's copy coming back, and with no
// backup there is no other device.
export function recordDeletion(id) {
  const state = readCloudState();
  if (!state.code) return;
  writeCloudState({ ...state, deleted: { ...state.deleted, [id]: Date.now() } });
}

// "Something the backup holds just changed." A module-level signal rather than
// context, because one of the writers — useRecordResult — is a storage-only
// hook with no provider (see that file), and it is the provider below that
// decides what a change costs.
const listeners = new Set();
export function onLocalChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function notifyLocalChange() {
  for (const fn of listeners) fn();
}

// ---- The local half of a save --------------------------------------------

function readLocalSave(deleted) {
  return cleanSave({
    profiles: storage.getItem(PROFILES_KEY) ?? {},
    activeId: storage.getItem(ACTIVE_PROFILE_KEY) ?? null,
    history: storage.getItem(HISTORY_KEY) ?? {},
    deleted,
  });
}

// The main-profile pointer is written only onto a device that has none (see
// mergeSaves): which profile is "me" belongs to the device.
function writeLocalSave(local, merged) {
  const ok = storage.setItem(PROFILES_KEY, merged.profiles)
    && storage.setItem(HISTORY_KEY, merged.history);
  if (ok && !local.activeId && merged.activeId) storage.setItem(ACTIVE_PROFILE_KEY, merged.activeId);
  return ok;
}

// ---- Network ---------------------------------------------------------------

async function connect() {
  const [{ getFirebaseDb, ensureSignedIn }, rtdb] = await Promise.all([
    import('./firebase'),
    import('firebase/database'),
  ]);
  await ensureSignedIn();
  return { db: getFirebaseDb(), rtdb };
}

// RTDB's get() on a dead connection does not fail, it waits — for as long as it
// takes the socket to come back. A sync has to give up and say "offline".
function withTimeout(promise) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('Backup timed out'), { offline: true })), TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function syncOnce(state, { mustExist }) {
  const { db, rtdb } = await connect();
  const base = rtdb.ref(db, `saves/${state.code}`);
  const stamp = await rtdb.get(rtdb.child(base, 'updatedAt'));
  const remoteAt = stamp.exists() ? stamp.val() : null;
  if (remoteAt == null && mustExist) return { status: 'not-found' };

  let remote = null;
  if (remoteAt != null && remoteAt !== state.syncedAt) {
    remote = parseSave((await rtdb.get(rtdb.child(base, 'data'))).val() ?? '') ?? cleanSave({});
  }

  // Local is read only now, after the waits, and written in the same tick, so
  // an edit made while the download was in flight is merged rather than
  // overwritten.
  const local = readLocalSave(state.deleted);
  const merged = remote ? mergeSaves(local, remote) : local;
  const text = serializeSave(merged);
  const hash = hashSave(text);
  let localChanged = false;
  if (remote && serializeSave(local) !== text) {
    if (!writeLocalSave(local, merged)) return { status: 'error', reason: 'storage' };
    localChanged = true;
  }

  const needsPush = remote ? serializeSave(remote) !== text : (remoteAt == null || hash !== state.syncedHash);
  let syncedAt = remoteAt;
  if (needsPush) {
    if (text.length > MAX_SAVE_CHARS) return { status: 'error', reason: 'too-big' };
    await rtdb.set(base, { data: text, updatedAt: rtdb.serverTimestamp() });
    syncedAt = (await rtdb.get(rtdb.child(base, 'updatedAt'))).val();
  }
  return { status: 'ok', syncedAt, syncedHash: hash, localChanged, before: local, merged };
}

// One sync at a time per page: a debounced push, a visibility pull and a
// restore can all ask at once, and two overlapping syncs would each merge
// without the other's write.
let chain = Promise.resolve();

/**
 * Pull, merge, push. Resolves (never rejects) with `{ status }`:
 *   'off'        backup is not on here
 *   'ok'         in step; `localChanged` says whether this device's storage
 *                was rewritten from the backup (the caller re-reads it)
 *   'not-found'  `mustExist` and there is no backup under the code
 *   'offline'    no connection, or no answer within TIMEOUT_MS
 *   'error'      anything else (`reason`: 'storage' | 'too-big')
 */
export function syncNow({ mustExist = false } = {}) {
  const run = chain.then(async () => {
    const state = readCloudState();
    if (!state.code) return { status: 'off' };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 'offline' };
    try {
      const result = await withTimeout(syncOnce(state, { mustExist }));
      if (result.status !== 'ok') return result;
      // Backup may have been switched off while the sync was out.
      const now = readCloudState();
      if (now.code !== state.code) return { status: 'off' };
      // Markers recorded during the sync are kept beside the merged ones, or a
      // profile deleted mid-push would lose the marker that keeps it deleted.
      const deleted = { ...result.merged.deleted };
      for (const [id, at] of Object.entries(now.deleted)) deleted[id] = Math.max(at, deleted[id] ?? 0);
      writeCloudState({
        ...now, syncedAt: result.syncedAt, syncedHash: result.syncedHash, lastSyncedAt: Date.now(), deleted,
      });
      return result;
    } catch (err) {
      if (!err?.offline) console.error('Backup sync failed', err);
      return { status: err?.offline ? 'offline' : 'error', reason: err?.code ?? null };
    }
  });
  chain = run;
  return run;
}

// Turn backup on for this device: a new code, and everything here pushed under
// it. The code is kept even if the first push cannot reach the server — the
// status line says so, and the next sync sends it.
export async function enableBackup() {
  const existing = readCloudState();
  if (existing.code) return { code: existing.code, ...(await syncNow()) };
  const code = makeCode();
  writeCloudState({ code, syncedAt: null, syncedHash: null, lastSyncedAt: null, deleted: {} });
  return { code, ...(await syncNow()) };
}

/**
 * Link this device to an existing backup and merge it in. Adds to what is here;
 * never replaces it. `{ status, restored }`, where `restored` counts the profiles
 * this device did not already have. Anything short of 'ok' puts the device's
 * previous link back, so a mistyped code cannot unlink a working one.
 */
export async function restoreBackup(input) {
  const code = normalizeCode(input);
  if (!code) return { status: 'invalid' };
  const previous = readCloudState();
  writeCloudState({
    code, syncedAt: null, syncedHash: null, lastSyncedAt: null,
    deleted: previous.code === code ? previous.deleted : {},
  });
  const result = await syncNow({ mustExist: true });
  if (result.status !== 'ok') {
    writeCloudState(previous);
    return result;
  }
  return { ...result, code, restored: countNewProfiles(result.before, result.merged) };
}

// Stop syncing here. The backup itself stays — other devices may still use it —
// and so does everything on this device.
export function disconnectBackup() {
  writeCloudState(null);
}
