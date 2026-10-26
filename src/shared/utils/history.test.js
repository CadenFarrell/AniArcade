import { describe, it, expect } from 'vitest';
import {
  DUPLICATE_WINDOW_MS, MAX_PER_PROFILE, addEntries, entriesForGame, fromRanked, normalizeHistory, recordDetail,
  summarize, whenLabel,
} from './history';

const table = [{ id: 'ana', name: 'Ana' }, { id: 'ben', name: 'Ben' }, { id: 'cy', name: 'Cy' }];
const T0 = 1_800_000_000_000;

describe('entriesForGame', () => {
  it('writes one line per recorded profile, with places, scores and the rest of the table', () => {
    const out = entriesForGame({
      game: 'aniquiz', table, winnerIds: ['ana'],
      places: { ana: 1, ben: 2, cy: 3 }, scores: { ana: 9, ben: 4, cy: 1 },
      forIds: ['ana', 'ben', 'cy'], at: T0,
    });
    expect(out.ana).toMatchObject({ game: 'aniquiz', won: true, place: 1, size: 3, score: 9, with: ['Ben', 'Cy'] });
    expect(out.cy).toMatchObject({ won: false, place: 3, score: 1, with: ['Ana', 'Ben'] });
  });

  it('records only the ids it is asked to — online, a device records its own player', () => {
    const out = entriesForGame({ game: 'aniturf', table, winnerIds: ['ana', 'ben'], forIds: ['cy'], at: T0 });
    expect(Object.keys(out)).toEqual(['cy']);
    expect(out.cy).toMatchObject({ won: false, place: null });
  });

  it('counts a shared first place as a win for each, and places a winner first without being told', () => {
    const out = entriesForGame({ game: 'aniturf', table, winnerIds: ['ana', 'ben'], forIds: ['ana', 'ben'], at: T0 });
    expect(out.ana).toMatchObject({ won: true, place: 1 });
    expect(out.ben).toMatchObject({ won: true, place: 1 });
  });

  it('never calls a table of one a win', () => {
    const out = entriesForGame({ game: 'aniquiz', table: [table[0]], winnerIds: ['ana'], places: { ana: 1 }, forIds: ['ana'], at: T0 });
    expect(out.ana).toMatchObject({ won: false, place: 1, size: 1, with: [] });
  });

  it("carries everyone else's result, for head-to-head", () => {
    const out = entriesForGame({
      game: 'aniquiz', table, winnerIds: ['ana'], places: { ana: 1, ben: 2, cy: 2 }, forIds: ['ben'], at: T0,
    });
    expect(out.ben.others).toEqual([
      { name: 'Ana', place: 1, won: true },
      { name: 'Cy', place: 2, won: false },
    ]);
  });

  it('records a game nobody won as played', () => {
    const out = entriesForGame({ game: 'anirank', table, winnerIds: [], forIds: ['ana'], at: T0 });
    expect(out.ana).toMatchObject({ won: false, place: null });
  });
});

describe('addEntries', () => {
  const game = (at, scores = { ana: 3 }) => entriesForGame({ game: 'aniquiz', table, winnerIds: ['ana'], scores, forIds: ['ana'], at });

  it('skips the same game seen again moments later — a refresh on the results screen', () => {
    let h = addEntries({}, game(T0));
    h = addEntries(h, game(T0 + 1000));
    expect(h.ana).toHaveLength(1);
  });

  it('keeps a second game with a different outcome, or the same one much later', () => {
    let h = addEntries({}, game(T0));
    h = addEntries(h, game(T0 + 1000, { ana: 5 }));
    h = addEntries(h, game(T0 + DUPLICATE_WINDOW_MS + 2000, { ana: 5 }));
    expect(h.ana).toHaveLength(3);
  });

  it('keeps only the newest lines per profile', () => {
    let h = {};
    for (let i = 0; i < MAX_PER_PROFILE + 5; i++) h = addEntries(h, game(T0 + i * DUPLICATE_WINDOW_MS * 2));
    expect(h.ana).toHaveLength(MAX_PER_PROFILE);
    expect(h.ana[0].at).toBe(T0 + 5 * DUPLICATE_WINDOW_MS * 2);
  });

  it('does not mutate what it was given', () => {
    const h = addEntries({}, game(T0));
    const before = JSON.stringify(h);
    addEntries(h, game(T0 + DUPLICATE_WINDOW_MS * 3));
    expect(JSON.stringify(h)).toBe(before);
  });
});

