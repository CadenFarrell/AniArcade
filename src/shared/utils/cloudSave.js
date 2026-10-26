// Backup codes: the pure half. The network half is services/cloudSave.js and
// the React half context/CloudSaveProvider.jsx.
//
// A backup code is an account with no sign-in. Turning backup on mints a long
// random code and keeps a copy of everything the player owns on this device —
// every profile, the main-profile pointer, the play history — in RTDB under
// `saves/{code}`; entering the code (or opening its link) on another device
// merges that copy in and keeps the two in step from then on. Nobody can list
// `saves/`, so the code is the whole key, which is why it is long enough that it
// cannot be guessed and why the screens tell the player to keep it.
//
// Explicit `.js` extensions, like history.js: a smoke test imports this beside
// the emulator, and keeping the module Node-clean costs nothing.

import { CODE_CHARS } from './codeAlphabet.js';
import { MAX_PER_PROFILE, normalizeHistory } from './history.js';

export const CODE_LENGTH = 16;
export const RESTORE_PARAM = 'restore';
export const SAVE_VERSION = 1;
// Delete markers are tiny, but they never expire on their own, so a device that
// churns through guest profiles should not grow the save forever.
const MAX_DELETED = 200;

const CODE_RE = new RegExp(`^[${CODE_CHARS}]{${CODE_LENGTH}}$`);

// crypto.getRandomValues, never Math.random: the code is the only thing
// guarding a backup, so it has to be unpredictable, not merely spread out.
// 32 symbols is 5 bits a byte with no modulo bias (codeAlphabet.js).
export function makeCode(randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  return Array.from(randomBytes(CODE_LENGTH), (b) => CODE_CHARS[b & 31]).join('');
}

// What a player typed or pasted — lower case, dashes, spaces, the grouped form
// formatCode shows — down to the stored 16 characters, or null if it cannot be
// a code. Refused here rather than sent off to miss, so a typo says "that isn't
// a code" instead of "no backup found".
export function normalizeCode(input) {
  const code = String(input ?? '').toUpperCase().replace(/[\s-]/g, '');
  return CODE_RE.test(code) ? code : null;
}

// XXXX-XXXX-XXXX-XXXX: four groups are what a person can hold while copying
// the code by hand off another screen.
export function formatCode(code) {
  return String(code ?? '').match(/.{1,4}/g)?.join('-') ?? '';
}

// ---- Restore links ------------------------------------------------------
//
// `/?restore=<CODE>`: the low-effort way across. Copy it on the laptop, open it
// on the phone, and the phone is linked. Modelled on inviteLink.js — read once,
// then taken off the address bar so a refresh does not restore again.

export function buildRestoreUrl(base, code) {
  const url = new URL('/', base);
  url.searchParams.set(RESTORE_PARAM, formatCode(code));
  return url.toString();
}

export function readRestore(search) {
  const raw = new URLSearchParams(search).get(RESTORE_PARAM);
  return raw == null ? null : normalizeCode(raw);
}

export function stripRestore(href) {
  const url = new URL(href);
  if (!url.searchParams.has(RESTORE_PARAM)) return null;
  url.searchParams.delete(RESTORE_PARAM);
  return url.toString();
}

// ---- The save -----------------------------------------------------------
//
// Stored as ONE JSON string, not as an RTDB tree, and that decision dodges every
// trap the room hooks document in turn: RTDB drops empty arrays and objects
// (a profile's `characters: []`, the checklist's import ids), returns a gappy
// array as one of three shapes, refuses `undefined`, and refuses `.`, `/`, `#`,
// `$`, `[` and `]` in a key — and a profile id is a folded NAME
// (profileIdFromName), so "Dr. Stone fan" is a perfectly good id and an illegal
// RTDB key. A string round-trips exactly. The save is read and written whole
// anyway, so a tree would buy nothing.

const sortedObject = (obj) =>
  Object.fromEntries(Object.keys(obj ?? {}).sort().map((k) => [k, obj[k]]));

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

// Repairs a save's shape the way normalizeHistory repairs history: one bad part
// costs that part, never the restore. Profiles are only checked for being
// objects with an id; normalizeProfile fixes the rest on its next read, as it
// does for everything in localStorage.
export function cleanSave(raw) {
  const save = isPlainObject(raw) ? raw : {};
  const profiles = {};
  if (isPlainObject(save.profiles)) {
    for (const [id, p] of Object.entries(save.profiles)) {
      if (isPlainObject(p) && p.id === id) profiles[id] = p;
    }
  }
  const deleted = {};
  if (isPlainObject(save.deleted)) {
    for (const [id, at] of Object.entries(save.deleted)) {
      if (typeof at === 'number' && Number.isFinite(at)) deleted[id] = at;
    }
  }
  return {
    profiles,
    activeId: typeof save.activeId === 'string' ? save.activeId : null,
    history: normalizeHistory(save.history),
    deleted,
  };
}

