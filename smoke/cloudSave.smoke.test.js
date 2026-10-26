import { describe, it, expect, vi } from 'vitest';
import { ref, get, set, serverTimestamp } from 'firebase/database';
import { FIREBASE_MODULE, REPO, STORAGE_MODULE, firebaseDevice, memStorage, profile } from './harness';

// Backup codes (services/cloudSave.js) against the real rules: one device turns
// backup on, another restores by code, and edits and deletes travel both ways.
// Not a hook, so no renderHook: each device is its own copy of the service
// module, evaluated against that device's Firebase app and storage, which is
// the harness's isolation trick without the React half.
async function saveDevice(label, seed = {}) {
  const fb = firebaseDevice(label);
  const storage = memStorage(seed);
  vi.resetModules();
  vi.doMock(FIREBASE_MODULE, () => ({
    firebaseEnabled: true,
    getFirebaseAuth: () => fb.auth,
    getFirebaseDb: () => fb.db,
    ensureSignedIn: fb.ensureSignedIn,
  }));
  vi.doMock(STORAGE_MODULE, () => ({ storage, requestPersistentStorage: () => {} }));
  const cloud = await import(/* @vite-ignore */ `${REPO}/src/shared/services/cloudSave.js`);
  return { ...fb, storage, cloud, profiles: () => storage.getItem('aniguess_profiles') ?? {} };
}

const stamped = (name, savedAt, extra = {}) => ({ ...profile(name, 2), savedAt, ...extra });
const line = (at) => ({ at, game: 'anitag', won: true, place: 1, size: 2, with: ['Ayu'], fp: `fp${at}` });

describe('backup codes', () => {
  it('carries profiles, history, edits and deletes between two devices', async () => {
    const A = await saveDevice('save-a', {
      aniguess_profiles: { caden: stamped('Caden', 10), ayu: stamped('Ayu', 10) },
      aniarcade_active_profile: 'caden',
      aniarcade_history: { caden: [line(1000)] },
    });
    const B = await saveDevice('save-b', {
      aniguess_profiles: { guest: stamped('Guest', 5) },
    });

    const on = await A.cloud.enableBackup();
    expect(on.status).toBe('ok');
    expect(on.code).toMatch(/^[A-HJ-NP-Z2-9]{16}$/);

    // A typo is refused before it leaves the device; a code nobody made is
    // "not found", and leaves B unlinked.
    expect((await B.cloud.restoreBackup('nope')).status).toBe('invalid');
    expect((await B.cloud.restoreBackup('ABCDEFGHJKLMNPQR')).status).toBe('not-found');
    expect(B.cloud.readCloudState().code).toBeNull();

    const restored = await B.cloud.restoreBackup(on.code.toLowerCase().replace(/(.{4})/g, '$1-'));
    expect(restored.status).toBe('ok');
    expect(restored.restored).toBe(2);
    expect(Object.keys(B.profiles()).sort()).toEqual(['ayu', 'caden', 'guest']);
    expect(B.storage.getItem('aniarcade_history').caden).toHaveLength(1);
    // B had no main profile, so it takes the backup's.
    expect(B.storage.getItem('aniarcade_active_profile')).toBe('caden');
    // The list survives the trip exactly, empty arrays and all.
    expect(B.profiles().caden.animeList[0].characters).toHaveLength(2);

    const pulled = await A.cloud.syncNow();
    expect(pulled.status).toBe('ok');
    expect(pulled.localChanged).toBe(true);
    expect(Object.keys(A.profiles()).sort()).toEqual(['ayu', 'caden', 'guest']);

    // Nothing changed anywhere: a sync is a timestamp read and nothing else.
    const idle = await A.cloud.syncNow();
    expect(idle).toMatchObject({ status: 'ok', localChanged: false });

    // B renames Ayu and deletes the guest; A picks up both.
    const bProfiles = B.profiles();
    bProfiles.ayu = { ...bProfiles.ayu, name: 'Ayu B', savedAt: 50 };
    delete bProfiles.guest;
    B.storage.setItem('aniguess_profiles', bProfiles);
    B.cloud.recordDeletion('guest');
    expect((await B.cloud.syncNow()).status).toBe('ok');

    await A.cloud.syncNow();
    expect(A.profiles().ayu.name).toBe('Ayu B');
    expect(A.profiles().guest).toBeUndefined();

    // And A's next game reaches B.
    A.storage.setItem('aniarcade_history', { caden: [line(1000), line(2000)] });
    await A.cloud.syncNow();
    await B.cloud.syncNow();
    expect(B.storage.getItem('aniarcade_history').caden.map((e) => e.at)).toEqual([1000, 2000]);

    // Stopping sync on B forgets the code and keeps the data.
    B.cloud.disconnectBackup();
    expect(B.cloud.readCloudState().code).toBeNull();
    expect(Object.keys(B.profiles()).sort()).toEqual(['ayu', 'caden']);
  });

  it('the rules refuse listing, malformed codes and malformed saves', async () => {
    const { db, ensureSignedIn } = firebaseDevice('save-rules');
    await ensureSignedIn();
    const refused = (p) => p.then(() => 'allowed', () => 'refused');
    const good = 'ZZZZYYYYXXXXWWWW';

    expect(await refused(get(ref(db, 'saves'))), 'nobody may list backups').toBe('refused');
    expect(await refused(set(ref(db, 'saves/ZZZZYYYYXXXXWWW'), { data: '{}', updatedAt: serverTimestamp() })))
      .toBe('refused');
    expect(await refused(set(ref(db, 'saves/ZZZZYYYYXXXXWWW0'), { data: '{}', updatedAt: serverTimestamp() })))
      .toBe('refused');
    expect(await refused(set(ref(db, `saves/${good}`), { data: '{}', updatedAt: 12345 })), 'client time')
      .toBe('refused');
    expect(await refused(set(ref(db, `saves/${good}`), { data: 42, updatedAt: serverTimestamp() }))).toBe('refused');
    expect(await refused(set(ref(db, `saves/${good}`), { data: '{}', updatedAt: serverTimestamp(), extra: 1 })))
      .toBe('refused');
    expect(await refused(set(ref(db, `saves/${good}`), { data: '{}' })), 'no timestamp').toBe('refused');
    expect(await refused(set(ref(db, `saves/${good}`), { data: '{}', updatedAt: serverTimestamp() }))).toBe('allowed');
    expect(await refused(get(ref(db, `saves/${good}/data`)))).toBe('allowed');
  });
});
