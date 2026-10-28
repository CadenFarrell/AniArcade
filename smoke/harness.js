// The online smoke suite (`npm run test:smoke`): drives the app's REAL online
// hooks against the Firebase emulator, one renderHook per simulated device.
// Each device gets its own Firebase app (so its own anonymous uid — the
// membership rules see N devices) and its own in-memory storage (so saved-room
// restore works per device). The rules functions are covered by src/**'s unit
// suite; what only this can catch is the hooks' writes, the security rules,
// presence, and host migration, working together across devices.
//
// Isolation trick: before mounting a device we vi.resetModules() and doMock the
// firebase + storage services, then dynamic-import the hook. The hook and
// everything it imports re-evaluate against THAT device's mocks; React and the
// firebase SDK are externals and stay shared, which is what renderHook needs.
import { vi, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { initializeApp } from 'firebase/app';
import {
  initializeAuth, inMemoryPersistence, connectAuthEmulator, signInAnonymously, onAuthStateChanged,
} from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, goOffline, goOnline } from 'firebase/database';

// Absolute, not '/src/...': doMock has to name the same module id the hook's own
// relative imports resolve to, or the mock silently never applies and a device
// talks to whatever .env.local points at — which is production.
// `import.meta.dirname` rather than fileURLToPath(new URL(...)): under jsdom the
// global URL is jsdom's own class, and Node's fileURLToPath rejects it.
export const REPO = import.meta.dirname.replace(/\\/g, '/').replace(/\/smoke$/, '');
const FIREBASE = `${REPO}/src/shared/services/firebase.js`;
const STORAGE = `${REPO}/src/shared/services/storage.js`;
const NS = 'demo-aniguess-default-rtdb';
const config = {
  apiKey: 'demo-key',
  authDomain: 'demo-aniguess.firebaseapp.com',
  databaseURL: `http://127.0.0.1:9000/?ns=${NS}`,
  projectId: 'demo-aniguess',
};

export const GRACE_WAIT = 26_000; // GRACE_MS is 20s; leave slack for the 1s tick

let seq = 0;

// `seed` pre-fills the map ({ key: value }), as a returning device's storage
// would be — the playtest bots seat each device with a profile already saved.
export function memStorage(seed = {}) {
  const m = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    getItem: (k) => (m.has(k) ? JSON.parse(m.get(k)) : null),
    setItem: (k, v) => { m.set(k, JSON.stringify(v)); return true; },
    removeItem: (k) => { m.delete(k); },
    keys: () => [...m.keys()],
  };
}

export function profile(name, shows = 14, offset = 0) {
  const id = name.trim().toLowerCase().replace(/\s+/g, '_');
  return {
    id,
    name,
    animeList: Array.from({ length: shows }, (_, j) => {
      const i = j + offset;
      return {
        id: `anilist_anime_${1000 + i}`,
        title: `Smoke Show ${String.fromCharCode(65 + i)}`,
        coverImageUrl: null,
        startDate: { year: 2000 + i, month: 1, day: 1 },
        episodes: 12 + i,
        averageScore: 60 + i,
        popularity: 1000 * (i + 1),
        characters: [0, 1].map((c) => ({
          id: `anilist_char_${i}_${c}`,
          name: `Hero${String.fromCharCode(65 + i)} ${c ? 'Rival' : 'Lead'}`,
          role: c ? 'SUPPORTING' : 'MAIN',
          gender: c ? 'Female' : 'Male',
          imageUrl: null,
          description: '',
          favourites: 100 * (i + 1) + c,
          genres: ['Action'],
        })),
      };
    }),
  };
}

/**
 * A simulated device. `mount()` is a fresh page load (same uid, same storage);
 * `crash()` is the tab being closed: the socket drops (so the server runs the
 * onDisconnect write) and the React tree goes away without running its exits.
 */
// One simulated device's Firebase: its own named app, so its own anonymous
// uid, against the emulator. Shared with playtest/online.playtest.test.jsx,
// which mounts real screens over it rather than a bare hook.
export function firebaseDevice(label) {
  const app = initializeApp(config, `${label}-${++seq}`);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  const ensureSignedIn = () => new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) resolve(user.uid);
      else signInAnonymously(auth).then((c) => resolve(c.user.uid)).catch(reject);
    }, reject);
  });
  return { app, auth, db, ensureSignedIn };
}

export const FIREBASE_MODULE = FIREBASE;
export const STORAGE_MODULE = STORAGE;

export function device(label, hookFile, hookName, { extraMocks = {} } = {}) {
  const { auth, db, ensureSignedIn } = firebaseDevice(label);
  const storage = memStorage();

  const dev = {
    label, db, storage, view: null, errors: [], hookFile, hookName,
    get r() { return dev.view.result.current; },
    async mount() {
      vi.resetModules();
      vi.doMock(FIREBASE, () => ({
        firebaseEnabled: true,
        getFirebaseAuth: () => auth,
        getFirebaseDb: () => db,
        ensureSignedIn,
      }));
      vi.doMock(STORAGE, () => ({ storage }));
      for (const [path, factory] of Object.entries(extraMocks)) vi.doMock(`${REPO}/${path}`, factory);
      const mod = await import(/* @vite-ignore */ `${REPO}/${dev.hookFile}`);
      const hook = mod[dev.hookName];
      dev.view = renderHook(() => hook());
      await waitFor(() => expect(dev.r.uid).toBeTruthy(), { timeout: 15_000 });
      return dev;
    },
    unmount() { dev.view?.unmount(); dev.view = null; },
    async crash() {
      goOffline(db);
      dev.unmount();
    },
    async reload() {
      dev.unmount();
      await dev.mount();
    },
    // The hub opening another game on this same device: the same uid and
    // storage, a different game's hook. What "Next game" does
    // (src/shared/utils/handoff.js).
    async switchTo(nextHookFile, nextHookName) {
      dev.unmount();
      dev.hookFile = nextHookFile;
      dev.hookName = nextHookName;
      await dev.mount();
    },
    async revive() {
      goOnline(db);
      await dev.mount();
    },
    act: (fn) => act(async () => { await fn(dev.r); }),
  };
  return dev;
}

// Waits on a predicate over one or more devices' current hook values.
export async function until(pred, { timeout = 20_000, what = 'condition' } = {}) {
  try {
    await waitFor(() => { if (!pred()) throw new Error(what); }, { timeout, interval: 100 });
  } catch (e) {
    throw new Error(`timed out waiting for: ${what}`, { cause: e });
  }
}

export async function seatTable(devices, profiles) {
  const [host, ...guests] = devices;
  for (const d of devices) await d.mount();
  let code;
  await host.act(async (r) => { code = await r.createRoom(profiles[0]); });
  for (let i = 0; i < guests.length; i++) {
    await guests[i].act((r) => r.joinRoom(code, profiles[i + 1]));
  }
  await until(
    () => devices.every((d) => (d.r.players ?? d.r.gameSession?.players ?? []).length === devices.length),
    { what: 'everyone sees a full roster' },
  );
  return code;
}

export const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
export const syncErrors = (devices) => devices.map((d) => d.r?.syncError).filter(Boolean);
