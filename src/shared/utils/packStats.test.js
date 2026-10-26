import { describe, it, expect } from 'vitest';
import { indexPack } from './facts';
import { backfillProfileFromPack } from './packStats';

const PACK = indexPack({
  version: 4,
  shows: {
    'attack on titan': {
      title: 'Attack on Titan', popularity: 1065199, averageScore: 85, startYear: 2013, studio: 'WIT STUDIO',
    },
    'other show': { title: 'Other Show', studio: 'Bones' },
  },
  characters: {
    levi: { name: 'Levi', favourites: 120000, supportingIn: ['attack on titan'] },
    'eren yeager': { name: 'Eren Yeager', favourites: 90000, appearsIn: ['attack on titan'] },
    ymir: { name: 'Ymir', favourites: 4000, appearsIn: ['other show'] },
  },
  aliases: { 'attack on titan the final season': 'attack on titan' },
});

const profile = (anime) => ({ id: 'cade', name: 'Cade', animeList: anime });

describe('backfillProfileFromPack', () => {
  it('fills the stats an old import never stored', () => {
    const before = profile([{ id: 'a', title: 'Attack on Titan', characters: [] }]);
    const { profile: after, changed } = backfillProfileFromPack(before, PACK);
    expect(changed).toBe(3);
    expect(after.animeList[0]).toMatchObject({ popularity: 1065199, averageScore: 85, startDate: { year: 2013 } });
  });

  it('fills a missing episode length, but never the episode count', () => {
    const pack = indexPack({
      version: 4,
      shows: { 'attack on titan': { title: 'Attack on Titan', popularity: 1, averageScore: 85, startYear: 2013, episodes: 25, duration: 24 } },
      characters: {},
      aliases: {},
    });
    const before = profile([{ id: 'a', title: 'Attack on Titan', popularity: 1, averageScore: 85, startDate: { year: 2013 }, episodes: 87, characters: [] }]);
    const { profile: after, changed } = backfillProfileFromPack(before, pack);
    expect(changed).toBe(1);
    expect(after.animeList[0]).toMatchObject({ duration: 24, episodes: 87 });
  });

  it('never overwrites a value an import stored, including a real zero-adjacent one', () => {
    const before = profile([{ id: 'a', title: 'Attack on Titan', popularity: 5, averageScore: 40, startDate: { year: 2012, month: 4 }, characters: [] }]);
    const { profile: after, changed } = backfillProfileFromPack(before, PACK);
    expect(changed).toBe(0);
    expect(after).toBe(before);
  });

  it('finds the franchise through a later season\'s title', () => {
    const { profile: after } = backfillProfileFromPack(
      profile([{ id: 'a', title: 'Attack on Titan: The Final Season', characters: [] }]),
      PACK,
    );
    expect(after.animeList[0].popularity).toBe(1065199);
  });

  it('treats a stored favourites of 0 as unmeasured, but never lowers a real count', () => {
    const before = profile([{
      id: 'a',
      title: 'Attack on Titan',
      popularity: 1, averageScore: 1, startDate: { year: 2013 },
      characters: [
        { name: 'Levi', favourites: 0 },
        { name: 'Eren Yeager', favourites: 12 },
        { name: 'Armin Arlert' },
      ],
    }]);
    const { profile: after, changed } = backfillProfileFromPack(before, PACK);
    expect(changed).toBe(1);
    expect(after.animeList[0].characters.map((c) => c.favourites)).toEqual([120000, 12, undefined]);
  });

  it('borrows a count only from a character the pack places in THIS show', () => {
    const before = profile([{
      id: 'a', title: 'Attack on Titan', popularity: 1, averageScore: 1, startDate: { year: 2013 },
      characters: [{ name: 'Ymir', favourites: 0 }],
    }]);
    expect(backfillProfileFromPack(before, PACK).changed).toBe(0);
  });

  it('never mutates what it was handed', () => {
    const entry = { id: 'a', title: 'Attack on Titan', characters: [{ name: 'Levi', favourites: 0 }] };
    const before = profile([entry]);
    const snapshot = JSON.stringify(before);
    backfillProfileFromPack(before, PACK);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('leaves shows the pack does not know, and junk, alone', () => {
    const before = profile([{ id: 'x', title: 'Not In The Pack', characters: [] }, null]);
    expect(backfillProfileFromPack(before, PACK).profile).toBe(before);
    expect(backfillProfileFromPack(null, PACK).changed).toBe(0);
    expect(backfillProfileFromPack(before, null).changed).toBe(0);
  });
});
