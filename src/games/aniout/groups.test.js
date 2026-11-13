import { describe, expect, it } from 'vitest';
import { buildBoard, candidateGroups, countSorts, validBoard } from './groups';
import { dealGame, dealtKeys } from './deal';
import { KINDS } from './connections';
import { cardPool } from './utils/pool';
import { indexPack } from '../../shared/utils/facts';

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// Hand-built cards: `vals` gives each kind's keys; a kind left out is unknown.
const card = (key, vals = {}) => ({
  key,
  name: key,
  owners: 1,
  vals: Object.fromEntries(KINDS.map(({ id }) => [id, vals[id] ? vals[id].map((k) => ({ key: k, label: k })) : null])),
});

// Every kind known, every card on its own show, studio, year, VA and tag, so
// nothing joins two cards unless a test says so. Gender and role alternate in
// fives and threes, so neither ever splits a board into fours by itself.
const plain = (i, over = {}) => card(`k${i}`, {
  show: [`show${i}`], studio: [`studio${i}`], year: [`${1900 + i}`], source: [`SRC${i}`],
  genre: [`genre${i}`], tag: [`tag${i}`], va: [`va${i}`],
  gender: [i % 5 < 3 ? 'female' : 'male'], role: [i % 3 ? 'main' : 'supporting'], format: [`fmt${i}`], ...over,
});

// A clean 16-card board: four groups, each joined by its own studio.
function cleanBoard() {
  const cards = Array.from({ length: 16 }, (_, i) => plain(i, { studio: [`S${Math.floor(i / 4)}`] }));
  const groups = [0, 1, 2, 3].map((g) => ({ rule: { kind: 'studio', key: `S${g}` }, keys: cards.slice(g * 4, g * 4 + 4).map((c) => c.key) }));
  return { cards, groups };
}

// The independent check, written from the rule the table is told rather than
// from groups.js: four cards are a possible group when, on some kind, there is
// a value they could all hold (an unknown could hold anything) that no card
// outside them is known — or could be shown — to hold. Every partition of the
// board into such groups is counted by plain recursion.
function couldBeGroup(four, board) {
  const outside = board.filter((c) => !four.includes(c));
  return KINDS.some(({ id }) => {
    const knownIn = four.filter((c) => c.vals[id]);
    // Four unknowns could share a value nobody on record has.
    if (!knownIn.length) return true;
    const values = knownIn[0].vals[id].map((v) => v.key);
    return values.some((key) => knownIn.every((c) => c.vals[id].some((v) => v.key === key))
      && outside.every((c) => !c.vals[id]?.some((v) => v.key === key)));
  });
}
function bruteSorts(board, limit = 2) {
  let found = 0;
  const go = (left) => {
    if (found >= limit) return;
    if (!left.length) { found += 1; return; }
    const [first, ...rest] = left;
    for (let a = 0; a < rest.length; a++) {
      for (let b = a + 1; b < rest.length; b++) {
        for (let c = b + 1; c < rest.length; c++) {
          const four = [first, rest[a], rest[b], rest[c]];
          if (!couldBeGroup(four, board)) continue;
          go(rest.filter((x) => !four.includes(x)));
        }
      }
    }
  };
  go(board);
  return found;
}

describe('validBoard', () => {
  it('accepts a board that sorts one way', () => {
    const { cards, groups } = cleanBoard();
    expect(validBoard(cards, groups)).toBe(true);
    expect(bruteSorts(cards)).toBe(1);
  });

  it('refuses a group whose value a fifth card also holds', () => {
    const { cards, groups } = cleanBoard();
    cards[4] = plain(4, { studio: ['S0'] }); // a group-B card from group A's studio
    expect(validBoard(cards, groups)).toBe(false);
  });

  it('refuses a group whose value an outsider might hold (unknown)', () => {
    const { cards, groups } = cleanBoard();
    cards[4] = plain(4, { studio: undefined });
    cards[4].vals.studio = null;
    expect(validBoard(cards, groups)).toBe(false);
  });

  it('refuses a second sort, even on a check-only kind', () => {
    // Two groups' worth of cards also split cleanly by gender into fours:
    // A+B swapped halves are all women / all men.
    const { cards, groups } = cleanBoard();
    const g = (i, gender) => plain(i, { studio: [`S${Math.floor(i / 4)}`], gender: [gender] });
    const board = cards.map((c, i) => (i < 8 ? g(i, i % 4 < 2 ? 'female' : 'male') : plain(i, { studio: [`S${Math.floor(i / 4)}`], gender: ['x'] })));
    // Women: 0,1,4,5. Men: 2,3,6,7 — each exactly four, so a sort by gender
    // for the first eight beside the real C and D groups is a second answer.
    expect(validBoard(board, groups)).toBe(false);
    expect(bruteSorts(board)).toBeGreaterThan(1);
    expect(validBoard(cards, groups)).toBe(true);
  });

  it('lets a red herring through when the sort stays unique', () => {
    // A group-A card shares group B's debut year with all of B: five holders,
    // so the year is no group at all, and the studios still sort one way.
    const { cards, groups } = cleanBoard();
    const board = cards.map((c, i) => (i >= 4 && i < 8 ? plain(i, { studio: ['S1'], year: ['2006'] }) : c));
    board[0] = plain(0, { studio: ['S0'], year: ['2006'] });
    expect(validBoard(board, groups)).toBe(true);
    expect(bruteSorts(board)).toBe(1);
  });
});

