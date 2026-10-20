import { describe, expect, it } from 'vitest';
import { splitTitle } from './splitTitle';
import { games } from '../../hub/registry';

describe('splitting a tile title', () => {
  it('sets the shared "Ani" apart from the word that differs', () => {
    expect(splitTitle('AniGuess')).toEqual({ prefix: 'Ani', word: 'Guess' });
  });

  it('leaves a title alone when "Ani" is not a prefix', () => {
    expect(splitTitle('Animal Crossing Quiz')).toEqual({ prefix: '', word: 'Animal Crossing Quiz' });
    expect(splitTitle('Wavelength')).toEqual({ prefix: '', word: 'Wavelength' });
    expect(splitTitle()).toEqual({ prefix: '', word: '' });
  });

  it('gives every registered game a distinct big word', () => {
    // The split is only worth anything if what is left tells games apart.
    const words = games.map((g) => splitTitle(g.title).word.toLowerCase());
    expect(new Set(words).size).toBe(games.length);
  });
});
