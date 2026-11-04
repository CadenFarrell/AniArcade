import { describe, expect, it } from 'vitest';
import {
  MAX_LAPS, MIN_LAPS, clampLaps, clampRounds, isEndless, isFinalRound, matchLabel, roundsFor,
} from './match';

describe('match', () => {
  it('treats 0, missing and garbage as endless', () => {
    expect(isEndless(0)).toBe(true);
    expect(isEndless(undefined)).toBe(true);
    expect(isEndless(3)).toBe(false);
    expect(clampRounds('x')).toBe(0);
    expect(clampRounds(-2)).toBe(0);
    expect(clampRounds(2.7)).toBe(2);
    expect(clampRounds(99)).toBe(20);
  });

  it('knows the last round, and an endless match has none', () => {
    expect(isFinalRound(2, 3)).toBe(false);
    expect(isFinalRound(3, 3)).toBe(true);
    expect(isFinalRound(40, 0)).toBe(false);
  });

  it('labels the round the way the header tab reads', () => {
    expect(matchLabel(1, 3)).toBe('Round 1 of 3');
    expect(matchLabel(3, 3)).toBe('Final round');
    expect(matchLabel(1, 1)).toBe('Round 1 of 1');
    expect(matchLabel(5, 0)).toBe('Round 5');
  });
});

describe('laps', () => {
  it('plays laps × players rounds, so every seat gets the role equally often', () => {
    expect(roundsFor(2, 3)).toBe(6);
    expect(roundsFor(1, 5)).toBe(5);
  });

  it('clamps garbage to the bounds and never plays zero rounds', () => {
    expect(clampLaps('x')).toBe(MIN_LAPS);
    expect(clampLaps(99)).toBe(MAX_LAPS);
    expect(roundsFor(2, 0)).toBe(2);
  });
});
