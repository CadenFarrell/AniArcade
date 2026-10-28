import { describe, expect, it } from 'vitest';
import { chainPool, dealCard, drawCharacter } from './deal';
import { castIndex } from './chainWords';

const show = (title, names, role = 'MAIN') => ({ title, characters: names.map((name) => ({ name, role, imageUrl: `https://x/${name}.jpg` })) });

const players = [
  { id: 'a', animeList: [show('Naruto', ['Naruto Uzumaki', 'Sasuke Uchiha']), show('Bleach', ['Ichigo Kurosaki'])] },
  { id: 'b', animeList: [show('Naruto', ['Naruto Uzumaki', 'Sasuke Uchiha'])] },
  { id: 'c', animeList: [show('One Piece', ['Monkey D. Luffy']), show('Side', ['Extra Person'], 'SUPPORTING')] },
];

describe('chainPool', () => {
  it('keeps main characters, or everyone when nobody is marked main', () => {
    expect(chainPool(players, 'main').map((c) => c.entry.name)).not.toContain('Extra Person');
    expect(chainPool(players, 'all').map((c) => c.entry.name)).toContain('Extra Person');
    const nobodyMain = [{ id: 'x', animeList: [show('Side', ['Extra Person'], 'SUPPORTING')] }];
    expect(chainPool(nobodyMain, 'main')).toHaveLength(1);
  });
});

describe('drawCharacter', () => {
  it('prefers someone a giver and a guesser both hold', () => {
    for (let i = 0; i < 20; i++) {
      const c = drawCharacter(players, { givers: ['a', 'c'], guessers: ['b'] }, () => (i / 20));
      expect(['Naruto Uzumaki', 'Sasuke Uchiha']).toContain(c.name);
    }
  });

  it('falls back to what a giver holds, then to anyone, and never repeats', () => {
    const c = drawCharacter(players, { givers: ['c'], guessers: ['a'] }, () => 0);
    expect(['Monkey D. Luffy']).toContain(c.name);
    const used = chainPool(players).map((x) => x.entry.id);
    expect(drawCharacter(players, { used })).toBeNull();
  });

  it('deals a card with its banned words', () => {
    const c = drawCharacter(players, { givers: ['a'], guessers: ['b'] }, () => 0);
    const card = dealCard(castIndex(players), c);
    expect(card.character).toEqual(c);
    expect(card.banned.map((b) => b.word)).toContain('naruto');
  });
});
