import { describe, it, expect, afterAll } from 'vitest';
import { device, seatTable, until, sleep, GRACE_WAIT, syncErrors } from './harness';

const HOOK = ['src/games/aniout/hooks/useOutRoom.js', 'useOutRoom'];
const BASE = { rounds: 3, cards: 5, reasons: true, sharedOnly: false };

// The harness's profiles carry no portraits and no studios, and AniOut deals
// only pictured characters linked by something on record. Twenty-four shows
// whose studios, years and sources cycle at different periods hold clean
// rounds with no pack at all.
const STUDIOS = ['MAPPA', 'Bones', 'Madhouse', 'Kyoto Animation'];
const pictured = (name) => ({
  id: name.toLowerCase(),
  name,
  animeList: Array.from({ length: 24 }, (_, i) => ({
    id: `anilist_anime_${2000 + i}`,
    title: `Smoke Show ${i}`,
    studio: STUDIOS[i % 4],
    seasonYear: 2010 + (i % 5),
    source: ['MANGA', 'LIGHT_NOVEL', 'ORIGINAL'][i % 3],
    format: 'TV',
    characters: [{
      id: `anilist_char_${i}`,
      name: `Hero ${i}`,
      role: 'Main',
      gender: 'Male',
      imageUrl: `https://s4.anilist.co/c/${i}.jpg`,
      description: '',
      favourites: 100 + i,
      genres: ['Action'],
    }],
  })),
});

const all = [];
const mk = (n) => { const d = device(n, ...HOOK); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));

const same = (devs, f) => devs.every((d) => JSON.stringify(f(d.r)) === JSON.stringify(f(devs[0].r)));
const setOf = (r) => r.deal.sets[r.game.round];
const wrongCard = (set) => set.cards.find((c) => c.key !== set.odd).key;
const wrongReason = (set) => (set.reason + 1) % set.reasons.length;

describe('AniOut online', () => {
  it('plays a whole game on three devices, picks hidden until all are in', async () => {
    const devs = [mk('a'), mk('b'), mk('c')];
    const [A, B, C] = devs;
    await seatTable(devs, [pictured('Ann'), pictured('Ben'), pictured('Cat')]);
    await A.act((r) => r.startGame(BASE, null));
    await until(() => devs.every((d) => d.r.view === 'round' && d.r.game?.phase === 'picking'), { what: 'dealt' });
    expect(same(devs, (r) => r.deal)).toBe(true);
    expect(A.r.deal.sets).toHaveLength(3);

    // Each round: Ann picks right with the right reason (3), Ben right with a
    // wrong reason (2), Cat wrong (0).
    const expected = { ann: 0, ben: 0, cat: 0 };
    for (let round = 0; round < 3; round++) {
      const set = setOf(A.r);
      await A.act((r) => r.pick(null, { card: set.odd, reason: set.reason }));
      await B.act((r) => r.pick(null, { card: set.odd, reason: wrongReason(set) }));
      await until(() => devs.every((d) => d.r.game.picks.ann && d.r.game.picks.ben), { what: 'two picks in' });
      // Two of three in: nothing graded yet.
      expect(A.r.game.phase).toBe('picking');
      expect(A.r.game.picks.ann.correct).toBeUndefined();

      await C.act((r) => r.pick(null, { card: wrongCard(set), reason: set.reason }));
      await until(() => devs.every((d) => d.r.game.phase === 'revealed'), { what: `round ${round + 1} revealed` });
      expected.ann += 3;
      expected.ben += 2;
      expect(A.r.game.scores).toEqual(expected);
      expect(A.r.game.picks.cat).toMatchObject({ correct: false, delta: 0 });

      // Everybody presses Next; only the first may land.
      for (const d of devs) await d.act((r) => r.next());
      await until(() => devs.every((d) => d.r.game.phase !== 'revealed'), { what: 'advanced' });
    }
    await until(() => devs.every((d) => d.r.view === 'results'), { what: 'results' });
    expect(same(devs, (r) => r.game.scores)).toBe(true);
    expect(syncErrors(devs)).toEqual([]);
  });

  it('reveals without a player who closed their tab mid-pick', async () => {
    const devs = [mk('d'), mk('e'), mk('f')];
    const [A, B, C] = devs;
    await seatTable(devs, [pictured('Dan'), pictured('Eve'), pictured('Fay')]);
    await A.act((r) => r.startGame(BASE, null));
    await until(() => devs.every((d) => d.r.game?.phase === 'picking'), { what: 'dealt' });

    const set = setOf(A.r);
    await A.act((r) => r.pick(null, { card: set.odd, reason: set.reason }));
    await B.act((r) => r.pick(null, { card: wrongCard(set), reason: set.reason }));
    await until(() => [A, B].every((d) => d.r.game.picks.dan && d.r.game.picks.eve), { what: 'two picks in' });
    await C.crash();
    await sleep(GRACE_WAIT);
    await until(() => [A, B].every((d) => d.r.game.phase === 'revealed'), { what: 'revealed without Fay', timeout: 15_000 });
    expect(A.r.game.scores).toEqual({ dan: 3, eve: 0, fay: 0 });
    expect(syncErrors([A, B])).toEqual([]);
  });

  it('ends the game when the room drops below two', async () => {
    const devs = [mk('g'), mk('h')];
    const [A, B] = devs;
    await seatTable(devs, [pictured('Gus'), pictured('Hal')]);
    await A.act((r) => r.startGame(BASE, null));
    await until(() => devs.every((d) => d.r.game?.phase === 'picking'), { what: 'dealt' });
    await B.crash();
    await sleep(GRACE_WAIT);
    await until(() => A.r.view === 'results' && A.r.game.phase === 'finished', { what: 'ended', timeout: 15_000 });
    expect(syncErrors([A])).toEqual([]);
  });
});
