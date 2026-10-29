import { describe, expect, it } from 'vitest';
import { CLOCK_OPTIONS, DEFAULT_PREFS, ROUNDS_OPTIONS, cleanPrefs } from './prefs';
import { cardsNeeded, setupStatus } from './copy';
import { mergePrefs } from '../../shared/utils/gamePrefs';

describe('AniDraft prefs', () => {
  it('defaults to something the card can show', () => {
    expect(ROUNDS_OPTIONS).toContain(DEFAULT_PREFS.rounds);
    expect(CLOCK_OPTIONS.map((o) => o.value)).toContain(DEFAULT_PREFS.pickClock);
    expect(cleanPrefs(DEFAULT_PREFS)).toEqual(DEFAULT_PREFS);
  });

  it('drops a saved value of the wrong type, and one the card does not offer', () => {
    expect(mergePrefs({ rounds: 'lots', pool: 'all' }, DEFAULT_PREFS)).toEqual({ ...DEFAULT_PREFS, pool: 'all' });
    expect(cleanPrefs({ ...DEFAULT_PREFS, rounds: 4, pickClock: 45 })).toEqual(DEFAULT_PREFS);
  });
});

describe('setupStatus', () => {
  const settings = DEFAULT_PREFS;
  it('holds Start for too few or too many players, and for short lists', () => {
    expect(setupStatus({ count: 2, settings, poolSize: 999 }).ready).toBe(false);
    expect(setupStatus({ count: 9, settings, poolSize: 999 }).ready).toBe(false);
    const need = cardsNeeded(3, settings.rounds);
    expect(need).toBe(15 * 3 + 8);
    expect(setupStatus({ count: 3, settings, poolSize: need - 1 }).status).toMatch(/needs 53/);
    expect(setupStatus({ count: 3, settings, poolSize: need }).ready).toBe(true);
  });
});
