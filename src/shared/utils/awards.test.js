import { describe, expect, it } from 'vitest';
import {
  award, clearBest, clearLeader, longestRuns, pickAwards, sumBy, tally, times,
} from './awards';

const P = (id) => ({ id, name: id.toUpperCase() });

describe('tally and sumBy', () => {
  it('counts every id a line credits, skipping null lines and null ids', () => {
    const log = [{ got: ['a', 'b'] }, null, { got: ['a'] }, { got: [null] }, { got: 'b' }];
    expect(tally(log, (l) => l.got)).toEqual({ a: 2, b: 2 });
  });
  it('adds amounts per id and ignores non-numbers', () => {
    const log = [{ d: { a: 2, b: -1 } }, { d: { a: 3, b: NaN } }, null];
    expect(sumBy(log, (l) => l.d)).toEqual({ a: 5, b: -1 });
  });
});

describe('clearLeader', () => {
  it('names the one leader', () => expect(clearLeader({ a: 3, b: 1 })).toEqual({ id: 'a', n: 3 }));
  it('drops a tie at the top', () => expect(clearLeader({ a: 3, b: 3, c: 1 })).toBeNull());
  it('drops a leader under the minimum', () => expect(clearLeader({ a: 1 }, { min: 2 })).toBeNull());
  it('finds the fewest, counting listed ids with no rows as zero', () => {
    expect(clearLeader({ a: 2, b: 1 }, { dir: 'min', ids: ['a', 'b', 'c'] })).toEqual({ id: 'c', n: 0 });
    expect(clearLeader({ a: 2, b: 5 }, { dir: 'min', max: 1 })).toBeNull();
  });
  it('is null for nothing', () => expect(clearLeader({})).toBeNull());
});

describe('clearBest', () => {
  const items = [{ by: 'a', v: 3 }, { by: 'b', v: 5 }, { by: 'a', v: 5 }];
  it('drops a tie between two players', () => expect(clearBest(items, (x) => x.v)).toBeNull());
  it('keeps a tie held by one player', () => {
    expect(clearBest([{ by: 'a', v: 5 }, { by: 'a', v: 5 }, { by: 'b', v: 1 }], (x) => x.v).by).toBe('a');
  });
  it('finds the lowest, skipping non-numbers', () => {
    expect(clearBest([...items, { by: 'c', v: null }], (x) => x.v, { dir: 'min' })).toEqual({ by: 'a', v: 3 });
  });
});

describe('longestRuns', () => {
  it('measures each id’s longest streak; a null line breaks every run', () => {
    const log = [['a', 'b'], ['a'], ['a', 'b'], null, ['b'], ['b'], ['b']].map((got) => (got ? { got } : null));
    expect(longestRuns(log, (l) => l.got)).toEqual({ a: 3, b: 3 });
  });
});

describe('times', () => {
  it('pluralises', () => {
    expect(times(1)).toBe('1 time');
    expect(times(3, 'clue')).toBe('3 clues');
  });
});

describe('pickAwards', () => {
  const a = (title, id, opts) => award(title, P(id), 'why', opts);
  const good = (title, id, opts = {}) => a(title, id, opts);
  const bad = (title, id, opts = {}) => a(title, id, { ...opts, roast: true });

  it('drops awards with no player, and repeats of a title', () => {
    expect(pickAwards([award('X', null, 'd'), a('Y', 'a'), a('Y', 'b')]).map((x) => x.player.id)).toEqual(['a']);
  });

  it('shows two good and two roasts, good first, heaviest first on each side', () => {
    const list = [
      good('G1', 'a'), good('G2', 'b', { weight: 3 }), good('G3', 'c'),
      bad('B1', 'd'), bad('B2', 'e', { weight: 2 }), bad('B3', 'f'),
    ];
    expect(pickAwards(list).map((x) => x.title)).toEqual(['G2', 'G1', 'B2', 'B1']);
  });

  it('hands a short side’s slots to the other', () => {
    const list = [good('G1', 'a'), good('G2', 'b'), good('G3', 'c'), bad('B1', 'd')];
    expect(pickAwards(list).map((x) => x.title)).toEqual(['G1', 'G2', 'G3', 'B1']);
    expect(pickAwards([bad('B1', 'a'), bad('B2', 'b'), bad('B3', 'c')]).map((x) => x.title)).toEqual(['B1', 'B2', 'B3']);
  });

  it('names someone new on each turn while it can', () => {
    const list = [good('G1', 'a', { weight: 3 }), good('G2', 'a', { weight: 2 }), good('G3', 'b'), bad('B1', 'a', { weight: 3 }), bad('B2', 'c')];
    expect(pickAwards(list).map((x) => [x.title, x.player.id])).toEqual([
      ['G1', 'a'], ['G3', 'b'], ['B1', 'a'], ['B2', 'c'],
    ]);
  });

  it('gives a second award once everyone at the table has one', () => {
    const list = [good('G1', 'a'), good('G2', 'a'), bad('B1', 'a')];
    expect(pickAwards(list).map((x) => x.title)).toEqual(['G1', 'G2', 'B1']);
  });

  it('is empty for nothing', () => expect(pickAwards([])).toEqual([]));
});
