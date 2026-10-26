import { describe, expect, it } from 'vitest';
import { ANSWER_STYLES, DEFAULT_PREFS, ROUNDS_RANGE } from './prefs';
import { mergePrefs } from '../../shared/utils/gamePrefs';

describe('AniPeek prefs', () => {
  it('defaults to something the card can show', () => {
    expect(ANSWER_STYLES.map((s) => s.id)).toContain(DEFAULT_PREFS.answerStyle);
    expect(DEFAULT_PREFS.rounds).toBeGreaterThanOrEqual(ROUNDS_RANGE.min);
    expect(DEFAULT_PREFS.rounds).toBeLessThanOrEqual(ROUNDS_RANGE.max);
  });

  it('drops a saved value of the wrong type', () => {
    expect(mergePrefs({ rounds: 'lots', hints: 'yes', sharedOnly: true }, DEFAULT_PREFS))
      .toEqual({ ...DEFAULT_PREFS, sharedOnly: true });
  });
});
