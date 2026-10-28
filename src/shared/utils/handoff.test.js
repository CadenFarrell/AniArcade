import { describe, expect, it } from 'vitest';
import { nextGameChoices, normalizeNext } from './handoff';

describe('normalizeNext', () => {
  it('reads a pick before the room exists', () => {
    expect(normalizeNext({ gameId: 'anitune', by: 'p1', byName: 'Ana' }))
      .toEqual({ gameId: 'anitune', by: 'p1', byName: 'Ana', code: null });
  });

  it('carries the code once it is written', () => {
    expect(normalizeNext({ gameId: 'anitune', by: 'p1', byName: 'Ana', code: 'AB2CD' }).code).toBe('AB2CD');
  });

  it('drops a malformed code rather than following it', () => {
    expect(normalizeNext({ gameId: 'anitune', by: 'p1', code: 'abc' }).code).toBeNull();
  });

  it('is null for anything that is not a handoff', () => {
    expect(normalizeNext(null)).toBeNull();
    expect(normalizeNext(undefined)).toBeNull();
    expect(normalizeNext('anitune')).toBeNull();
    expect(normalizeNext({ by: 'p1' })).toBeNull();
    expect(normalizeNext({ gameId: 'anitune' })).toBeNull();
  });

  it('tolerates a missing name', () => {
    expect(normalizeNext({ gameId: 'anitune', by: 'p1' }).byName).toBe('');
  });
});

describe('nextGameChoices', () => {
  const games = [
    { id: 'a', available: true },
    { id: 'b', available: true },
    { id: 'c', available: false },
  ];

  it('offers every available game but the current one', () => {
    expect(nextGameChoices(games, 'a').map((g) => g.id)).toEqual(['b']);
  });
});
