import { describe, expect, it } from 'vitest';
import {
  LOBBY_VIEWS, addNightLine, carriedNight, lineWinners, nightLatchStale, nightPoints, nightStandings, normalizeNight,
} from './night';

const table = [
  { id: 'a', name: 'Ana' }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Cy' }, { id: 'd', name: 'Di' },
];
const pts = (rows) => Object.fromEntries(rows.map((r) => [r.name, r.pts]));
const line = (game, results) => ({
  game, title: game, results: Object.entries(results).map(([name, p]) => ({ name, pts: p })),
});

describe('nightPoints: a point for every player finished above', () => {
  it('scores a ranked table by players beaten', () => {
    const rows = nightPoints({ table, winnerIds: ['a'], places: { a: 1, b: 2, c: 3, d: 4 } });
    expect(pts(rows)).toEqual({ Ana: 3, Ben: 2, Cy: 1, Di: 0 });
  });

  it('gives a tie nothing over each other', () => {
    const rows = nightPoints({ table, winnerIds: ['a', 'b'], places: { a: 1, b: 1, c: 3, d: 4 } });
    expect(pts(rows)).toEqual({ Ana: 2, Ben: 2, Cy: 1, Di: 0 });
  });

  it('puts a winning team above the losing one (AniTurf writes 1 and 2)', () => {
    const rows = nightPoints({ table, winnerIds: ['a', 'c'], places: { a: 1, b: 2, c: 1, d: 2 } });
    expect(pts(rows)).toEqual({ Ana: 2, Ben: 0, Cy: 2, Di: 0 });
  });

  it('places a winner first and everyone unplaced last, level with each other', () => {
    const rows = nightPoints({ table, winnerIds: ['b'] });
    expect(pts(rows)).toEqual({ Ana: 0, Ben: 3, Cy: 0, Di: 0 });
  });

  it('adds nothing for a game that ranks nobody', () => {
    expect(nightPoints({ table, winnerIds: [] })).toBeNull();
    expect(nightPoints({ table: table.slice(0, 1), winnerIds: ['a'], places: { a: 1 } })).toBeNull();
  });
});

describe('normalizeNight: what Realtime Database hands back', () => {
  const one = line('aniwave', { Ana: 1, Ben: 0 });
  const two = line('anitag', { Ana: 0, Ben: 1 });

  it('is null for nothing, and for a node with no usable game', () => {
    expect(normalizeNight(null)).toBeNull();
    expect(normalizeNight({ games: [] })).toBeNull();
    expect(normalizeNight({ games: [{ game: 'x', results: [{ name: 'Ana', pts: 1 }] }] })).toBeNull();
  });

  it('reads a list stored whole, with holes, or as an object keyed by index', () => {
    const sparse = [];
    sparse[0] = one;
    sparse[2] = two;
    for (const games of [[one, two], sparse, { 0: one, 3: two }]) {
      expect(normalizeNight({ games }).games.map((g) => g.game)).toEqual(['aniwave', 'anitag']);
    }
  });

  it('repairs a line: a dropped zero is zero, a missing title is the id', () => {
    const night = normalizeNight({ games: [{ game: 'aniwave', results: { 0: { name: 'Ana', pts: 1 }, 1: { name: 'Ben' } } }] });
    expect(night.games[0]).toEqual({
      game: 'aniwave', title: 'aniwave', results: [{ name: 'Ana', pts: 1 }, { name: 'Ben', pts: 0 }],
    });
    expect(night).toMatchObject({ counted: false, ended: null });
  });

  it('keeps an ending only when it names who called it', () => {
    expect(normalizeNight({ games: [one], ended: { by: 'ana', byName: 'Ana' } }).ended).toEqual({ by: 'ana', byName: 'Ana' });
    expect(normalizeNight({ games: [one], ended: true }).ended).toBeNull();
  });
});

