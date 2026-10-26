import { describe, expect, it } from 'vitest';
import { filterAndMapCharacterEdges, mergeCharacterEdges } from './anilistFormat';
import { decodeCastFile, decodeCastPage, encodeCastFile, encodeCastPage } from './castPackFormat';

// What a live fetch hands the page cache, with the parts the compact form
// rewrites: a romaji descriptor name with an English alternative, a bio with
// markup and a spoiler, a portrait on AniList's CDN.
const princess = {
  role: 'MAIN',
  node: {
    id: 1,
    name: { full: 'Kyouryuu no Hime', native: '叫竜の姫', alternative: ['Princess of the Klaxosaurs'] },
    gender: 'Female',
    image: { large: 'https://s4.anilist.co/file/anilistcdn/character/large/b1-abc.png' },
    description: '__Height:__ 160cm\nShe rules the **Klaxosaurs**. ~!She is the last of them.!~ (Source: wiki)',
    favourites: 4321,
  },
};
const zero = {
  role: 'SUPPORTING',
  node: {
    id: 2,
    name: { full: 'Zero Two', native: 'ゼロツー', alternative: [] },
    gender: null,
    image: { large: 'https://example.com/elsewhere.png' },
    description: null,
    favourites: null,
  },
};
const page = { genres: ['Mecha'], hasNextPage: true, edges: [princess, zero] };

// The import's own output for a cast, which is the only thing that must match.
const imported = (edges) => filterAndMapCharacterEdges(mergeCharacterEdges([edges]), {
  minSupportingFavourites: 0,
  genres: ['Mecha'],
});

describe('cast pages, stored and read back', () => {
  it('import exactly as the live page does', () => {
    const back = decodeCastPage(JSON.parse(JSON.stringify(encodeCastPage(page))));
    expect(back.hasNextPage).toBe(true);
    expect(back.genres).toEqual(['Mecha']);
    expect(imported(back.edges)).toEqual(imported(page.edges));
  });

  it('share one character across a file and keep each show\'s pages', () => {
    const file = JSON.parse(JSON.stringify(encodeCastFile(new Map([
      [10, [page, { genres: ['Mecha'], hasNextPage: false, edges: [zero] }]],
      [11, [{ genres: ['Drama'], hasNextPage: false, edges: [princess] }]],
    ]))));
    expect(Object.keys(file.c)).toEqual(['1', '2']);

    const pages = decodeCastFile(file);
    expect([...pages.keys()]).toEqual(['10:1', '10:2', '11:1']);
    expect(imported(pages.get('10:1').edges)).toEqual(imported(page.edges));
    expect(pages.get('11:1').genres).toEqual(['Drama']);
    expect(pages.get('10:2').hasNextPage).toBe(false);
  });
});
