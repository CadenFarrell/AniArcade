import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, MIN_GAME_ROUNDS, SECONDS_OPTIONS, roundsFor } from './prefs';
import { mergePrefs } from '../../shared/utils/gamePrefs';

describe('AniName prefs', () => {
  it('defaults to something the card can show', () => {
    expect(SECONDS_OPTIONS).toContain(DEFAULT_PREFS.seconds);
  });

  it('drops a saved value of the wrong type, and the old rounds key', () => {
    expect(mergePrefs({ laps: 'lots', seconds: 45 }, DEFAULT_PREFS)).toEqual({ ...DEFAULT_PREFS, seconds: 45 });
    expect(mergePrefs({ rounds: 6 }, DEFAULT_PREFS)).toEqual(DEFAULT_PREFS);
  });

  it('lets every seat open equally often, and a small table still play a real game', () => {
    for (let n = 1; n <= 8; n++) {
      const rounds = roundsFor(DEFAULT_PREFS, n);
      expect(rounds % n).toBe(0);
      expect(rounds).toBeGreaterThanOrEqual(MIN_GAME_ROUNDS);
    }
    expect(roundsFor({ laps: 1 }, 3)).toBe(6);
    expect(roundsFor({ rounds: 3, laps: 2 }, 4)).toBe(3);
  });
});
