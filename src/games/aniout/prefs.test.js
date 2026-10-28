import { describe, expect, it } from 'vitest';
import { CARDS_RANGE, DEFAULT_PREFS, ROUNDS_RANGE } from './prefs';
import { mergePrefs } from '../../shared/utils/gamePrefs';

describe('AniOut prefs', () => {
  it('defaults inside the ranges the card offers', () => {
    expect(DEFAULT_PREFS.rounds).toBeGreaterThanOrEqual(ROUNDS_RANGE.min);
    expect(DEFAULT_PREFS.rounds).toBeLessThanOrEqual(ROUNDS_RANGE.max);
    expect(DEFAULT_PREFS.cards).toBeGreaterThanOrEqual(CARDS_RANGE.min);
    expect(DEFAULT_PREFS.cards).toBeLessThanOrEqual(CARDS_RANGE.max);
  });

  it('drops a saved value of the wrong type', () => {
    expect(mergePrefs({ rounds: 'lots', reasons: 'yes', sharedOnly: true }, DEFAULT_PREFS))
      .toEqual({ ...DEFAULT_PREFS, sharedOnly: true });
  });
});
