import { describe, it, expect, afterAll } from 'vitest';
import { device, seatTable, until, sleep, GRACE_WAIT, syncErrors } from './harness';

const HOOK = ['src/games/aniname/hooks/useNameRoom.js', 'useNameRoom'];
const BASE = { rounds: 3, seconds: 30 };

// Twelve shows of eight named characters and four studios: categories the deal
// can find with no pack (the hook is mounted with none), and names a scenario
// can type without knowing the round ("Hero 3 1").
const STUDIOS = ['Studio Kappa', 'Studio Lambda', 'Studio Mu', 'Studio Nu'];
const lists = (name) => ({
  id: name.toLowerCase(),
  name,
  animeList: Array.from({ length: 12 }, (_, i) => ({
    id: `anilist_anime_${3000 + i}`,
    title: `Smoke Show ${i}`,
    studio: STUDIOS[i % 4],
    seasonYear: 2010 + (i % 3),
    characters: Array.from({ length: 8 }, (__, j) => ({
      id: `anilist_char_${i}_${j}`,
      name: `Hero ${i} ${j}`,
      role: j < 4 ? 'Main' : 'Supporting',
      gender: 'Male',
      description: '',
      favourites: 100,
      genres: ['Action'],
    })),
  })),
});

const all = [];
const mk = (n) => { const d = device(n, ...HOOK); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));

const same = (devs, f) => devs.every((d) => JSON.stringify(f(d.r)) === JSON.stringify(f(devs[0].r)));
const byId = (devs, id) => devs.find((d) => d.r.myPlayerId === id);
const cat = (r) => r.deal.cats[r.game.round];
// A right answer for this round's category, from the room's own lists.
function rightAnswers(r, n) {
  const c = cat(r);
  if (c.kind === 'cast' || c.kind === 'mains') {
    const show = Number(c.label.match(/(\d+)$/)[1]);
    return Array.from({ length: n }, (_, j) => `Hero ${show} ${j}`);
  }
  if (c.kind === 'studio') {
    return Array.from({ length: 12 }, (_, i) => i).filter((i) => STUDIOS[i % 4].toLowerCase() === c.key).slice(0, n).map((i) => `Smoke Show ${i}`);
  }
  if (c.kind === 'year') {
    return Array.from({ length: 12 }, (_, i) => i).filter((i) => String(2010 + (i % 3)) === c.key).slice(0, n).map((i) => `Smoke Show ${i}`);
  }
  // A genre: every show here is Action.
  return Array.from({ length: n }, (_, i) => `Smoke Show ${i}`);
}

