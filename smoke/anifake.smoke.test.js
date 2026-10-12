import { describe, it, expect, afterAll } from 'vitest';
import { ref, get } from 'firebase/database';
import { device, profile, seatTable, until, sleep, GRACE_WAIT, syncErrors } from './harness';

const HOOK = ['src/games/anifake/hooks/useAniFakeRoom.js', 'useAniFakeRoom'];
const SETTINGS = { mode: 'blind', laps: 1, sharedOnly: true, talkMode: false, fame: 'any', allowRedeal: true };

const all = [];
const mk = (n) => { const d = device(n, ...HOOK); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));

async function playClues(devs) {
  for (let guard = 0; guard < 20; guard++) {
    if (devs.every((d) => d.r.view === 'vote')) return;
    const sp = devs.find((d) => d.r.isMyTurn);
    if (sp) await sp.act((r) => r.submitClue(`w${guard}`));
    await sleep(300);
  }
  await until(() => devs.every((d) => d.r.view === 'vote'), { what: 'vote view' });
}

describe('AniFake online', () => {
  it('re-deal keeps the fake and publishes the discard; a full round reveals and banks', async () => {
    const devs = [mk('h'), mk('b'), mk('c'), mk('d')];
    const [A] = devs;
    await seatTable(devs, [profile('Ann'), profile('Ben'), profile('Cat'), profile('Dot')]);
    await A.act((r) => r.startGame(SETTINGS));
    await until(() => devs.every((d) => d.r.view === 'check' && d.r.card), { what: 'check phase with cards' });

    const fake = devs.filter((d) => d.r.card.isFake);
    expect(fake).toHaveLength(1);
    const fakeId = fake[0].r.myPlayerId;
    const crew = devs.filter((d) => !d.r.card.isFake);
    const firstSecret = crew[0].r.card.character?.name;
    // Only you can read your own card.
    const peek = await get(ref(crew[0].db, `rooms/${A.r.roomCode}/secrets/${fakeId}`)).then(() => 'READ', (e) => String(e.message));
    expect(peek).toMatch(/permission/i);

    // One crew member asks for a re-deal, everyone else confirms.
    await crew[0].act((r) => r.respondToCheck(true));
    for (const d of devs.filter((x) => x !== crew[0])) await d.act((r) => r.respondToCheck(false));
    await until(() => devs.every((d) => d.r.dealNumber === 2 && d.r.card), { what: 'deal 2 landed everywhere' });
    expect(devs.find((d) => d.r.card.isFake).r.myPlayerId, 'fake pinned across the re-deal').toBe(fakeId);
    for (const d of devs) expect(JSON.stringify(d.r.card.discarded ?? []), `${d.label} sees the discard`).toContain(firstSecret);

    for (const d of devs) await d.act((r) => r.respondToCheck(false));
    await until(() => devs.every((d) => d.r.view === 'clues'), { what: 'clues after second check' });
    await playClues(devs);

    // Everyone votes for the fake.
    for (const d of devs) await d.act((r) => r.castVote(d.r.myPlayerId === fakeId ? crew[0].r.myPlayerId : fakeId));
    await until(() => devs.every((d) => ['steal', 'reveal', 'results'].includes(d.r.view)), { what: 'past the vote' });
    if (devs.some((d) => d.r.view === 'steal')) {
      await fake[0].act((r) => r.submitSteal('nobody'));
    }
    await until(() => devs.every((d) => d.r.view === 'results'), { what: 'results', timeout: 20_000 });
    for (const d of devs) expect(d.r.fakeId).toBe(fakeId);
    expect(Object.keys(A.r.totalScores).length).toBeGreaterThan(0);
    expect(syncErrors(devs)).toEqual([]);
  });

  it('a speaker who leaves mid-clues is skipped, and a fake who leaves before the reveal is found by elimination', async () => {
    const devs = [mk('h2'), mk('b2'), mk('c2'), mk('d2')];
    const [A] = devs;
    await seatTable(devs, [profile('Eve'), profile('Fin'), profile('Gus'), profile('Hal')]);
    await A.act((r) => r.startGame({ ...SETTINGS, allowRedeal: false }));
    await until(() => devs.every((d) => d.r.view === 'clues' && d.r.card), { what: 'straight to clues' });
    const fake = devs.find((d) => d.r.card.isFake);
    const fakeId = fake.r.myPlayerId;

    // The fake closes the tab the moment it is their turn (or now, if not host).
    let live = devs;
    for (let i = 0; i < 10 && live.includes(fake); i++) {
      const sp = live.find((d) => d.r.isMyTurn);
      if (sp === fake) { await fake.crash(); live = live.filter((d) => d !== fake); break; }
      if (sp) await sp.act((r) => r.submitClue(`w${i}`));
      await sleep(300);
    }
    if (live.includes(fake)) { await fake.crash(); live = live.filter((d) => d !== fake); }
    await sleep(GRACE_WAIT);
    await playClues(live);
    for (const d of live) await d.act((r) => r.castVote(fakeId));
    await until(() => live.every((d) => d.r.view === 'results'), { what: 'results without the fake', timeout: 30_000 });
    for (const d of live) expect(d.r.fakeId, `${d.label} derives the departed fake`).toBe(fakeId);
    expect(syncErrors(live)).toEqual([]);
  });
});
