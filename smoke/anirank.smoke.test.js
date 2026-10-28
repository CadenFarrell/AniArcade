import { describe, it, expect, afterAll } from 'vitest';
import { device, profile, seatTable, until, sleep, GRACE_WAIT, syncErrors } from './harness';

const HOOK = ['src/games/anirank/hooks/useAniRankRoom.js', 'useAniRankRoom'];

const all = [];
const mk = (n) => { const d = device(n, ...HOOK); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));

const firstEmpty = (r) => r.myBoard.findIndex((s) => !s);

describe('AniRank online', () => {
  it('blind fact round: a player leaving mid-deck does not stall the cursor, and a second round still banks', async () => {
    const devs = [mk('h'), mk('b'), mk('c')];
    const [A] = devs;
    await seatTable(devs, [profile('Ann'), profile('Ben'), profile('Cat')]);
    const settings = { sharedOnly: true, scoring: true, axisId: 'year', format: 'round', blind: true };
    await A.act((r) => r.startGame(settings));
    await until(() => devs.every((d) => d.r.view === 'round' && d.r.item), { what: 'round with a current card' });

    let live = devs;
    for (let step = 0; step < 10; step++) {
      const cursor = live[0].r.cursor;
      for (const d of live) await d.act((r) => r.place(firstEmpty(r)));
      if (step === 3) {
        // Ben has placed card 4 and then closes the tab; the rest must carry on.
        const ben = devs[1];
        await ben.crash();
        live = live.filter((d) => d !== ben);
        await sleep(GRACE_WAIT);
      }
      if (step < 9) await until(() => live.every((d) => d.r.cursor === cursor + 1), { what: `cursor past ${cursor}`, timeout: 15_000 });
    }
    await until(() => live.every((d) => d.r.view === 'results'), { what: 'results' });
    const totals1 = A.r.totalScores;
    expect(Object.keys(totals1).length).toBeGreaterThan(0);

    // Second blind round of the match must bank too (the bankedAt trap), on
    // top of the first's totals: the host's "Next round" keeps the match.
    await A.act((r) => r.nextRound());
    await until(() => live.every((d) => d.r.view === 'round' && d.r.cursor === 0 && d.r.matchRound === 2), { what: 'round 2' });
    for (let step = 0; step < 10; step++) {
      const cursor = live[0].r.cursor;
      for (const d of live) await d.act((r) => r.place(firstEmpty(r)));
      if (step < 9) await until(() => live.every((d) => d.r.cursor === cursor + 1), { what: `r2 cursor past ${cursor}` });
    }
    await until(() => live.every((d) => d.r.view === 'results'), { what: 'results 2' });
    const totals2 = A.r.totalScores;
    const sum = (t) => Object.values(t).reduce((s, v) => s + v, 0);
    expect(sum(totals2)).toBeGreaterThan(sum(totals1));
    // Each round left one line in the match log, banked once.
    expect(A.r.matchLog).toHaveLength(2);

    // The match ends on the final scores; a new one from the lobby starts clean.
    await A.act((r) => r.endMatch());
    await until(() => live.every((d) => d.r.view === 'final'), { what: 'final scores' });
    await A.act((r) => r.returnToLobby());
    await until(() => live.every((d) => d.r.view === 'lobby'), { what: 'back to lobby' });
    await A.act((r) => r.startGame(settings));
    await until(() => live.every((d) => d.r.view === 'round' && d.r.matchRound === 1), { what: 'a fresh match' });
    expect(A.r.totalScores).toEqual({});
    expect(A.r.matchLog).toEqual([]);
    expect(syncErrors(live)).toEqual([]);
  });

  it('opinion round: a subject who leaves before anyone places is replaced', async () => {
    const devs = [mk('h2'), mk('b2'), mk('c2')];
    const [A] = devs;
    await seatTable(devs, [profile('Dan'), profile('Eve'), profile('Fay')]);
    await A.act((r) => r.startGame({ sharedOnly: true, scoring: true, axisId: 'best', format: 'round', blind: false }));
    await until(() => devs.every((d) => d.r.view === 'round' && d.r.subjectId), { what: 'opinion round' });
    const subj = devs.find((d) => d.r.subjectId === d.r.myPlayerId);
    const oldId = subj.r.myPlayerId;
    const rest = devs.filter((d) => d !== subj);
    await subj.crash();
    await sleep(GRACE_WAIT);
    await until(() => rest.every((d) => d.r.subjectId && d.r.subjectId !== oldId), { what: 'subject reassigned', timeout: 15_000 });

    // Open round: everyone left fills and locks; it must finish.
    for (const d of rest) {
      for (const card of d.r.tray) await d.act((r) => r.placeCard(card.id, firstEmpty(r)));
      await d.act((r) => r.lockIn());
    }
    await until(() => rest.every((d) => d.r.view === 'results'), { what: 'open round finishes' });
    expect(syncErrors(rest)).toEqual([]);
  });
});
