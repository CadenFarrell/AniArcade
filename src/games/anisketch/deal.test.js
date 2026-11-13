import { describe, expect, it } from 'vitest';
import { isRightGuess, nameIndex, offerChoices, sketchPool } from './deal';

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const char = (name, over = {}) => ({ id: name, name, role: 'Main', imageUrl: `https://img.test/${encodeURIComponent(name)}.jpg`, ...over });
const show = (title, characters) => ({ id: title, title, characters });
const player = (id, shows) => ({ id, name: id, animeList: shows });

const NARUTO = show('Naruto', [char('Kakashi Hatake'), char('Sasuke Uchiha'), char('Itachi Uchiha'), char('Naruto Uzumaki')]);
const FRIEREN = show('Frieren', [char('Frieren'), char('Fern'), char('Stark')]);
const BLEACH = show('Bleach', [char('Ichigo Kurosaki'), char('Rukia Kuchiki', { imageUrl: '' })]);

describe('offerChoices', () => {
  const table = [player('ann', [NARUTO, FRIEREN]), player('ben', [NARUTO, BLEACH])];

  it('offers the drawer characters someone else knows first', () => {
    for (const seed of [1, 2, 3, 4]) {
      const offer = offerChoices(table, 'ann', { count: 3 }, seeded(seed));
      expect(offer).toHaveLength(3);
      // Naruto is on both lists, so all three come from it.
      expect(offer.every((c) => c.series === 'Naruto')).toBe(true);
    }
  });

  it('leans, never filters: without the lean, or with the shared ones spent, the drawer’s own list fills it', () => {
    const used = ['kakashi hatake', 'sasuke uchiha', 'itachi uchiha', 'naruto uzumaki'];
    const offer = offerChoices(table, 'ann', { count: 3, used }, seeded(1));
    expect(offer.map((c) => c.name).sort()).toEqual(['Fern', 'Frieren', 'Stark']);
  });

  it('falls back to anyone’s list, and never offers a character without a portrait', () => {
    const offer = offerChoices([player('cat', []), player('ben', [BLEACH])], 'cat', { count: 3 }, seeded(1));
    expect(offer.map((c) => c.name)).toEqual(['Ichigo Kurosaki']);
    expect(sketchPool([player('ben', [BLEACH])])).toHaveLength(1);
  });

  it('puts what this device dealt lately last', () => {
    const recent = new Set(['kakashi hatake', 'sasuke uchiha']);
    const offer = offerChoices(table, 'ann', { count: 2, recent }, seeded(5));
    expect(offer.map((c) => c.name).sort()).toEqual(['Itachi Uchiha', 'Naruto Uzumaki']);
  });
});

describe('isRightGuess', () => {
  const names = nameIndex([player('ann', [NARUTO, FRIEREN])]);
  const kakashi = { name: 'Kakashi Hatake' };
  const sasuke = { name: 'Sasuke Uchiha' };

  it('takes the full name in any order, or a part that names one person', () => {
    expect(isRightGuess(names, kakashi, 'kakashi hatake')).toBe(true);
    expect(isRightGuess(names, kakashi, 'Hatake Kakashi')).toBe(true);
    expect(isRightGuess(names, kakashi, 'Kakashi')).toBe(true);
    expect(isRightGuess(names, sasuke, 'Sasuke')).toBe(true);
  });

  it('refuses a part several people share, another name, and nothing', () => {
    expect(isRightGuess(names, sasuke, 'Uchiha')).toBe(false);
    expect(isRightGuess(names, kakashi, 'Naruto')).toBe(false);
    expect(isRightGuess(names, kakashi, '  ')).toBe(false);
  });
});
