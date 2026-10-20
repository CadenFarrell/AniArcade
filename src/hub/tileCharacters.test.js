import { describe, expect, it } from 'vitest';
import { drawTileCharacters, tileCandidates } from './tileCharacters';

const char = (name, imageUrl = `https://img.test/${name}.jpg`) => ({ name, imageUrl });
const profile = (...shows) => ({
  animeList: shows.map(([title, characters]) => ({ title, characters })),
});
const GAMES = ['a', 'b', 'c'];

describe('tile candidates', () => {
  it('takes only characters with a portrait, and remembers their show', () => {
    const p = profile(['Show One', [char('Ann'), { name: 'Bo' }, char('Cy', '  ')]]);
    expect(tileCandidates(p)).toEqual([{ name: 'Ann', imageUrl: 'https://img.test/Ann.jpg', show: 'Show One' }]);
  });

  it('counts one person once, however many seasons list them', () => {
    // The same character imported under two seasons, one with diacritics.
    const p = profile(['S1', [char('Rimuru Tempest')]], ['S2', [char('Rímuru Tempest', 'https://img.test/other.jpg')]]);
    expect(tileCandidates(p).map((c) => c.name)).toEqual(['Rimuru Tempest']);
  });

  it('survives a missing or half-shaped profile', () => {
    expect(tileCandidates(null)).toEqual([]);
    expect(tileCandidates({})).toEqual([]);
    expect(tileCandidates({ animeList: [{ title: 'X' }] })).toEqual([]);
  });
});

describe('drawing the board', () => {
  it('puts a different character on every tile', () => {
    const p = profile(['S', ['Ann', 'Bo', 'Cy', 'Di', 'Ed'].map((n) => char(n))]);
    const drawn = drawTileCharacters(p, GAMES);
    const names = GAMES.map((id) => drawn[id].name);
    expect(new Set(names).size).toBe(3);
  });

  it('fills what it can and leaves the rest bare', () => {
    const drawn = drawTileCharacters(profile(['S', [char('Ann')]]), GAMES);
    expect(drawn.a.name).toBe('Ann');
    expect(drawn.b).toBeNull();
    expect(drawn.c).toBeNull();
  });

  it('gives every tile null with no profile', () => {
    expect(drawTileCharacters(null, GAMES)).toEqual({ a: null, b: null, c: null });
  });

  it('draws differently on different visits', () => {
    // Two draws with different random streams over a big pool should not
    // agree on every tile — the point of a fresh draw each visit.
    const p = profile(['S', Array.from({ length: 40 }, (_, i) => char(`C${i}`))]);
    const seq = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const one = drawTileCharacters(p, GAMES, seq(1));
    const two = drawTileCharacters(p, GAMES, seq(99));
    expect(GAMES.map((id) => one[id].name)).not.toEqual(GAMES.map((id) => two[id].name));
  });
});
