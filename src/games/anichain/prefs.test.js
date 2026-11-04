import { describe, expect, it } from 'vitest';
import { CAP_OPTIONS, DEFAULT_PREFS, ROUNDS_OPTIONS, WORD_CLOCK_OPTIONS, cleanPrefs } from './prefs';
import { mergePrefs } from '../../shared/utils/gamePrefs';

describe('AniChain prefs', () => {
  it('defaults to something the card can show', () => {
    expect(CAP_OPTIONS).toContain(DEFAULT_PREFS.cap);
    expect(ROUNDS_OPTIONS).toContain(DEFAULT_PREFS.rounds);
    expect(WORD_CLOCK_OPTIONS.map((o) => o.value)).toContain(DEFAULT_PREFS.wordClock);
    expect(cleanPrefs(DEFAULT_PREFS)).toEqual(DEFAULT_PREFS);
  });

  it('drops a saved value of the wrong type, and one the card does not offer', () => {
    expect(mergePrefs({ cap: 'lots', rounds: 4 }, DEFAULT_PREFS)).toEqual({ ...DEFAULT_PREFS, rounds: 4 });
    expect(cleanPrefs({ ...DEFAULT_PREFS, shape: 'trios', cap: 7 })).toEqual(DEFAULT_PREFS);
    expect(cleanPrefs({ ...DEFAULT_PREFS, wordClock: 15 })).toEqual(DEFAULT_PREFS);
    expect(cleanPrefs({ ...DEFAULT_PREFS, wordClock: 20 }).wordClock).toBe(20);
  });
});