describe('normalizeHistory', () => {
  it('drops what it cannot read and repairs what it can', () => {
    expect(normalizeHistory(null)).toEqual({});
    expect(normalizeHistory([1, 2])).toEqual({});
    const h = normalizeHistory({
      ana: [{ at: T0, game: 'aniquiz', won: 'yes', place: -1, with: ['Ben', 4] }, { at: 'x', game: 'aniquiz' }, null],
      ben: 'nope',
      cy: [],
    });
    expect(Object.keys(h)).toEqual(['ana']);
    expect(h.ana).toEqual([{ at: T0, game: 'aniquiz', won: false, place: null, size: 1, with: ['Ben'], fp: '' }]);
  });
  it("keeps a whole `others` and drops one it cannot read whole", () => {
    const line = { at: T0, game: 'aniquiz', with: ['Ben', 'Cy'] };
    const h = normalizeHistory({
      ana: [
        { ...line, others: [{ name: 'Ben', place: 2, won: 'no' }, { name: 'Cy', place: 0 }] },
        { ...line, at: T0 + 1, others: [{ name: 'Ben' }, null] },
      ],
    });
    expect(h.ana[0].others).toEqual([{ name: 'Ben', place: 2, won: false }, { name: 'Cy', place: null, won: false }]);
    expect(h.ana[1]).not.toHaveProperty('others');
  });
});

describe('summarize', () => {
  it('totals, a row per game played in menu order, and the newest lines first', () => {
    const lines = [
      { at: 1, game: 'aniquiz', won: true },
      { at: 2, game: 'aniguess', won: false },
      { at: 3, game: 'aniquiz', won: false },
    ];
    const s = summarize(lines, ['aniguess', 'anitune', 'aniquiz'], 2);
    expect(s).toMatchObject({ played: 3, won: 1 });
    expect(s.games).toEqual([
      { id: 'aniguess', played: 1, won: 0 },
      { id: 'aniquiz', played: 2, won: 1 },
    ]);
    expect(s.recent.map((e) => e.at)).toEqual([3, 2]);
  });
});

describe('fromRanked', () => {
  it('reads places and totals off a ranked list', () => {
    expect(fromRanked([{ id: 'ana', position: 1, total: 5 }, { id: 'ben', position: 1, total: 5 }, { id: 'cy' }]))
      .toEqual({ places: { ana: 1, ben: 1 }, scores: { ana: 5, ben: 5 } });
  });
});

describe('whenLabel', () => {
  const at = (y, m, d, h = 12) => new Date(y, m, d, h).getTime();
  it('counts calendar days, not 24-hour spans', () => {
    expect(whenLabel(at(2026, 9, 21, 9), at(2026, 9, 21, 22))).toBe('Today');
    expect(whenLabel(at(2026, 9, 20, 23), at(2026, 9, 21, 8))).toBe('Yesterday');
    expect(whenLabel(at(2026, 9, 17), at(2026, 9, 21))).toMatch(/\w+day$/);
    expect(whenLabel(at(2026, 8, 1), at(2026, 9, 21))).not.toMatch(/day$/);
  });
});

