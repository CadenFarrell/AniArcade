import { describe, expect, it } from 'vitest';
import { RECENT_GAMES, cleanMap, preferFresh, recentFrom, withDealt } from './recentDeals';

describe('recent deals', () => {
  it('keeps each game apart, newest first, at most RECENT_GAMES deep', () => {
    let map = {};
    for (let g = 0; g < RECENT_GAMES + 2; g++) map = withDealt(map, 'anipeek', [`p${g}`]);
    map = withDealt(map, 'aniturf', ['t0']);
    expect(map.anipeek).toHaveLength(RECENT_GAMES);
    expect(map.anipeek[0]).toEqual([`p${RECENT_GAMES + 1}`]);
    expect([...recentFrom(map, 'aniturf')]).toEqual(['t0']);
    expect(recentFrom(map, 'anipeek').has('p0')).toBe(false);
  });

  it('repairs garbage and ignores an empty deal', () => {
    expect(cleanMap({ a: 'x', b: [[1, 'ok'], []], c: [] })).toEqual({ b: [['ok']] });
    expect(cleanMap(null)).toEqual({});
    expect(withDealt({}, 'x', [])).toEqual({});
  });

  it('prefers the unseen, but never narrows a pool below what the deal needs', () => {
    const pool = ['a', 'b', 'c', 'd'];
    const recent = new Set(['a', 'b']);
    expect(preferFresh(pool, (x) => x, recent, 2)).toEqual(['c', 'd']);
    expect(preferFresh(pool, (x) => x, recent, 3)).toEqual(pool);
    expect(preferFresh(pool, (x) => x, new Set(), 2)).toEqual(pool);
  });
});