describe('countSorts', () => {
  it('counts partitions, stopping at the limit', () => {
    // 8 cards, every four-set a candidate: 35 ways.
    const all = [];
    for (let m = 0; m < 256; m++) if (m.toString(2).split('1').length - 1 === 4) all.push(m);
    expect(countSorts(8, all, 100)).toBe(35);
    expect(countSorts(8, all)).toBe(2);
  });
});

describe('candidateGroups', () => {
  it('counts any four unknowns as a possible group, so an unknown board sorts many ways', () => {
    const cards = Array.from({ length: 16 }, (_, i) => card(`u${i}`, { show: [`s${i}`] }));
    const candidates = candidateGroups(cards);
    expect(candidates).toHaveLength(1820); // every four of sixteen, deduplicated across kinds
    expect(countSorts(16, candidates)).toBe(2);
  });
});

describe('buildBoard', () => {
  // A pool where groups exist: 60 cards on five studios, four years, six
  // genres, at different periods, each on its own show.
  const pool = Array.from({ length: 60 }, (_, i) => plain(i, {
    studio: [`studio${i % 5}`], year: [`${2000 + (i % 4)}`], genre: [`g${i % 6}`],
  }));

  it('builds boards that the independent check agrees sort one way', () => {
    let built = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const board = buildBoard(pool, 4, seeded(seed));
      if (!board) continue;
      built += 1;
      expect(board.cards).toHaveLength(16);
      expect(validBoard(board.cards, board.groups)).toBe(true);
      expect(bruteSorts(board.cards)).toBe(1);
    }
    expect(built).toBeGreaterThan(3);
  });

  it('returns null when the pool cannot hold a board', () => {
    expect(buildBoard(pool.slice(0, 10), 4, seeded(1))).toBeNull();
  });
});

// dealGame end to end, through cardPool and a pack (tags and voice actors
// exist nowhere else).
describe('dealGame in groups mode', () => {
  const STUDIOS = ['MAPPA', 'Bones', 'Madhouse', 'Kyoto Animation', 'Trigger', 'Wit'];
  const shows = Array.from({ length: 48 }, (_, i) => ({
    id: `s${i}`,
    title: `Show ${i}`,
    studio: STUDIOS[i % 6],
    seasonYear: 2001 + (i % 9),
    source: 'MANGA',
    format: 'TV',
    characters: [{
      id: `c${i}`, name: `Hero ${i}`, role: 'Main', gender: i % 2 ? 'Male' : 'Female',
      imageUrl: `https://img.test/${i}.jpg`, genres: [`G${i % 7}`], favourites: 100 + i,
    }],
  }));
  const players = [{ id: 'ada', name: 'Ada', animeList: shows }];
  const keys = cardPool(players).map((c) => c.key);
  const pack = indexPack({
    version: 5,
    shows: Object.fromEntries(shows.map((s, i) => [`show ${i}`, { tags: [`Tag${i % 8}`] }])),
    characters: Object.fromEntries(keys.map((k, i) => [k, { voiceActorJp: `VA ${i % 10}` }])),
  });
  const SETTINGS = { mode: 'groups', boards: 2, reasons: true, sharedOnly: false };

  it('deals the asked-for boards, each sorting one way, with every truth among the reasons', () => {
    const poolByKey = new Map(cardPool(players, {}, pack).map((c) => [c.key, c]));
    for (const seed of [1, 2, 3]) {
      const { deal, error } = dealGame(players, SETTINGS, pack, seeded(seed));
      expect(error).toBeUndefined();
      expect(deal.mode).toBe('groups');
      expect(deal.sets).toHaveLength(2);
      for (const set of deal.sets) {
        const n = set.groups.length;
        expect([3, 4]).toContain(n);
        expect(set.cards).toHaveLength(n * 4);
        expect(bruteSorts(set.cards.map((c) => poolByKey.get(c.key)))).toBe(1);
        expect(set.reasons).toHaveLength(n + 2);
        expect(new Set(set.reasons).size).toBe(n + 2);
        for (const g of set.groups) expect(set.reasons[g.reason]).toBe(g.sentence);
      }
      // No character twice across the match while the pool has fresh ones.
      expect(dealtKeys(deal)).toHaveLength(deal.sets.reduce((s, x) => s + x.cards.length, 0));
    }
  });

  it('deals no reasons with reasons off', () => {
    const { deal } = dealGame(players, { ...SETTINGS, reasons: false }, pack, seeded(4));
    for (const set of deal.sets) {
      expect(set.reasons).toEqual([]);
      for (const g of set.groups) expect(g.reason).toBe(-1);
    }
  });

  it('says how many boards a small list holds rather than dealing short', () => {
    const small = [{ id: 'bo', name: 'Bo', animeList: shows.slice(0, 10) }];
    const res = dealGame(small, SETTINGS, pack, seeded(1));
    expect(res.deal).toBeUndefined();
    expect(res.found).toBe(0);
    expect(res.error).toMatch(/boards/);
  });
});