describe('recordDetail', () => {
  // One table, recorded from Ana's side, the way entriesForGame writes it.
  const line = (at, game, winnerIds, places = {}, scores = {}, seats = table) =>
    entriesForGame({ game, table: seats, winnerIds, places, scores, forIds: ['ana'], at }).ana;

  it('counts head-to-head from places, and a win over a loss where nothing was placed', () => {
    const lines = [
      line(1, 'aniquiz', ['ana'], { ana: 1, ben: 2, cy: 3 }),
      line(2, 'aniquiz', ['ben'], { ben: 1, ana: 2, cy: 2 }),
      // AniFake: the fake (Cy) walked; no places at all.
      line(3, 'anifake', ['cy']),
    ];
    const { rivals } = recordDetail(lines, ['aniquiz', 'anifake']);
    expect(rivals.find((r) => r.key === 'ben')).toMatchObject({ together: 3, you: 1, them: 1, tied: 0 });
    expect(rivals.find((r) => r.key === 'cy')).toMatchObject({ together: 3, you: 1, them: 1, tied: 1 });
  });

  it('gives no result between two losers nobody placed, and a tie between two winners', () => {
    const lost = line(1, 'anifake', ['cy']);
    const won = line(2, 'aniturf', ['ana', 'ben']);
    const ben = recordDetail([lost, won]).rivals.find((r) => r.key === 'ben');
    expect(ben).toMatchObject({ together: 2, you: 0, them: 0, tied: 1 });
  });

  it('counts an old line without `others` as games together and nothing more', () => {
    const old = { at: 1, game: 'aniquiz', won: true, place: 1, size: 3, with: ['Ben', 'Cy'], fp: '' };
    const ben = recordDetail([old]).rivals.find((r) => r.key === 'ben');
    expect(ben).toMatchObject({ together: 1, you: 0, them: 0, tied: 0 });
  });

  it('folds a friend met under two spellings into one row, named the newer way', () => {
    const a = line(1, 'aniquiz', ['ana'], {}, {}, [table[0], { id: 'x', name: 'liam ' }]);
    const b = line(2, 'aniquiz', ['ana'], {}, {}, [table[0], { id: 'y', name: 'Liam' }]);
    const { rivals } = recordDetail([a, b]);
    expect(rivals).toHaveLength(1);
    expect(rivals[0]).toMatchObject({ key: 'liam', name: 'Liam', together: 2, you: 2 });
  });

  it('sorts friends by games together', () => {
    const lines = [
      line(1, 'aniquiz', ['ana'], {}, {}, [table[0], table[2]]),
      line(2, 'aniquiz', ['ana']),
      line(3, 'aniquiz', ['ana'], {}, {}, [table[0], table[2]]),
    ];
    expect(recordDetail(lines).rivals.map((r) => r.key)).toEqual(['cy', 'ben']);
  });

  it('keeps per-game bests in menu order', () => {
    const lines = [
      line(10, 'aniquiz', ['ben'], { ben: 1, ana: 3, cy: 2 }, { ana: 4 }),
      line(20, 'aniguess', ['ana'], { ana: 1 }),
      line(30, 'aniquiz', ['ben'], { ben: 1, ana: 2, cy: 3 }, { ana: 9 }),
    ];
    const { games, played, won } = recordDetail(lines, ['aniguess', 'aniquiz']);
    expect({ played, won }).toEqual({ played: 3, won: 1 });
    expect(games).toEqual([
      { id: 'aniguess', played: 1, won: 1, bestPlace: 1, bestScore: null, lastAt: 20 },
      { id: 'aniquiz', played: 2, won: 0, bestPlace: 2, bestScore: 9, lastAt: 30 },
    ]);
  });

  it('runs streaks over games a person could win, and logs newest first', () => {
    const solo = line(3, 'aniquiz', ['ana'], { ana: 1 }, {}, [table[0]]);
    const lines = [
      line(1, 'aniquiz', ['ana']), line(2, 'aniquiz', ['ana']), solo,
      line(4, 'aniquiz', ['ana']), line(5, 'aniquiz', ['ben']), line(6, 'aniquiz', ['ana']),
    ];
    const d = recordDetail(lines);
    expect(d.streak).toEqual({ current: 1, best: 3 });
    expect(d.log.map((e) => e.at)).toEqual([6, 5, 4, 3, 2, 1]);
  });
});
