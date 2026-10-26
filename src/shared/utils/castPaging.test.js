import { describe, expect, it } from 'vitest';
import { filterAndMapCharacterEdges, mergeCharacterEdges } from './anilistFormat';
import { membersToPage, pageCasts, unseenBound } from './castPaging';

const PER_PAGE = 25;
const ROLE_ORDER = { MAIN: 0, SUPPORTING: 1, BACKGROUND: 2 };

// A deterministic stand-in for AniList: casts sorted the way the real query
// sorts them, served 25 to a page, counting every page asked for.
function fakeAniList(casts) {
  const sorted = new Map([...casts].map(([id, edges]) => [id, [...edges].sort((a, b) =>
    ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || b.node.favourites - a.node.favourites)]));
  const fetchPage = async (ids, page, { onBatch } = {}) => {
    fetchPage.pages += ids.length;
    const out = new Map(ids.map((id) => {
      const all = sorted.get(id) ?? [];
      const edges = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
      return [id, { genres: [], edges, hasNextPage: all.length > page * PER_PAGE }];
    }));
    onBatch?.(out);
    return out;
  };
  fetchPage.pages = 0;
  return fetchPage;
}

const edge = (id, role, favourites) => ({ role, node: { id, name: { full: `C${id}` }, favourites } });

// Seeded so a failure replays. Favourites are distinct across the whole cast:
// the one inexactness the paging allows is a tie with the cap's floor.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function makeFranchises(seed, count) {
  const rand = rng(seed);
  const casts = new Map();
  const groups = [];
  let nextChar = 1;
  let nextMedia = 1;
  const used = new Set();
  const favourites = () => {
    for (;;) {
      const f = Math.floor(30000 * rand() ** 3);
      if (!used.has(f)) { used.add(f); return f; }
    }
  };
  for (let f = 0; f < count; f++) {
    const seasons = 1 + Math.floor(rand() * 5);
    // A pool the seasons draw from, so characters recur across seasons, at
    // their one favourites count, sometimes in a different role.
    const pool = Array.from({ length: 10 + Math.floor(rand() * 260) }, () => ({ id: nextChar++, fav: favourites() }));
    const group = [];
    for (let s = 0; s < seasons; s++) {
      const id = nextMedia++;
      group.push(id);
      const cast = pool.filter(() => rand() < 0.6).map((c) => {
        const r = rand();
        const role = r < 0.08 ? 'MAIN' : r < 0.85 ? 'SUPPORTING' : 'BACKGROUND';
        return edge(c.id, role, c.fav);
      });
      casts.set(id, cast);
    }
    groups.push(group);
  }
  return { casts, groups };
}

const castOf = (result, group, opts) => filterAndMapCharacterEdges(
  mergeCharacterEdges(group.map((id) => result.get(id).edges)),
  { ...opts, maxCharacters: 60 },
).map((c) => c.id).sort();

describe('pageCasts', () => {
  for (const opts of [
    { minSupportingFavourites: 0, mainOnly: false },
    { minSupportingFavourites: 100, mainOnly: false },
    { minSupportingFavourites: 1000, mainOnly: false },
    { minSupportingFavourites: 100, mainOnly: true },
  ]) {
    it(`keeps the same casts as paging every show alone (${JSON.stringify(opts)})`, async () => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const { casts, groups } = makeFranchises(seed, 40);

        // The old behaviour: every member its own group, no cap known.
        const oldFetch = fakeAniList(casts);
        const old = await pageCasts(groups.flat().map((id) => [id]), oldFetch, { ...opts, maxPages: 99 });
        const newFetch = fakeAniList(casts);
        const now = await pageCasts(groups, newFetch, { ...opts, max: 60, maxPages: 99 });

        for (const group of groups) {
          expect(castOf(now, group, opts), `seed ${seed}, franchise ${group}`).toEqual(castOf(old, group, opts));
        }
        expect(newFetch.pages).toBeLessThanOrEqual(oldFetch.pages);
      }
    });
  }

  it('stops a long-runner at the cap instead of its twelfth page', async () => {
    // One show, 300 supporting characters, all well above the threshold.
    const cast = Array.from({ length: 300 }, (_, i) => edge(i + 1, i < 8 ? 'MAIN' : 'SUPPORTING', 50000 - i * 10));
    const fetch = fakeAniList(new Map([[1, cast]]));
    await pageCasts([[1]], fetch, { minSupportingFavourites: 100, max: 60 });
    // 60 kept needs three pages (75 seen); the old loop read all twelve.
    expect(fetch.pages).toBe(3);
  });

  it('counts finished franchises, not seasons', async () => {
    const casts = new Map([[1, [edge(1, 'MAIN', 10)]], [2, [edge(1, 'MAIN', 10)]], [3, [edge(2, 'MAIN', 5)]]]);
    const seen = [];
    await pageCasts([[1, 2], [3]], fakeAniList(casts), { onProgress: (n) => seen.push(n) });
    expect(seen.at(-1)).toBe(2);
  });

  it('gives an id AniList did not return an empty cast', async () => {
    const fetch = async () => new Map();
    const result = await pageCasts([[7]], fetch);
    expect(result.get(7)).toEqual({ genres: [], edges: [] });
  });
});

describe('unseenBound', () => {
  it('is the last supporting edge, unbounded after a main one', () => {
    expect(unseenBound([edge(1, 'MAIN', 5), edge(2, 'SUPPORTING', 300)], { mainOnly: false })).toBe(300);
    expect(unseenBound([edge(1, 'MAIN', 5)], { mainOnly: false })).toBe(Infinity);
    expect(unseenBound([edge(1, 'MAIN', 5)], { mainOnly: true })).toBe(5);
    expect(unseenBound([edge(1, 'BACKGROUND', 9000)], { mainOnly: false })).toBe(-Infinity);
  });
});

describe('membersToPage', () => {
  it('drops a season that cannot reach the franchise top 60', () => {
    const plenty = Array.from({ length: 60 }, (_, i) => edge(i + 1, 'SUPPORTING', 10000 - i));
    const stars = Array.from({ length: 30 }, (_, i) => edge(i + 100, 'SUPPORTING', 20000 - i));
    const state = new Map([
      [1, { edges: plenty, lastPageEdges: plenty.slice(-25), done: false }],
      [2, { edges: stars, lastPageEdges: stars.slice(-25), done: false }],
    ]);
    // The 60th best is now season 1's 30th (9971). Season 1's next page is at
    // most 9941, so it cannot place; season 2's could be up to 19971.
    expect(membersToPage([1, 2], state, { minSupportingFavourites: 0, mainOnly: false, max: 60 })).toEqual([2]);
  });
});
