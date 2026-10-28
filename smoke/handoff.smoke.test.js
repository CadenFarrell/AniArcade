import { describe, it, expect, afterAll } from 'vitest';
import { ref, set } from 'firebase/database';
import { device, firebaseDevice, profile, seatTable, until, sleep } from './harness';

// Next game, same table (src/shared/utils/handoff.js) against the real rules:
// the host writes the pick into the old room, leaves it, makes the new game's
// room and writes the code back — after leaving, which only works because
// leaving keeps memberUids — and everyone else follows it in, the last of them
// deleting the old room on the way out.
const TAG = ['src/games/categories/hooks/useCategoriesRoom.js', 'useCategoriesRoom'];
const PEEK = ['src/games/anipeek/hooks/usePeekRoom.js', 'usePeekRoom'];
const all = [];
const dev = (n) => { const d = device(n, ...TAG); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));

const NS = 'demo-aniguess-default-rtdb';
async function adminGet(path) {
  const res = await fetch(`http://127.0.0.1:9000/${path}.json?ns=${NS}`, { headers: { Authorization: 'Bearer owner' } });
  return res.json();
}

describe('next game, same table', () => {
  it('carries the whole table into the next game, and the old room goes', async () => {
    const [A, B, C] = [dev('h1'), dev('h2'), dev('h3')];
    const table = [profile('Ada'), profile('Bo'), profile('Cy')];
    const from = await seatTable([A, B, C], table);

    await A.act((r) => r.handoff.start('anipeek'));
    await until(() => [B, C].every((d) => d.r.handoff.next?.gameId === 'anipeek'), { what: 'the pick reaches everyone' });
    expect(B.r.handoff.next).toEqual({ gameId: 'anipeek', by: 'ada', byName: 'Ada', code: null });

    // The host goes first. The others are still in the room, so it stays.
    await A.act((r) => r.leaveRoom());
    await A.switchTo(...PEEK);
    let code;
    await A.act(async (r) => { code = await r.createRoom(table[0]); });
    await A.act((r) => r.handoff.announce(from, code));

    await until(() => [B, C].every((d) => d.r.handoff.next?.code === code), { what: 'the new code reaches everyone' });
    for (const [d, p] of [[B, table[1]], [C, table[2]]]) {
      await d.act((r) => r.leaveRoom());
      await d.switchTo(...PEEK);
      await d.act((r) => r.joinRoom(code, p));
    }
    await until(() => [A, B, C].every((d) => d.r.players.length === 3), { what: 'the new room seats all three' });
    expect(A.r.isHost).toBe(true);

    let old = 'pending';
    for (let i = 0; i < 50 && old !== null; i++) { old = await adminGet(`rooms/${from}`); await sleep(100); }
    expect(old, 'the last one out deleted the old room').toBe(null);
  });

  it('a pick can be taken back, and only the table can write one', async () => {
    const [A, B] = [dev('h4'), dev('h5')];
    const from = await seatTable([A, B], [profile('Di'), profile('Ed')]);
    await A.act((r) => r.handoff.start('anipeek'));
    await until(() => B.r.handoff.next != null, { what: 'the pick lands' });
    await B.act((r) => r.handoff.cancel(from));
    await until(() => A.r.handoff.next == null && B.r.handoff.next == null, { what: 'the pick is gone' });

    const outsider = firebaseDevice('h-outsider');
    await outsider.ensureSignedIn();
    await expect(set(ref(outsider.db, `rooms/${from}/state/next`), { gameId: 'anipeek', by: 'x' }))
      .rejects.toThrow(/permission/i);
  });
});