describe('AniName online', () => {
  it('plays a whole game on three devices: auction, naming, the table’s ruling', async () => {
    const devs = [mk('a'), mk('b'), mk('c')];
    await seatTable(devs, [lists('Ann'), lists('Ben'), lists('Cat')]);
    await devs[0].act((r) => r.startGame(BASE, null));
    await until(() => devs.every((d) => d.r.view === 'round' && d.r.game?.phase === 'bidding'), { what: 'dealt' });
    expect(same(devs, (r) => r.deal)).toBe(true);

    for (let round = 0; round < 3; round++) {
      const A = devs[0];
      // The opener bids 2; everyone else drops out.
      const opener = byId(devs, A.r.game.turnId);
      await opener.act((r) => r.bid(null, 2));
      for (let guard = 0; guard < 4 && A.r.game.phase === 'bidding'; guard++) {
        const turn = byId(devs, A.r.game.turnId);
        const before = A.r.game.turnId;
        await turn.act((r) => r.pass());
        await until(() => devs.every((d) => d.r.game.turnId !== before || d.r.game.phase !== 'bidding'), { what: 'dropped' });
      }
      await until(() => devs.every((d) => d.r.game.phase === 'naming'), { what: `round ${round + 1} naming` });
      const namer = byId(devs, A.r.game.bid.by);
      const [good] = rightAnswers(namer.r, 1);

      // A right name, then a stranger: one short, with one for the table.
      await namer.act((r) => r.name(null, good));
      await until(() => devs.every((d) => d.r.game.answers.length === 1), { what: 'first name' });
      expect(A.r.game.answers[0].verdict).toBe('right');
      await namer.act((r) => r.name(null, `Stranger ${round}`));
      await until(() => devs.every((d) => d.r.game.answers.length === 2), { what: 'second name' });
      expect(A.r.game.answers[1].verdict).toBe('pending');
      await namer.act((r) => r.done());
      await until(() => devs.every((d) => d.r.game.phase === 'review'), { what: 'review' });

      // The namer may not rule on their own answer; someone else accepts it.
      await namer.act((r) => r.judge(null, 1, true));
      expect(A.r.game.phase).toBe('review');
      const judge = devs.find((d) => d !== namer);
      await judge.act((r) => r.judge(null, 1, true));
      await until(() => devs.every((d) => d.r.game.phase === 'revealed'), { what: 'revealed' });
      expect(A.r.game.result).toMatchObject({ made: true, n: 2 });

      for (const d of devs) await d.act((r) => r.next());
      await until(() => devs.every((d) => d.r.game.phase !== 'revealed'), { what: 'advanced' });
    }
    await until(() => devs.every((d) => d.r.view === 'results'), { what: 'results' });
    expect(same(devs, (r) => r.game.scores)).toBe(true);
    // Three rounds, three openers, each made 2.
    expect(Object.values(devs[0].r.game.scores).sort()).toEqual([2, 2, 2]);
    expect(syncErrors(devs)).toEqual([]);
  });

  it('closes the round when the clock runs out, on any device', async () => {
    const devs = [mk('d'), mk('e')];
    const [A, B] = devs;
    await seatTable(devs, [lists('Dan'), lists('Eve')]);
    await A.act((r) => r.startGame({ rounds: 3, seconds: 30 }, null));
    await until(() => devs.every((d) => d.r.game?.phase === 'bidding'), { what: 'dealt' });
    await A.act((r) => r.bid(null, 5));
    await until(() => devs.every((d) => d.r.game.turnId === 'eve'), { what: "Eve's turn" });
    await B.act((r) => r.pass());
    await until(() => devs.every((d) => d.r.game.phase === 'naming'), { what: 'naming' });
    // Dan names nothing; the clock (30s + grace) closes it as a miss.
    await until(() => devs.every((d) => d.r.game.phase === 'revealed'), { what: 'timed out', timeout: 45_000 });
    expect(A.r.game.result).toMatchObject({ made: false, n: 5 });
    expect(A.r.game.scores).toEqual({ dan: 0, eve: 3 });
    expect(syncErrors(devs)).toEqual([]);
  });

  it('voids the round when the namer closes their tab', async () => {
    const devs = [mk('f'), mk('g'), mk('h')];
    const [A, B, C] = devs;
    await seatTable(devs, [lists('Fay'), lists('Gus'), lists('Hal')]);
    await A.act((r) => r.startGame(BASE, null));
    await until(() => devs.every((d) => d.r.game?.phase === 'bidding'), { what: 'dealt' });
    await A.act((r) => r.bid(null, 4));
    await until(() => devs.every((d) => d.r.game.turnId === 'gus'), { what: "Gus's turn" });
    await B.act((r) => r.pass());
    await until(() => devs.every((d) => d.r.game.turnId === 'hal'), { what: "Hal's turn" });
    await C.act((r) => r.pass());
    await until(() => devs.every((d) => d.r.game.phase === 'naming'), { what: 'naming' });
    await A.crash();
    await sleep(GRACE_WAIT);
    await until(() => [B, C].every((d) => d.r.game.phase === 'revealed'), { what: 'voided', timeout: 15_000 });
    expect(B.r.game.result).toMatchObject({ by: 'fay', void: 'left' });
    expect(B.r.game.scores).toEqual({ fay: 0, gus: 0, hal: 0 });
    expect(syncErrors([B, C])).toEqual([]);
  });
});
