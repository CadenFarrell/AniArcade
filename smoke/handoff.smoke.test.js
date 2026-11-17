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

  // Game night (src/shared/utils/night.js): one line per finished game however
  // many devices report it, a replay counted even when it ends the same way,
  // and the whole table carried into the next room before anyone joins it.
  it('keeps the night across devices, a replay and the next room', async () => {
    const [A, B, C] = [dev('n1'), dev('n2'), dev('n3')];
    const table = [profile('Ada'), profile('Bo'), profile('Cy')];
    const from = await seatTable([A, B, C], table);
    const line = {
      game: 'anitag', title: 'AniTag', accent: 'teal',
      results: [{ name: 'Ada', pts: 2 }, { name: 'Bo', pts: 1 }, { name: 'Cy', pts: 0 }],
    };
    const everyone = [A, B, C];
    const games = (d) => d.r.handoff.night?.games.length ?? 0;
    // Every device's final results screen reports the game at once.
    const finish = async () => {
      await A.act((r) => r.setView('results'));
      await until(() => everyone.every((d) => d.r.view === 'results'), { what: 'the results reach everyone' });
      await A.act(() => Promise.all(everyone.map((d) => d.r.handoff.recordNight(line))));
    };

    await finish();
    await until(() => everyone.every((d) => games(d) === 1), { what: 'the first game lands' });
    // A refresh on the results screen reports it again.
    await B.act((r) => r.handoff.recordNight(line));
    await sleep(300);
    expect(await adminGet(`rooms/${from}/state/night`)).toEqual({ games: [line], counted: true });
    // The view moving under a results screen that is still up (AniQuiz's
    // 'round' → 'results') is not a new game: a slower phone adds nothing.
    await A.act((r) => r.setView('final'));
    await until(() => everyone.every((d) => d.r.view === 'final'), { what: 'the view moves on' });
    await C.act((r) => r.handoff.recordNight(line));
    await sleep(300);
    expect((await adminGet(`rooms/${from}/state/night`)).games).toHaveLength(1);

    // Back to the lobby re-arms the latch, so the same result is a second game.
    await A.act((r) => r.setView('lobby'));
    await until(() => everyone.every((d) => d.r.handoff.night?.counted !== true), { what: 'the latch is dropped' });
    await finish();
    await until(() => everyone.every((d) => games(d) === 2), { what: 'the replay lands' });
    await sleep(300);
    expect((await adminGet(`rooms/${from}/state/night`)).games).toHaveLength(2);

    // The host moves on and takes the night along, before announcing the room.
    await A.act((r) => r.handoff.start('anipeek'));
    await A.act((r) => r.leaveRoom());
    await A.switchTo(...PEEK);
    let code;
    await A.act(async (r) => { code = await r.createRoom(table[0]); });
    await A.act((r) => r.handoff.carry(from, code));
    expect(await adminGet(`rooms/${code}/state/night`), 'the games, and nothing of the old room\'s moment')
      .toEqual({ games: [line, line] });
    await A.act((r) => r.handoff.announce(from, code));
    for (const [d, p] of [[B, table[1]], [C, table[2]]]) {
      await d.act((r) => r.leaveRoom());
      await d.switchTo(...PEEK);
      await d.act((r) => r.joinRoom(code, p));
    }
    await until(() => everyone.every((d) => games(d) === 2), { what: 'the night is in the new room for all three' });

    // The host ends the night for everyone, and may take that back.
    await A.act((r) => r.handoff.endNight());
    await until(() => everyone.every((d) => d.r.handoff.night?.ended?.byName === 'Ada'), { what: 'the ending reaches everyone' });
    await A.act((r) => r.handoff.resumeNight());
    await until(() => everyone.every((d) => d.r.handoff.night?.ended == null && games(d) === 2), { what: 'the night carries on' });

    const outsider = firebaseDevice('n-outsider');
    await outsider.ensureSignedIn();
    await expect(set(ref(outsider.db, `rooms/${code}/state/night/games/2`), line))
      .rejects.toThrow(/permission/i);
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
