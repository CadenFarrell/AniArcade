import { describe, expect, it } from 'vitest';
import {
  pictureableCharacters, portraitFor, portraitsFor, withPortraitKey,
} from './portrait';

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

describe('a chosen character', () => {
  const pic = (name, favourites) => ({ name, imageUrl: `https://img.test/${name}.jpg`, favourites });
  const player = (id, portraitKey, ...characters) => ({
    id, name: id.toUpperCase(), portraitKey, animeList: [{ title: 'Show', characters }],
  });

  it('is worn instead of the best-known character', () => {
    expect(portraitFor(player('a', 'power', pic('Makima', 900), pic('Power', 500))).name).toBe('Power');
  });

  it('matches by folded name, so accents and case do not matter', () => {
    expect(portraitFor(player('a', 'chise', pic('Makima', 900), pic('Chisé', 5))).name).toBe('Chisé');
  });

  it('falls back to Automatic once it is no longer on the list', () => {
    expect(portraitFor(player('a', 'gone', pic('Makima', 900))).name).toBe('Makima');
  });

  it('beats an automatic face, even one seated earlier', () => {
    const map = portraitsFor([
      player('a', undefined, pic('Makima', 900), pic('Power', 500)),
      player('b', 'makima', pic('Makima', 900), pic('Aki', 400)),
    ]);
    expect(map.get('b').name).toBe('Makima');
    expect(map.get('a').name).toBe('Power');
    expect(map.get('b').takenBy).toBeUndefined();
  });

  it('goes to whoever sat first when two players choose it, and says who to the other', () => {
    const map = portraitsFor([
      player('a', 'power', pic('Makima', 900), pic('Power', 500)),
      player('b', 'power', pic('Power', 500), pic('Aki', 400)),
    ]);
    expect(map.get('a')).toEqual({ name: 'Power', imageUrl: 'https://img.test/Power.jpg', show: 'Show' });
    expect(map.get('b')).toMatchObject({ name: 'Aki', takenBy: 'A' });
  });

  it('is set and cleared without leaving an undefined behind for RTDB to reject', () => {
    const base = { id: 'a', name: 'A', animeList: [] };
    const set = withPortraitKey(base, 'power');
    expect(set.portraitKey).toBe('power');
    const cleared = withPortraitKey(set, null);
    expect('portraitKey' in cleared).toBe(false);
    expect(cleared).toEqual(base);
  });

  it('is offered from one entry per person, best-known first', () => {
    const p = { animeList: [
      { title: 'S1', characters: [pic('Aki', 10), pic('Power', 50)] },
      { title: 'S2', characters: [pic('Power', 80), { name: 'No picture', favourites: 999 }] },
    ] };
    expect(pictureableCharacters(p).map((c) => [c.name, c.show, c.fav])).toEqual([
      ['Power', 'S1', 80],
      ['Aki', 'S1', 10],
    ]);
  });
});