describe('addNightLine: one line per game', () => {
  const first = line('aniturf', { Ana: 1, Ben: 0 });

  it('starts a night, and appends to one in the next room', () => {
    const night = addNightLine(null, first);
    expect(night).toEqual({ games: [first], counted: true });
    // Carried into another game's room: the games, with the latch left behind.
    const next = addNightLine(carriedNight(night), line('anitag', { Ana: 0, Ben: 1 }));
    expect(next.games).toHaveLength(2);
    expect(next.counted).toBe(true);
  });

  it('is a no-op once the game is counted: a second device, a refresh', () => {
    const night = addNightLine(null, first);
    expect(addNightLine(night, first)).toBeUndefined();
    // Even a device that worked the outcome out differently adds nothing.
    expect(addNightLine(night, line('aniturf', { Ana: 0, Ben: 1 }))).toBeUndefined();
  });

  it('holds while the view moves under a results screen that is still up', () => {
    // AniQuiz: its results come up on 'round' (the game's phase is finished)
    // and the view turns to 'results' a moment later. Re-arming on that change
    // counted one game three times.
    const night = normalizeNight(addNightLine(null, first));
    for (const view of ['round', 'results', 'final', 'leaderboard', undefined]) {
      expect(nightLatchStale(night, view), String(view)).toBe(false);
    }
  });

  it('counts an identical result again once the room has been back to the lobby', () => {
    const night = addNightLine(null, first);
    for (const view of LOBBY_VIEWS) expect(nightLatchStale(normalizeNight(night), view)).toBe(true);
    // What the re-arm leaves in the room.
    const rearmed = { games: night.games };
    expect(nightLatchStale(normalizeNight(rearmed), 'lobby')).toBe(false);
    expect(addNightLine(rearmed, first).games).toHaveLength(2);
  });

  it('writes nothing Realtime Database would refuse', () => {
    const night = addNightLine(null, { ...first, accent: undefined });
    expect(JSON.stringify(night)).not.toMatch(/null|undefined/);
    expect('accent' in night.games[0]).toBe(false);
  });

  it('refuses a line that ranks nobody', () => {
    expect(addNightLine(null, { game: 'x', results: [] })).toBeUndefined();
  });
});

// The latch re-arms only in a lobby, so a game whose replay sends the room
// anywhere else would be counted once a room however often it was played —
// silently. Read from each room hook's source, like hub/awards.test.js: a new
// game is checked the day it is added.
describe('every game replays through a lobby the night knows', () => {
  const hooks = import.meta.glob('../../games/*/hooks/*.js', { query: '?raw', import: 'default', eager: true });
  const replays = Object.entries(hooks)
    .filter(([file, src]) => !file.includes('.test.') && /const returnToLobby = /.test(src))
    .map(([file, src]) => {
      const body = src.slice(src.indexOf('const returnToLobby = '));
      return [file.split('/games/')[1], body.match(/view: '([^']+)'/)?.[1] ?? null];
    });

  it('finds every online game', () => {
    const folders = Object.keys(import.meta.glob('../../games/*/OnlineGame.jsx')).map((f) => f.split('/games/')[1].split('/')[0]);
    expect(folders.length).toBeGreaterThan(10);
    expect(replays.map(([file]) => file.split('/')[0]).sort()).toEqual(folders.sort());
  });

  it.each(replays)('%s returns to a lobby view', (_file, view) => {
    expect(LOBBY_VIEWS).toContain(view);
  });
});


describe('carriedNight', () => {
  it('takes the games into the next room and leaves this room\'s moment behind', () => {
    const night = { games: [line('aniwave', { Ana: 1, Ben: 0 })], counted: true, ended: { by: 'ana' } };
    expect(carriedNight(night)).toEqual({ games: night.games });
    expect(carriedNight(null)).toBeNull();
  });
});

describe('nightStandings', () => {
  const night = normalizeNight({
    games: [
      line('aniwave', { Ana: 2, Ben: 1, Cy: 0 }),
      line('anitag', { 'ana ': 0, Ben: 2, Cy: 1 }),
      line('anipeek', { Ana: 1, Di: 0 }),
    ],
  });

  it('totals by folded name, so one person under two spellings is one row', () => {
    const rows = nightStandings(night);
    expect(rows.map((r) => [r.name, r.total, r.played])).toEqual([
      ['Ana', 3, 3], ['Ben', 3, 2], ['Cy', 1, 2], ['Di', 0, 1],
    ]);
  });

  it('lets a tie share its place', () => {
    expect(nightStandings(night).map((r) => r.position)).toEqual([1, 1, 3, 4]);
  });

  it('is empty for no night', () => {
    expect(nightStandings(null)).toEqual([]);
  });
});

describe('lineWinners', () => {
  it('names everyone on the top score, and nobody when nobody beat anyone', () => {
    expect(lineWinners(line('x', { Ana: 2, Ben: 2, Cy: 0 }))).toEqual(['Ana', 'Ben']);
    expect(lineWinners(line('x', { Ana: 0, Ben: 0 }))).toEqual([]);
  });
});
