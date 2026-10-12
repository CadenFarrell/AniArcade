import { describe, it, expect, afterAll } from 'vitest';
import { ref, get } from 'firebase/database';
import { device, profile, seatTable, until, sleep, GRACE_WAIT, syncErrors } from './harness';

const HOOK = ['src/games/categories/hooks/useCategoriesRoom.js', 'useCategoriesRoom'];
const BASE = { rounds: 3, proposalCap: 10, categoryPool: 'characters', useCustom: true };

const all = [];
const mk = (n) => { const d = device(n, ...HOOK); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));
const denied = (p) => p.then(() => 'READ', (e) => String(e.message));

describe('AniTag online', () => {
  it('chosen: picks, a judged name hands the seat on, a departed judge settles, a departed seat is skipped', async () => {
    const devs = [mk('h'), mk('b'), mk('c'), mk('d')];
    const [A] = devs;
    await seatTable(devs, [profile('Ann'), profile('Ben'), profile('Cat'), profile('Dot')]);
    await A.act((r) => r.startGame({ ...BASE, categoryMode: 'chosen' }));
    await until(() => devs.every((d) => d.r.game?.phase === 'picking'), { what: 'picking phase' });

    const ids = ['glasses', 'villain', 'sword', 'glasses'];
    for (let i = 0; i < devs.length; i++) await devs[i].act((r) => r.pickCategory(ids[i]));
    await until(() => devs.every((d) => d.r.game?.phase === 'naming'), { what: 'host opened naming once all picked' });
    // Nobody can read anybody else's clause.
    const code = A.r.roomCode;
    expect(await denied(get(ref(devs[1].db, `rooms/${code}/secrets/ann`)))).toMatch(/permission/i);
    expect(devs[1].r.myCategory).toBeTruthy();

    const seat1 = devs.find((d) => d.r.iAmSeat);
    await seat1.act((r) => r.propose('Naruto'));
    await until(() => devs.every((d) => d.r.game?.phase === 'judging'), { what: 'judging' });
    for (const d of devs.filter((x) => x.r.iMustRule)) await d.act((r) => r.rule(false));
    await until(() => devs.every((d) => d.r.game?.phase === 'naming' && d.r.seatId !== seat1.r.myPlayerId), { what: 'seat moved after one name' });

    // Second name: one judge closes their tab before ruling. Their verdict
    // stops being required and the pending must settle without them.
    const seat2 = devs.find((d) => d.r.iAmSeat);
    await seat2.act((r) => r.propose('Goku'));
    await until(() => devs.every((d) => d.r.game?.phase === 'judging'), { what: 'judging 2' });
    const judges = devs.filter((d) => d.r.iMustRule);
    const quitter = judges.find((d) => !d.r.isHost);
    for (const d of judges.filter((x) => x !== quitter)) await d.act((r) => r.rule(true));
    await quitter.crash();
    const left = devs.filter((d) => d !== quitter);
    await sleep(GRACE_WAIT);
    await until(() => left.every((d) => d.r.game?.phase === 'naming'), { what: 'pending settled without the departed judge', timeout: 15_000 });
    expect(left[0].r.game.trails[seat2.r.myPlayerId]?.length ?? left[0].r.trails[seat2.r.myPlayerId]?.length).toBeGreaterThan(0);

    // The current seat closes their tab: the go must pass on.
    const seat3 = left.find((d) => d.r.iAmSeat);
    const rest = left.filter((d) => d !== seat3);
    const seat3Id = seat3.r.myPlayerId;
    await seat3.crash();
    await sleep(GRACE_WAIT);
    await until(() => rest.every((d) => d.r.seatId && d.r.seatId !== seat3Id), { what: 'departed seat skipped', timeout: 15_000 });
    expect(syncErrors(rest)).toEqual([]);
  });

  it('dealt: the seat never holds its own clause, everyone else does, and the host is dealt by someone else', async () => {
    const devs = [mk('h2'), mk('b2'), mk('c2')];
    const [A] = devs;
    await seatTable(devs, [profile('Eve'), profile('Fin'), profile('Gus')]);
    await A.act((r) => r.startGame({ ...BASE, categoryMode: 'dealt' }));
    await until(() => devs.every((d) => d.r.view === 'round' && d.r.dealReady), { what: 'dealt and ready everywhere' });
    const seat = devs.find((d) => d.r.iAmSeat);
    expect(seat.r.seatCategory).toBeNull();
    for (const d of devs.filter((x) => x !== seat)) expect(d.r.seatCategory).toBeTruthy();
    const code = A.r.roomCode;
    for (const d of devs) {
      const own = await denied(get(ref(d.db, `rooms/${code}/assignments/${d.r.myPlayerId}`)));
      expect(own, `${d.label} reading own assignment`).toMatch(/permission/i);
    }
    // Every slot was dealt for this round, the host's included.
    const other = devs[1];
    const hostSlot = await get(ref(other.db, `rooms/${code}/assignments/eve`));
    expect(hostSlot.val()?.forRound).toBe(0);
    expect(syncErrors(devs)).toEqual([]);
  });
});