// Keys sorted, so two devices holding the same data write the same string and
// the "did anything change" check is a string comparison.
export function serializeSave(save) {
  const clean = cleanSave(save);
  return JSON.stringify({
    v: SAVE_VERSION,
    profiles: sortedObject(clean.profiles),
    activeId: clean.activeId,
    history: sortedObject(clean.history),
    deleted: sortedObject(clean.deleted),
  });
}

export function parseSave(text) {
  try {
    return cleanSave(JSON.parse(text));
  } catch {
    return null;
  }
}

const savedAtOf = (profile) => (typeof profile?.savedAt === 'number' ? profile.savedAt : 0);
const lineKey = (e) => `${e.at}|${e.game}|${e.fp}`;

/**
 * Two devices' saves as one. Pure and symmetric apart from ties, which go to
 * `local` — the copy the player is looking at.
 *
 * - Profiles: every id either side has. Where both have one, the newer
 *   `savedAt` wins WHOLE — useProfile stamps it on every write. Merging field
 *   by field was considered and refused: a profile's list, import ids and
 *   import settings only mean anything together, and half of one device's
 *   import spliced onto the other's would be a list neither device ever had.
 *   The cost is that two different edits to one profile on two devices
 *   between syncs keep only the later one; a sync runs within seconds of every
 *   edit, so that takes two people editing one profile at once.
 * - Deletes: a marker `{ id: at }`. It beats every copy saved before it — or a
 *   profile deleted on the phone comes straight back from the laptop — and
 *   loses to a copy saved after it, so a name deleted and later re-made stays.
 *   Profiles saved before savedAt existed read as 0, so any marker beats them.
 * - History: every line from both, once each (a line's time, game and
 *   fingerprint name it), in time order, newest MAX_PER_PROFILE kept. Lines
 *   are append-only, so a union is always right.
 * - Main profile: local's. Which profile is "me" is a property of the device —
 *   a shared family laptop and one person's phone can rightly differ — so the
 *   save's pointer is adopted only by a device with none, which is exactly a
 *   fresh restore.
 */
export function mergeSaves(local, remote) {
  const a = cleanSave(local);
  const b = cleanSave(remote);

  const deleted = { ...b.deleted };
  for (const [id, at] of Object.entries(a.deleted)) deleted[id] = Math.max(at, deleted[id] ?? 0);

  const profiles = {};
  for (const id of new Set([...Object.keys(a.profiles), ...Object.keys(b.profiles)])) {
    const mine = a.profiles[id];
    const theirs = b.profiles[id];
    const pick = !theirs || (mine && savedAtOf(mine) >= savedAtOf(theirs)) ? mine : theirs;
    if (deleted[id] != null && deleted[id] >= savedAtOf(pick)) continue;
    profiles[id] = pick;
  }

  const history = {};
  for (const id of new Set([...Object.keys(a.history), ...Object.keys(b.history)])) {
    const seen = new Map();
    for (const e of [...(b.history[id] ?? []), ...(a.history[id] ?? [])]) seen.set(lineKey(e), e);
    history[id] = [...seen.values()].sort((x, y) => x.at - y.at).slice(-MAX_PER_PROFILE);
  }

  const keptDeleted = Object.fromEntries(
    Object.entries(deleted).sort(([, x], [, y]) => y - x).slice(0, MAX_DELETED)
  );

  const activeId = [a.activeId, b.activeId].find((id) => id && profiles[id]) ?? null;
  return { profiles, activeId, history, deleted: keptDeleted };
}

// A cheap fingerprint of a serialized save (FNV-1a, 32-bit, plus the length),
// so a device can tell "nothing changed since the last sync" without keeping a
// second megabyte copy of the save in localStorage.
export function hashSave(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${text.length}:${(h >>> 0).toString(36)}`;
}

// "just now" / "4 min ago" / "3 h ago" / a date — the backup status line. Its
// own wording rather than history.js's whenLabel, because "Backed up Today"
// says nothing to someone deciding whether to put their phone down.
export function syncedLabel(at, now = Date.now()) {
  if (typeof at !== 'number') return null;
  const mins = Math.floor((now - at) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `on ${new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

// How many profiles a restore brought that this device did not have — what the
// "Restored 2 profiles" line counts.
export function countNewProfiles(before, after) {
  return Object.keys(after?.profiles ?? {}).filter((id) => !before?.profiles?.[id]).length;
}
