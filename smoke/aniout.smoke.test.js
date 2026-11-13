import { describe, it, expect, afterAll } from 'vitest';
import { device, seatTable, until, sleep, GRACE_WAIT, syncErrors } from './harness';
import { indexPack } from '../src/shared/utils/facts';
import { franchiseTitleKey } from '../src/shared/utils/franchise';
import { characterNameKey } from '../src/shared/utils/character';

const HOOK = ['src/games/aniout/hooks/useOutRoom.js', 'useOutRoom'];
const BASE = { rounds: 3, cards: 5, reasons: true, sharedOnly: false };

// The harness's profiles carry no portraits and no studios, and AniOut deals
// only pictured characters linked by something on record. Twenty-four shows
// whose studios, years and sources cycle at different periods hold clean
// rounds with no pack at all.
//
// A "Groups of four" board wants every kind known on its cards, and tags and
// voice actors live only in the fact pack, so its test passes the host a pack
// for these shows (PACK) — only the host deals, so only the host needs it.
const STUDIOS = ['MAPPA', 'Bones', 'Madhouse', 'Kyoto Animation', 'Trigger', 'Wit'];
const SHOWS = 48;
const pictured = (name) => ({
  id: name.toLowerCase(),
  name,
  animeList: Array.from({ length: SHOWS }, (_, i) => ({
    id: `anilist_anime_${2000 + i}`,
    title: `Smoke Show ${i}`,
    studio: STUDIOS[i % 6],
    seasonYear: 2001 + (i % 9),
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
      genres: [`Genre ${i % 7}`],
    }],
  })),
});
const PACK = indexPack({
  version: 5,
  shows: Object.fromEntries(Array.from({ length: SHOWS }, (_, i) => [franchiseTitleKey(`Smoke Show ${i}`), { tags: [`Tag ${i % 8}`] }])),
  characters: Object.fromEntries(Array.from({ length: SHOWS }, (_, i) => [characterNameKey(`Hero ${i}`), { voiceActorJp: `Voice ${i % 10}` }])),
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

  it('sorts a groups board on three devices, graded as sets once all are in', async () => {
    const devs = [mk('s'), mk('t'), mk('u')];
    const [A, B, C] = devs;
    await seatTable(devs, [pictured('Sam'), pictured('Tia'), pictured('Uma')]);
    await A.act((r) => r.startGame({ ...BASE, mode: 'groups', boards: 1 }, PACK));
    await until(() => devs.every((d) => d.r.view === 'round' && d.r.game?.phase === 'picking'), { what: 'board dealt' });
    expect(same(devs, (r) => r.deal)).toBe(true);
    expect(A.r.deal.mode).toBe('groups');
    const set = setOf(A.r);
    const n = set.groups.length;
    const truth = set.groups.map((g) => g.keys);

    // Sam: every group right, each listed backwards and in reverse order, with
    // every reason. Tia: right groups, no reason right. Uma: two groups'
    // first cards swapped, so two wrong.
    const right = [...truth].reverse().map((g) => [...g].reverse());
    const rightReasons = [...set.groups].reverse().map((g) => g.reason);
    const wrongReasons = rightReasons.map((r) => (r + 1) % set.reasons.length);
    const swapped = truth.map((g) => [...g]);
    [swapped[0][0], swapped[1][0]] = [swapped[1][0], swapped[0][0]];
    await A.act((r) => r.pick(null, { groups: right, reasons: rightReasons }));
    await B.act((r) => r.pick(null, { groups: right, reasons: wrongReasons }));
    await until(() => devs.every((d) => d.r.game.picks.sam && d.r.game.picks.tia), { what: 'two sorts in' });
    expect(A.r.game.phase).toBe('picking');
    await C.act((r) => r.pick(null, { groups: swapped, reasons: set.groups.map((g) => g.reason) }));
    await until(() => devs.every((d) => d.r.game.phase === 'revealed'), { what: 'board revealed' });
    // Sam: n groups and n reasons. Tia: n groups. Uma: n − 2 groups, each with its reason.
    expect(A.r.game.scores).toEqual({ sam: 3 * n, tia: 2 * n, uma: 3 * (n - 2) });
    expect(A.r.game.picks.sam).toMatchObject({ correct: true, reasonRight: true, groupsRight: n });
    expect(A.r.game.picks.uma).toMatchObject({ correct: false, groupsRight: n - 2 });
    await A.act((r) => r.next());
    await until(() => devs.every((d) => d.r.view === 'results'), { what: 'results' });
    expect(A.r.game.log[0].sorted).toEqual({ sam: n, tia: n, uma: n - 2 });
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
