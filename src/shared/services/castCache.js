// The device's own copy of every character page it fetched live, for 30 days,
// so a refresh after a reload, a second player with an overlapping list, Select
// All or a show that gained a season does not pay AniList again for pages it
// already had. anilist.js reads it after its in-memory cache and the cast pack,
// and writes to it after every live fetch.
//
// IndexedDB, not localStorage. A few hundred pages is megabytes, and
// localStorage is the one ~5 MB origin every saved profile lives in — the reason
// storage.setItem grew a read-back guard and a banner, and why the in-memory
// cache this extends was never persisted. IndexedDB's quota is separate and far
// larger, and a cache is what it is for.
//
// Pages are stored compact (utils/castPackFormat.js: the bio already trimmed,
// the name already chosen), which also makes them about a quarter the size.
//
// Every failure is a miss, never a throw: no IndexedDB (jsdom, Node, some
// private windows), a blocked open, a quota error. The live fetch covers it.
import { decodeCastPage, encodeCastPage } from '../utils/castPackFormat.js';

const DB_NAME = 'aniarcade_cast_cache';
const STORE = 'pages';
// Long enough that a weekly game night never refetches, short enough that a
// cast's favourites — which decide who makes a show's cut — are not frozen.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let dbPending = null;
let pruned = false;

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!dbPending) {
    dbPending = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPending;
}

/** Map<'id:page', page> for the keys stored and still fresh. */
export async function readCachedPages(keys) {
  const out = new Map();
  if (!keys.length) return out;
  const db = await openDb();
  if (!db) return out;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      for (const key of keys) {
        const req = store.get(key);
        req.onsuccess = () => {
          const hit = req.result;
          if (hit && Date.now() - hit.at < MAX_AGE_MS) out.set(key, decodeCastPage(hit.page));
        };
      }
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => resolve(out);
      tx.onabort = () => resolve(out);
    } catch {
      resolve(out);
    }
  });
}

// Expired pages are dropped once per session, on the first write, so the store
// holds roughly what the last month of imports touched and no more.
function prune(store) {
  if (pruned) return;
  pruned = true;
  const req = store.openCursor();
  req.onsuccess = () => {
    const cursor = req.result;
    if (!cursor) return;
    if (!(Date.now() - cursor.value?.at < MAX_AGE_MS)) cursor.delete();
    cursor.continue();
  };
}

/** Stores Map<'id:page', page>. Fire-and-forget: resolves either way. */
export async function writeCachedPages(pages) {
  if (!pages.size) return;
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const at = Date.now();
      for (const [key, page] of pages) store.put({ at, page: encodeCastPage(page) }, key);
      prune(store);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}
