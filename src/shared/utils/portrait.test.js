import { describe, expect, it } from 'vitest';
import { portraitFor, portraitsFor } from './portrait';

const profile = (...characters) => ({ animeList: [{ title: 'Show', characters }] });

describe('a player portrait', () => {
  it('is the most-favourited character that has a picture', () => {
    const p = profile(
      { name: 'Famous, no picture', favourites: 9000 },
      { name: 'Known', imageUrl: 'https://img.test/known.jpg', favourites: 500 },
      { name: 'Obscure', imageUrl: 'https://img.test/obscure.jpg', favourites: 3 },
    );
    expect(portraitFor(p)).toEqual({ name: 'Known', imageUrl: 'https://img.test/known.jpg', show: 'Show' });
  });

  it('is stable: the same profile always gives the same face', () => {
    const p = profile(
      { name: 'A', imageUrl: 'https://img.test/a.jpg', favourites: 10 },
      { name: 'B', imageUrl: 'https://img.test/b.jpg', favourites: 10 },
    );
    expect(portraitFor(p).name).toBe('A');
    expect(portraitFor(p).name).toBe('A');
  });

  it('is null with nothing to show', () => {
    expect(portraitFor(null)).toBeNull();
    expect(portraitFor({})).toBeNull();
    expect(portraitFor(profile({ name: 'Hand-entered' }))).toBeNull();
  });
});

describe('portraits across a table', () => {
  const pic = (name, favourites) => ({ name, imageUrl: `https://img.test/${name}.jpg`, favourites });
  const player = (id, ...characters) => ({ id, animeList: [{ title: 'Show', characters }] });

  it('never puts one character on two seated players', () => {
    const map = portraitsFor([
      player('a', pic('Makima', 900), pic('Power', 500)),
      player('b', pic('Makima', 900), pic('Aki', 400)),
    ]);
    expect(map.get('a').name).toBe('Makima');
    expect(map.get('b').name).toBe('Aki');
  });

  it("falls back to a player's own best face when every one is taken", () => {
    const map = portraitsFor([player('a', pic('Makima', 900)), player('b', pic('Makima', 900))]);
    expect(map.get('b').name).toBe('Makima');
  });

  it('gives a player with no pictures null', () => {
    expect(portraitsFor([{ id: 'x', animeList: [] }]).get('x')).toBeNull();
  });
});
