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

  it('drops awards with no player, and repeats of a title', () => {
    expect(pickAwards([award('X', null, 'd'), a('Y', 'a'), a('Y', 'b')]).map((x) => x.player.id)).toEqual(['a']);
  });

  it('shows at most four, heaviest first', () => {
    const list = [a('One', 'a'), a('Two', 'b'), a('Rare', 'c', { weight: 3 }), a('Four', 'd'), a('Five', 'e')];
    expect(pickAwards(list).map((x) => x.title)).toEqual(['Rare', 'One', 'Two', 'Four']);
  });

  it('spreads across players before giving anyone a second', () => {
    const list = [a('One', 'a', { weight: 2 }), a('Two', 'a', { weight: 2 }), a('Three', 'b'), a('Four', 'c')];
    expect(pickAwards(list, { max: 3 }).map((x) => x.title)).toEqual(['One', 'Three', 'Four']);
  });

  it('fills spare slots with second awards when the table is small', () => {
    const list = [a('One', 'a'), a('Two', 'a'), a('Three', 'b')];
    expect(pickAwards(list).map((x) => x.title)).toEqual(['One', 'Two', 'Three']);
  });

  it('makes room for a roast when one was earned', () => {
    const list = [
      a('One', 'a', { weight: 3 }), a('Two', 'b', { weight: 3 }), a('Three', 'c', { weight: 2 }),
      a('Four', 'd', { weight: 2 }), a('Oops', 'e', { roast: true }),
    ];
    const shown = pickAwards(list);
    expect(shown).toHaveLength(4);
    expect(shown.map((x) => x.title)).toEqual(['One', 'Two', 'Three', 'Oops']);
  });

  it('is empty for nothing', () => expect(pickAwards([])).toEqual([]));
});
