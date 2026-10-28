import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, ROUNDS_RANGE, SECONDS_OPTIONS } from './prefs';
import { mergePrefs } from '../../shared/utils/gamePrefs';

describe('AniName prefs', () => {
  it('defaults to something the card can show', () => {
    expect(SECONDS_OPTIONS).toContain(DEFAULT_PREFS.seconds);
    expect(DEFAULT_PREFS.rounds).toBeGreaterThanOrEqual(ROUNDS_RANGE.min);
    expect(DEFAULT_PREFS.rounds).toBeLessThanOrEqual(ROUNDS_RANGE.max);
  });

  it('drops a saved value of the wrong type', () => {
    expect(mergePrefs({ rounds: 'lots', seconds: 45 }, DEFAULT_PREFS)).toEqual({ ...DEFAULT_PREFS, seconds: 45 });
  });
});
