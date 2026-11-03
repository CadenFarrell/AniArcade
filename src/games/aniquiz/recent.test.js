import { describe, it, expect } from 'vitest';
import { cleanList, dealtClues, recentFrom, RECENT_GAMES, withDeal } from './recent';

const clue = (id, subject, show) => ({ id, subject, ...(show ? { show } : {}) });

const board = {
  categories: [
    { id: 'studios', clues: [clue('studio:a', 'a'), clue('studio:b', 'b')] },
    { id: 'voices', clues: [clue('voiceActor:hero', 'hero', 'c')] },
  ],
  final: clue('director:d', 'd'),
  questions: [],
};
const quiz = { categories: [], final: null, questions: [clue('seasonYear:e', 'e'), clue('appearsIn:x', 'x', 'f')] };

describe('recent deals', () => {
  it('collects every clue a board or a quiz holds', () => {
    expect(dealtClues(board).map((c) => c.id)).toEqual(['studio:a', 'studio:b', 'voiceActor:hero', 'director:d']);
    expect(dealtClues(quiz).map((c) => c.id)).toEqual(['seasonYear:e', 'appearsIn:x']);
    expect(dealtClues(null)).toEqual([]);
  });

  it('remembers a character clue by the show it spends', () => {
    const [game] = withDeal([], board);
    expect(game.shows).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps the newest games only', () => {
    let list = [];
    for (let i = 0; i < RECENT_GAMES + 2; i++) {
      list = withDeal(list, { questions: [clue(`seasonYear:s${i}`, `s${i}`)] });
    }
    expect(list).toHaveLength(RECENT_GAMES);
    expect(list[0].ids).toEqual([`seasonYear:s${RECENT_GAMES + 1}`]);
  });

  it('avoids every remembered clue but only the last game’s shows', () => {
    const list = withDeal(withDeal([], board), quiz);
    const recent = recentFrom(list);
    expect([...recent.ids].sort()).toEqual(
      ['appearsIn:x', 'director:d', 'seasonYear:e', 'studio:a', 'studio:b', 'voiceActor:hero'],
    );
    expect([...recent.shows].sort()).toEqual(['e', 'f']);
  });

  it('shrugs off whatever storage held', () => {
    expect(cleanList('nonsense')).toEqual([]);
    expect(cleanList([null, 3, { ids: 'x' }, { ids: [] }, { ids: ['a', 7], shows: 'nope' }]))
      .toEqual([{ ids: ['a'], shows: [] }]);
    expect(recentFrom(undefined)).toEqual({ ids: new Set(), shows: new Set() });
  });

  it('leaves the list alone for a deal with nothing in it', () => {
    const list = withDeal([], quiz);
    expect(withDeal(list, { categories: [], questions: [] })).toEqual(list);
  });
});
