import { describe, expect, it } from 'vitest';
import { CHOICES_RANGE, DEFAULT_PREFS, DRAW_SECONDS, cleanPrefs } from './prefs';
import { mergePrefs } from '../../shared/utils/gamePrefs';
import { MAX_LAPS, MIN_LAPS } from '../../shared/utils/match';

describe('AniSketch prefs', () => {
  it('defaults inside what the card offers', () => {
    expect(DRAW_SECONDS).toContain(DEFAULT_PREFS.drawSeconds);
    expect(DEFAULT_PREFS.choices).toBeGreaterThanOrEqual(CHOICES_RANGE.min);
    expect(DEFAULT_PREFS.choices).toBeLessThanOrEqual(CHOICES_RANGE.max);
    expect(DEFAULT_PREFS.laps).toBeGreaterThanOrEqual(MIN_LAPS);
    expect(DEFAULT_PREFS.laps).toBeLessThanOrEqual(MAX_LAPS);
  });

  it('drops a saved value of the wrong type, and brings one out of range back', () => {
    expect(mergePrefs({ laps: 'two', sharedFirst: false }, DEFAULT_PREFS)).toEqual({ ...DEFAULT_PREFS, sharedFirst: false });
    expect(cleanPrefs({ drawSeconds: 77, choices: 9 })).toMatchObject({ drawSeconds: DEFAULT_PREFS.drawSeconds, choices: CHOICES_RANGE.max });
  });
});
