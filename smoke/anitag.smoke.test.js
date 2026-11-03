import { describe, it, expect, afterAll } from 'vitest';
import { ref, get } from 'firebase/database';
import { device, profile, seatTable, until, sleep, GRACE_WAIT, syncErrors } from './harness';
import { pickAll } from './anitagPick';

const HOOK = ['src/games/categories/hooks/useCategoriesRoom.js', 'useCategoriesRoom'];
const BASE = { rounds: 3, proposalCap: 10, categoryPool: 'characters', useCustom: true };

const all = [];
const mk = (n) => { const d = device(n, ...HOOK); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));
const denied = (p) => p.then(() => 'READ', (e) => String(e.message));

describe('AniTag online', () => {
  it('the table picks: proposals, a counter-proposal resets approvals, the target is refused, and the round plays', async () => {
    const devs = [mk('h'), mk('b'), mk('c'), mk('d')];
    const [A] = devs;
    await seatTable(devs, [profile('Ann'), profile('Ben'), profile('Cat'), profile('Dot')]);
    await A.act((r) => r.startGame({ ...BASE, categorySource: 'table' }));
    await until(() => devs.every((d) => d.r.game?.phase === 'picking'), { what: 'picking phase' });
    const code = A.r.roomCode;

    // The first target: everyone else sees one shared proposal; the target sees
    // nothing and is refused the node by the rules, not by the screen.
    const target = devs.find((d) => d.r.iAmPickTarget);
    const others = devs.filter((d) => d !== target);
    expect(others.every((d) => d.r.pickTarget?.id === target.r.myPlayerId)).toBe(true);
    await others[0].act((r) => r.proposeCategory('glasses'));
    await until(() => others.every((d) => d.r.proposal?.label), { what: 'proposal everywhere' });
    expect(target.r.proposal).toBeNull();
    expect(await denied(get(ref(target.db, `rooms/${code}/assignments/${target.r.myPlayerId}`)))).toMatch(/permission/i);
    // Proposing is approving.
    expect(others[0].r.iApproved).toBe(true);
    await others[1].act((r) => r.approveProposal(true));
    await until(() => others[0].r.approvedNames.length === 2, { what: 'second approval' });

    // A counter-proposal replaces the clause AND wipes the approvals given for
    // the old one: only its proposer has approved what is now on the table.
    await others[2].act((r) => r.proposeCategory('villain'));
    await until(() => others.every((d) => d.r.proposal?.label && d.r.proposedBy === others[2].r.myName), { what: 'counter-proposal everywhere' });
    expect(others[0].r.approvedNames).toEqual([others[2].r.myName]);
    expect(others[0].r.iApproved).toBe(false);
    expect(others[0].r.approvalsNeeded).toBe(3);
    // Still picking for the same player — nothing locked on a stale approval.
    expect(others[0].r.pickTarget.id).toBe(target.r.myPlayerId);
    for (const d of [others[0], others[1]]) await d.act((r) => r.approveProposal(true));
    await until(() => devs.every((d) => d.r.pickTarget?.id !== target.r.myPlayerId), { what: 'first pick locked' });
    expect(A.r.game.picked[target.r.myPlayerId]).toBe(true);
    // The locked clause sits in the target's slot, readable by everyone else.
    const slot = await get(ref(others[0].db, `rooms/${code}/assignments/${target.r.myPlayerId}`));
    expect(slot.val()?.category).toBe('villain');

    await pickAll(devs, 0);
    await until(() => devs.every((d) => d.r.game?.phase === 'naming' && d.r.dealReady), { what: 'naming once every clause is picked' });
    const seat1 = devs.find((d) => d.r.iAmSeat);
    expect(seat1.r.seatCategory).toBeNull();
    for (const d of devs.filter((x) => x !== seat1)) expect(d.r.seatCategory?.label).toBeTruthy();

    // One judge, the next player round, as in the random game.
    await seat1.act((r) => r.propose('Naruto'));
    await until(() => devs.every((d) => d.r.game?.phase === 'judging'), { what: 'judging' });
    expect(devs.filter((d) => d.r.iMustRule)).toHaveLength(1);
    await devs.find((d) => d.r.iMustRule).act((r) => r.rule(false));
    await until(() => devs.every((d) => d.r.game?.phase === 'naming' && d.r.seatId !== seat1.r.myPlayerId), { what: 'seat moved after one name' });

    // The judge closes their tab before ruling: the role passes to the next
    // active player on the next render, with no write, and they rule instead.
    const seat2 = devs.find((d) => d.r.iAmSeat);
    await seat2.act((r) => r.propose('Goku'));
    await until(() => devs.every((d) => d.r.game?.phase === 'judging'), { what: 'judging 2' });
    let quitter = devs.find((d) => d.r.iMustRule);
    if (quitter.r.isHost) {
      // Keep the host so the round has someone to bank it; rule and use the
      // next name for the departure instead.
      await quitter.act((r) => r.rule(true));
      await until(() => devs.every((d) => d.r.game?.phase === 'naming'), { what: 'naming 3' });
      const seat = devs.find((d) => d.r.iAmSeat);
      await seat.act((r) => r.propose('Luffy'));
      await until(() => devs.every((d) => d.r.game?.phase === 'judging'), { what: 'judging 3' });
      quitter = devs.find((d) => d.r.iMustRule);
    }
    const left = devs.filter((d) => d !== quitter);
    await quitter.crash();
    await sleep(GRACE_WAIT);
    await until(() => left.some((d) => d.r.iMustRule), { what: 'a new judge derived', timeout: 15_000 });
    await left.find((d) => d.r.iMustRule).act((r) => r.rule(false));
    await until(() => left.every((d) => d.r.game?.phase === 'naming'), { what: 'settled by the new judge' });

    // The current seat closes their tab: the go must pass on.
    const seat3 = left.find((d) => d.r.iAmSeat);
    const rest = left.filter((d) => d !== seat3);
    const seat3Id = seat3.r.myPlayerId;
    await seat3.crash();
    await sleep(GRACE_WAIT);
    await until(() => rest.every((d) => d.r.seatId && d.r.seatId !== seat3Id), { what: 'departed seat skipped', timeout: 15_000 });
    expect(syncErrors(rest)).toEqual([]);
  });

  it('random: the seat never holds its own clause, everyone else does, and the host is dealt by someone else', async () => {
    const devs = [mk('h2'), mk('b2'), mk('c2')];
    const [A] = devs;
    await seatTable(devs, [profile('Eve'), profile('Fin'), profile('Gus')]);
    await A.act((r) => r.startGame({ ...BASE, categorySource: 'random' }));
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
