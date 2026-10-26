import { describe, expect, it } from 'vitest';
import { dealGame } from './deal';
import { portraitPool, hasPortrait } from './utils/pool';
import { SPARES } from './rules';

// A deterministic rng, so a failure replays.
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const char = (name, extra = {}) => ({
  id: name, name, role: 'MAIN', gender: 'Female', imageUrl: `https://s4.anilist.co/c/${name}.jpg`, favourites: 10, ...extra,
});

const show = (title, names, extra = {}) => ({ id: title, title, characters: names.map((n) => (typeof n === 'string' ? char(n) : n)), ...extra });

// Each wears a face that is on nobody else's list, so the shared pool is
// untouched by the rule that keeps worn faces out of it.
const ann = {
  id: 'ann',
  name: 'Ann',
  portraitKey: 'spike',
  animeList: [
    show('Frieren', ['Frieren', 'Fern', 'Stark', 'Himmel'], { studio: 'Madhouse', format: 'TV', source: 'MANGA', seasonYear: 2023 }),
    show('Cowboy Bebop', ['Spike', 'Faye', 'Jet', char('Ein', { imageUrl: 'https://s4.anilist.co/c/default.jpg' })]),
  ],
};
const ben = {
  id: 'ben',
  name: 'Ben',
  portraitKey: 'hitori',
  animeList: [
    show('Frieren', ['Frieren', 'Fern', 'Stark']),
    show('Bocchi the Rock!', ['Hitori', 'Nijika', 'Ryo', 'Kita', char('Seika', { imageUrl: '' })]),
  ],
};

describe('the pool', () => {
  it('needs a real portrait — not a blank, not AniList\'s default.jpg', () => {
    expect(hasPortrait('https://s4.anilist.co/c/x.jpg')).toBe(true);
    expect(hasPortrait('https://s4.anilist.co/c/default.jpg')).toBe(false);
    expect(hasPortrait('')).toBe(false);
    const keys = portraitPool([ann, ben]).map((r) => r.entry.id);
    expect(keys).not.toContain('ein');
    expect(keys).not.toContain('seika');
    expect(keys).toHaveLength(9);
  });

  it('never holds a character a player is wearing as their face', () => {
    const keys = portraitPool([ann, ben]).map((r) => r.entry.id);
    expect(keys).not.toContain('spike');
    expect(keys).not.toContain('hitori');
  });

  it('with sharedOnly, keeps only characters on every list', () => {
    expect(portraitPool([ann, ben], { sharedOnly: true }).map((r) => r.entry.id).sort()).toEqual(['fern', 'frieren', 'stark']);
  });
});

describe('dealGame', () => {
  const settings = { rounds: 6, answerStyle: 'choice', hints: true, sharedOnly: false };

  it('deals the rounds plus spares, each character once', () => {
    const { deal } = dealGame([ann, ben], settings, null, seeded(3));
    expect(deal.rounds).toBe(6);
    expect(deal.cards).toHaveLength(6 + SPARES);
    expect(new Set(deal.cards.map((c) => c.key)).size).toBe(deal.cards.length);
  });

  it('says so when the lists are too small', () => {
    expect(dealGame([ann, ben], { ...settings, rounds: 12 }).error).toMatch(/found 9/);
  });

  it('gives four distinct options, exactly one of them right', () => {
    for (let seed = 1; seed < 30; seed++) {
      const { deal } = dealGame([ann, ben], settings, null, seeded(seed));
      for (const c of deal.cards) {
        expect(c.choices).toHaveLength(4);
        expect(new Set(c.choices).size).toBe(4);
        expect(c.choices.filter((o) => o === c.name)).toHaveLength(1);
      }
    }
  });

  it('draws wrong answers from the same show first', () => {
    // Nine rounds deals every portrait, so Frieren is always on the table.
    const { deal } = dealGame([ann, ben], { ...settings, rounds: 9 }, null, seeded(5));
    const frieren = deal.cards.find((c) => c.key === 'frieren');
    // Her show has exactly three other characters, so they are the options.
    expect([...frieren.choices].sort()).toEqual(['Fern', 'Frieren', 'Himmel', 'Stark']);
  });

  it('reads hints from the list first, then the pack, and leaves out what neither has', () => {
    const pack = {
      shows: new Map([['cowboy bebop', { studio: 'Sunrise', format: 'TV', source: 'ORIGINAL', startYear: 1998 }]]),
      aliases: new Map(),
    };
    const all = { ...settings, rounds: 9 };
    // Every portrait is dealt at nine rounds, so every show is on the table.
    const { deal } = dealGame([ann, ben], all, pack, seeded(2));
    const bySeries = (s) => deal.cards.find((c) => c.series === s).hints;
    expect(bySeries('Frieren')).toEqual({ studio: 'Madhouse', year: '2023', format: 'TV series', source: 'Manga' });
    expect(bySeries('Cowboy Bebop')).toEqual({ studio: 'Sunrise', year: '1998', format: 'TV series', source: 'Original (no source)' });
    expect(bySeries('Bocchi the Rock!')).toEqual({});
  });

  it('deals no options for typed answers and no hints with hints off', () => {
    const { deal } = dealGame([ann, ben], { ...settings, answerStyle: 'typed', hints: false }, null, seeded(1));
    expect(deal.answerStyle).toBe('typed');
    expect(deal.hintsOn).toBe(false);
    expect(deal.cards.every((c) => c.choices.length === 0 && Object.keys(c.hints).length === 0)).toBe(true);
  });
});
