import { describe, it, expect } from 'vitest';
import { isCorrectTitleGuess, suggestTitles, listSuggestionPool } from './titleMatch';

// A question carries both the player's own list title and the AnimeThemes name.
const q = (animeTitle, displayTitle) => ({ animeTitle, displayTitle });
const jjk = q('Jujutsu Kaisen', 'Jujutsu Kaisen');
const aot = q('Attack on Titan', 'Shingeki no Kyojin');
const rezero = q('Re:Zero', 'Re:Zero kara Hajimeru Isekai Seikatsu');

describe('isCorrectTitleGuess', () => {
  it('accepts the exact title', () => {
    expect(isCorrectTitleGuess(jjk, 'Jujutsu Kaisen')).toBe(true);
    expect(isCorrectTitleGuess(jjk, 'jujutsu kaisen')).toBe(true);
  });

  it('accepts the romaji name as well as the player\'s own title', () => {
    expect(isCorrectTitleGuess(aot, 'Attack on Titan')).toBe(true);
    expect(isCorrectTitleGuess(aot, 'Shingeki no Kyojin')).toBe(true);
  });

  it('accepts a distinctive fragment, because the game is about the song not the spelling', () => {
    expect(isCorrectTitleGuess(jjk, 'jujutsu')).toBe(true);
  });

  it('counts a fragment only as whole words, so a cut-off word cannot fish for it', () => {
    expect(isCorrectTitleGuess(jjk, 'juj')).toBe(false);
    expect(isCorrectTitleGuess(jjk, 'juju')).toBe(false);
    expect(isCorrectTitleGuess(aot, 'tack')).toBe(false);
    expect(isCorrectTitleGuess(q('Girls und Panzer', 'Girls und Panzer'), 'girl')).toBe(false);
  });

  it('lets the last word of a longer guess be cut short, since that is someone still typing', () => {
    expect(isCorrectTitleGuess(aot, 'attack on tit')).toBe(true);
    expect(isCorrectTitleGuess(jjk, 'jujutsu kai')).toBe(true);
  });

  it('never accepts words that only name a season or a format', () => {
    const s2 = q('Attack on Titan Season 2', 'Shingeki no Kyojin Season 2');
    expect(isCorrectTitleGuess(s2, 'season')).toBe(false);
    expect(isCorrectTitleGuess(s2, 'season 2')).toBe(false);
    expect(isCorrectTitleGuess(q('Mob Psycho 100 II', 'Mob Psycho 100 II'), 'ii')).toBe(false);
  });

  it('accepts any season of the right show', () => {
    const s2 = q('Attack on Titan Season 2', 'Shingeki no Kyojin Season 2');
    expect(isCorrectTitleGuess(s2, 'attack on titan')).toBe(true);
    expect(isCorrectTitleGuess(s2, 'shingeki no kyojin')).toBe(true);
    expect(isCorrectTitleGuess(aot, 'attack on titan the final season')).toBe(true);
  });

  it('refuses a fragment that fits another show on the table just as well', () => {
    const note = { ...q('Death Note', 'Death Note'), lookalikes: ['Death Parade'] };
    expect(isCorrectTitleGuess(note, 'death')).toBe(false);
    expect(isCorrectTitleGuess(note, 'note')).toBe(true);
    expect(isCorrectTitleGuess(note, 'death note')).toBe(true);
    // With nothing to confuse it with, the one word names it.
    expect(isCorrectTitleGuess(q('Death Note', 'Death Note'), 'death')).toBe(true);
  });

  it('still takes the bare show name when a spin-off shares every word of it', () => {
    const s2 = { ...q('Attack on Titan Season 2', 'Shingeki no Kyojin Season 2'), lookalikes: ['Attack on Titan: Junior High'] };
    expect(isCorrectTitleGuess(s2, 'attack on titan')).toBe(true);
    expect(isCorrectTitleGuess(s2, 'titan')).toBe(false);
  });

  it('accepts a guess that wraps the title in extra words', () => {
    expect(isCorrectTitleGuess(aot, 'attack on titan season 2')).toBe(true);
  });

  it('treats punctuation as a separator so Re:Zero and re zero agree', () => {
    expect(isCorrectTitleGuess(rezero, 're zero')).toBe(true);
    expect(isCorrectTitleGuess(rezero, 'Re:Zero')).toBe(true);
  });

  it('accepts the meaningful words in any order', () => {
    expect(isCorrectTitleGuess(q('Cowboy Bebop', 'Cowboy Bebop'), 'bebop cowboy')).toBe(true);
  });

  it('will not let stopwords alone score a point', () => {
    expect(isCorrectTitleGuess(aot, 'the')).toBe(false);
    expect(isCorrectTitleGuess(aot, 'no')).toBe(false);
    expect(isCorrectTitleGuess(aot, 'on the a')).toBe(false);
  });

  it('rejects an empty guess', () => {
    expect(isCorrectTitleGuess(jjk, '')).toBe(false);
    expect(isCorrectTitleGuess(jjk, '   ')).toBe(false);
  });

  it('rejects a different show', () => {
    expect(isCorrectTitleGuess(jjk, 'bleach')).toBe(false);
    expect(isCorrectTitleGuess(aot, 'demon slayer')).toBe(false);
  });

  it('survives a question missing one of its two names', () => {
    expect(isCorrectTitleGuess({ animeTitle: 'Bleach' }, 'bleach')).toBe(true);
    expect(isCorrectTitleGuess({}, 'bleach')).toBe(false);
  });
});

describe('suggestTitles', () => {
  const questions = [jjk, aot, rezero, q('Bleach', 'Bleach')];

  it('stays quiet until there is something to go on', () => {
    expect(suggestTitles(questions, '')).toEqual([]);
    expect(suggestTitles(questions, 'j')).toEqual([]);
  });

  it('matches on the romaji name but always offers the player\'s own title', () => {
    const out = suggestTitles(questions, 'shingeki');
    expect(out).toEqual([{ title: 'Attack on Titan', alt: 'Shingeki no Kyojin' }]);
  });

  it('deduplicates shows that appear under several themes', () => {
    const dupes = [jjk, { ...jjk }, { ...jjk }];
    expect(suggestTitles(dupes, 'juju')).toHaveLength(1);
  });

  it('caps the list so the dropdown cannot run off the screen', () => {
    const many = Array.from({ length: 20 }, (_, i) => q(`Show ${i}`, `Show ${i}`));
    expect(suggestTitles(many, 'show')).toHaveLength(6);
    expect(suggestTitles(many, 'show', 2)).toHaveLength(2);
  });

  it('returns nothing when no title matches', () => {
    expect(suggestTitles(questions, 'zzzz')).toEqual([]);
  });
});

describe('listSuggestionPool', () => {
  it('puts the dealt songs first, then every show on the table’s lists', () => {
    const round = [aot];
    const players = [
      { animeList: [{ title: 'Bleach' }, { title: 'Attack on Titan' }] },
      { animeList: [{ title: 'Frieren' }] },
      {},
    ];
    const pool = listSuggestionPool(round, players);
    expect(pool[0]).toBe(aot);
    // Deduplicated by the box itself: the dealt song keeps its romaji line.
    expect(suggestTitles(pool, 'attack')).toEqual([{ title: 'Attack on Titan', alt: 'Shingeki no Kyojin' }]);
    expect(suggestTitles(pool, 'frie')).toEqual([{ title: 'Frieren', alt: 'Frieren' }]);
  });
});
