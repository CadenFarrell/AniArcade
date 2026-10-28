import { describe, expect, it } from 'vitest';
import { bannedWords, castIndex, isRightGuess, validWord } from './chainWords';

const naruto = {
  title: 'Naruto',
  characters: [
    { name: 'Naruto Uzumaki', role: 'MAIN' },
    { name: 'Sasuke Uchiha', role: 'MAIN' },
    { name: 'Kakashi Hatake', role: 'SUPPORTING' },
    { name: 'Itachi Uchiha', role: 'SUPPORTING' },
  ],
};
const aot = {
  title: 'Attack on Titan Season 3',
  characters: [{ name: 'Levi Ackerman', role: 'MAIN' }, { name: 'Eren Yeager', role: 'MAIN' }],
};
const players = [{ id: 'a', animeList: [naruto, aot] }];
const index = castIndex(players);

describe('bannedWords', () => {
  it('bans the name, the title and the rest of the cast, each with its reason', () => {
    const banned = bannedWords(index, { name: 'Kakashi Hatake', series: 'Naruto' });
    const from = Object.fromEntries(banned.map((b) => [b.word, b.from]));
    expect(from.kakashi).toBe('name');
    expect(from.hatake).toBe('name');
    // Naruto is both the show and a castmate; the show reason wins.
    expect(from.naruto).toBe('show');
    expect(from.sasuke).toBe('cast');
    expect(from.uchiha).toBe('cast');
  });

  it('skips short words and filler, and the season marker of a list title', () => {
    const words = bannedWords(index, { name: 'Levi Ackerman', series: 'Attack on Titan Season 3' }).map((b) => b.word);
    expect(words).toEqual(expect.arrayContaining(['attack', 'titan', 'levi', 'ackerman', 'eren', 'yeager']));
    expect(words).not.toContain('on');
    expect(words).not.toContain('season');
  });
});

describe('validWord', () => {
  const banned = bannedWords(index, { name: 'Levi Ackerman', series: 'Attack on Titan Season 3' });

  it('takes one plain word', () => {
    expect(validWord('captain', banned)).toMatchObject({ ok: true, word: 'captain' });
    expect(validWord(' short-tempered ', banned)).toMatchObject({ ok: true, word: 'short-tempered' });
  });

  it('refuses two words, blanks, symbols and long words', () => {
    expect(validWord('', banned).ok).toBe(false);
    expect(validWord('clean freak', banned).reason).toBe('One word at a time.');
    expect(validWord('tea!', banned).ok).toBe(false);
    expect(validWord('a'.repeat(30), banned).ok).toBe(false);
  });

  it('refuses a banned word, a plural of one, and one hidden in a hyphen, saying why', () => {
    expect(validWord('Levi', banned)).toMatchObject({ ok: false, reason: '“Levi” is part of the name.' });
    expect(validWord('Titans', banned).reason).toMatch(/title/);
    expect(validWord('anti-Eren', banned).reason).toMatch(/same show/);
    // A short banned word does not ban every word it begins.
    expect(validWord('Eventually', [{ word: 'eve', from: 'cast' }]).ok).toBe(true);
  });
});

describe('isRightGuess', () => {
  const kakashi = { name: 'Kakashi Hatake' };
  it('takes the full name in either order, and a part that names one person', () => {
    expect(isRightGuess(index, kakashi, 'kakashi hatake')).toBe(true);
    expect(isRightGuess(index, kakashi, 'Hatake Kakashi')).toBe(true);
    expect(isRightGuess(index, kakashi, 'Kakashi')).toBe(true);
  });

  it('refuses another character, and a part several people share', () => {
    expect(isRightGuess(index, kakashi, 'Sasuke')).toBe(false);
    expect(isRightGuess(index, { name: 'Sasuke Uchiha' }, 'Uchiha')).toBe(false);
    expect(isRightGuess(index, kakashi, '')).toBe(false);
  });
});
