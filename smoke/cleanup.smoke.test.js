import { describe, it, expect, afterAll } from 'vitest';
import { ref, get, set, remove, query, orderByKey, endAt } from 'firebase/database';
import { device, firebaseDevice, profile, seatTable, until, sleep } from './harness';

// Room deletion (useRoomCore's leaveRoom and sweepStaleRooms) against the real
// rules: the last one to press Leave deletes the room, a crashed player keeps it
// alive for their refresh, and a day-old room is swept by the next create.
const all = [];
const TAG = (n) => { const d = device(n, 'src/games/categories/hooks/useCategoriesRoom.js', 'useCategoriesRoom'); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));

// The emulator's owner token reads past the rules, so a test can see what no
// client may: whether a room or its index entry is still there.
const NS = 'demo-aniguess-default-rtdb';
async function adminGet(path) {
  const res = await fetch(`http://127.0.0.1:9000/${path}.json?ns=${NS}`, { headers: { Authorization: 'Bearer owner' } });
  return res.json();
}

const DAY = 24 * 60 * 60 * 1000;

// roomIndex is keyed `{createdAt}_{code}` (see useRoomCore), so a code's entry
// is found by its value.
async function indexed(code) {
  return Object.values((await adminGet('roomIndex')) ?? {}).includes(code);
}

describe('room cleanup', () => {
  it('the last player to press Leave deletes the room and its index entry', async () => {
    const [A, B] = [TAG('c1'), TAG('c2')];
    const code = await seatTable([A, B], [profile('Ada'), profile('Bo')]);
    expect(await indexed(code)).toBe(true);

    await B.act((r) => r.leaveRoom());
    await until(() => A.r.departedIds.includes('bo'), { what: 'Bo seen leaving' });
    await sleep(1000);
    expect(await adminGet(`rooms/${code}/createdAt`), 'a room with a player still in it stays').not.toBe(null);

    await A.act((r) => r.leaveRoom());
    let room = 'pending';
    for (let i = 0; i < 50 && room !== null; i++) { room = await adminGet(`rooms/${code}`); await sleep(100); }
    expect(room).toBe(null);
    expect(await indexed(code)).toBe(false);
  });

  it('a crashed player keeps the room alive — they may still refresh back in', async () => {
    const [A, B] = [TAG('c3'), TAG('c4')];
    const code = await seatTable([A, B], [profile('Cy'), profile('Di')]);
    await B.crash();
    await A.act((r) => r.leaveRoom());
    await sleep(2000);
    expect(await adminGet(`rooms/${code}/createdAt`)).not.toBe(null);
  });

  it('a day-old room is swept by the next create, and a fresh one cannot be listed or deleted by an outsider', async () => {
    // Plant a room exactly as a create two days ago would have left it.
    const old = firebaseDevice('planter');
    const uid = await old.ensureSignedIn();
    const stale = 'ZZZZ9';
    const then = Date.now() - 2 * DAY;
    await set(ref(old.db, `rooms/${stale}/createdAt`), then);
    await set(ref(old.db, `rooms/${stale}/memberUids/${uid}`), 'ghost');
    await set(ref(old.db, `roomIndex/${then}_${stale}`), stale);

    const outsider = firebaseDevice('outsider');
    await outsider.ensureSignedIn();
    // Only the stale end of the index may be listed: live codes stay unguessable.
    await expect(get(query(ref(outsider.db, 'roomIndex'), orderByKey(), endAt(String(Date.now()))))).rejects.toThrow(/permission/i);
    // Nor can a live room be filed under an old time to get it swept.
    const now = Date.now();
    await set(ref(outsider.db, `rooms/LIVE2/createdAt`), now);
    await expect(set(ref(outsider.db, `roomIndex/${now - 2 * DAY}_LIVE2`), 'LIVE2')).rejects.toThrow(/permission/i);

    const [H] = [TAG('c5')];
    await H.mount();
    let fresh;
    await H.act(async (r) => { fresh = await r.createRoom(profile('Eve')); });
    let gone = 'pending';
    for (let i = 0; i < 50 && gone !== null; i++) { gone = await adminGet(`rooms/${stale}`); await sleep(100); }
    expect(gone, 'the stale room was swept').toBe(null);
    expect(await indexed(stale)).toBe(false);

    await expect(remove(ref(outsider.db, `rooms/${fresh}`))).rejects.toThrow(/permission/i);
    expect(await adminGet(`rooms/${fresh}/createdAt`)).not.toBe(null);
  });
});
