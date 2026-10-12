import { describe, it, expect, afterAll } from 'vitest';
import { device, profile, seatTable, until, sleep } from './harness';
const all = [];
const TAG = (n) => { const d = device(n, 'src/games/categories/hooks/useCategoriesRoom.js', 'useCategoriesRoom'); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));

describe('leaving on purpose vs refreshing', () => {
  it('a seat who presses Leave is skipped at once; a host who refreshes keeps the crown', async () => {
    const devs = [TAG('l1'), TAG('l2'), TAG('l3'), TAG('l4')];
    await seatTable(devs, [profile('Uma'), profile('Vic'), profile('Wes'), profile('Xia')]);
    const [A] = devs;
    await A.act((r) => r.startGame({ rounds: 2, proposalCap: 5, categoryPool: 'characters', useCustom: true, categoryMode: 'dealt' }));
    await until(() => devs.every((d) => d.r.dealReady && d.r.game?.phase === 'naming'), { what: 'naming' });

    // Host refresh mid-round: same seat, crown kept, nobody marked gone.
    await A.reload();
    await until(() => A.r.roomCode && A.r.isHost && A.r.game?.phase === 'naming', { what: 'host back with crown' });
    await sleep(3000);
    expect(devs[1].r.hostId).toBe('uma');
    expect(devs[1].r.departedIds).toEqual([]);

    let seat = devs.find((d) => d.r.iAmSeat);
    if (seat === A) {
      await seat.act((r) => r.propose('Luffy'));
      for (const d of devs.filter((x) => x.r.iMustRule)) await d.act((r) => r.rule(false));
      await until(() => devs.every((d) => d.r.game?.phase === 'naming' && !A.r.iAmSeat), { what: 'seat moved off host' });
      seat = devs.find((d) => d.r.iAmSeat);
    }
    const seatId = seat.r.myPlayerId;
    const t0 = Date.now();
    await seat.act((r) => r.leaveRoom());
    seat.unmount();
    const rest = devs.filter((d) => d !== seat);
    await until(() => rest.every((d) => d.r.departedIds.includes(seatId) && d.r.seatId !== seatId), { what: 'left seat skipped', timeout: 10_000 });
    expect(Date.now() - t0, 'no grace window for a deliberate leave').toBeLessThan(8000);
  });
});
