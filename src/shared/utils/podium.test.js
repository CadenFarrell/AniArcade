import { describe, expect, it } from 'vitest';
import { splitPodium } from './podium';
import { KANA } from '../ui/kanaText';

const row = (id, position) => ({ id, name: id, position });

describe('splitPodium', () => {
  it('puts the outright winner in the splash and everyone else in the list', () => {
    const out = splitPodium([row('a', 1), row('b', 2), row('c', 3)]);
    expect(out.winners.map((p) => p.id)).toEqual(['a']);
    expect(out.rest.map((p) => p.id)).toEqual(['b', 'c']);
    expect(out.stamp).toBe('Winner');
    expect(out.kana).toBe(KANA.winner);
  });

  it('shares the splash across a tie for first rather than picking one', () => {
    const out = splitPodium([row('a', 1), row('b', 1), row('c', 3)]);
    expect(out.winners.map((p) => p.id)).toEqual(['a', 'b']);
    expect(out.rest.map((p) => p.id)).toEqual(['c']);
    expect(out.stamp).toBe('Tied');
    expect(out.kana).toBe(KANA.draw);
  });

  it('does not call a solo player the winner', () => {
    const out = splitPodium([row('a', 1)]);
    expect(out.winners).toHaveLength(1);
    expect(out.rest).toEqual([]);
    expect(out.stamp).toBe('Finished');
  });

  it('copes with nobody at all', () => {
    expect(splitPodium([])).toMatchObject({ winners: [], rest: [] });
    expect(splitPodium()).toMatchObject({ winners: [], rest: [] });
  });
});
