import { describe, it, expect } from 'vitest';
import {
  MAX_ENDINGS, MAX_OPENINGS, originFromWikidata, songKey, themesFromAnimeThemes,
} from './outsideFacts';
import { validateFact } from './facts';

// The shape AnimeThemes returns with include=animethemes.song.artists.
const theme = (type, sequence, title, ...artists) => ({
  type, sequence, song: title == null ? null : { title, artists: artists.map((name) => ({ name })) },
});

describe('themesFromAnimeThemes', () => {
  it('lists openings then endings in sequence order, canonical season first', () => {
    const s1 = { animethemes: [theme('ED', 1, 'Alumina', 'Nightmare'), theme('OP', 2, "What's up people?", 'Maximum the Hormone'), theme('OP', 1, 'THE WORLD', 'Nightmare')] };
    const s2 = { animethemes: [theme('OP', 1, 'Second Season Song', 'Someone')] };
    expect(themesFromAnimeThemes([[s1], [s2]])).toEqual([
      { type: 'OP', song: 'THE WORLD', artists: ['Nightmare'] },
      { type: 'OP', song: "What's up people?", artists: ['Maximum the Hormone'] },
      { type: 'ED', song: 'Alumina', artists: ['Nightmare'] },
      { type: 'OP', song: 'Second Season Song', artists: ['Someone'] },
    ]);
  });

  it('caps each kind per franchise, so a long-runner does not fill the pack', () => {
    const many = { animethemes: Array.from({ length: 30 }, (_, i) => theme(i % 2 ? 'ED' : 'OP', i, `Song ${i}`, 'X')) };
    const out = themesFromAnimeThemes([[many]]);
    expect(out.filter((t) => t.type === 'OP')).toHaveLength(MAX_OPENINGS);
    expect(out.filter((t) => t.type === 'ED')).toHaveLength(MAX_ENDINGS);
  });

  it("leaves out a dub's themes, which AnimeThemes numbers from 1 again", () => {
    const s = { animethemes: [
      theme('OP', 1, 'We Are!', 'Hiroshi Kitadani'),
      { ...theme('OP', 1, 'One Piece Theme'), group: 'English Version - 4Kids' },
      theme('OP', 2, 'Believe', 'Folder5'),
    ] };
    expect(themesFromAnimeThemes([[s]]).map((t) => t.song)).toEqual(['We Are!', 'Believe']);
  });

  it("keeps a Japanese broadcast variant's themes, after the main ones, but never a dub's", () => {
    const s = { animethemes: [
      { ...theme('OP', 1, 'Rerun Opening', 'X'), group: 'Repeat Show' },
      { ...theme('OP', 1, 'Dub Opening'), group: 'English Version' },
      { ...theme('OP', 1, 'Korean Opening'), group: 'Korean Version' },
      theme('OP', 2, 'Second Opening', 'Y'),
      theme('OP', 1, 'First Opening', 'Z'),
    ] };
    expect(themesFromAnimeThemes([[s]]).map((t) => t.song)).toEqual(['First Opening', 'Second Opening', 'Rerun Opening']);
  });

  it('keeps one version of a song, ignoring a trailing version label', () => {
    expect(songKey('Fukashigi no Karte movie ver.')).toBe(songKey('Fukashigi no Karte'));
    expect(songKey('Refrain Boy -English ver.-')).toBe(songKey('Refrain Boy'));
    expect(songKey("Fluorite Eye's Song -Piano Version-")).toBe(songKey("Fluorite Eye's Song"));
    expect(songKey('Konpeki no Alpine ~Nikenme ni Karaoke ni Haitta Oretachi no Tension Super MAX ver.~')).toBe(songKey('Konpeki no Alpine'));
    // Real words that merely contain "ver" are left alone.
    expect(songKey('Never Give Up')).toBe('never give up');
    expect(songKey('Silver Sky')).toBe('silver sky');
    const s1 = { animethemes: [theme('ED', 1, 'Fukashigi no Karte', 'A')] };
    const movie = { animethemes: [theme('ED', 1, 'Fukashigi no Karte movie ver.', 'A')] };
    expect(themesFromAnimeThemes([[s1], [movie]]).map((t) => t.song)).toEqual(['Fukashigi no Karte']);
  });

  it("reads an unnumbered theme as the first, and keeps a song's plain title over its variant", () => {
    // K-ON!: the real OP1 is unnumbered beside a numbered variant of itself.
    const kon = { animethemes: [theme('OP', null, 'Cagayake! GIRLS', 'HTT'), theme('OP', 2, 'Cagayake! Girls (Go Nin Ver.)', 'HTT')] };
    expect(themesFromAnimeThemes([[kon]]).map((t) => t.song)).toEqual(['Cagayake! GIRLS']);
    // given: the variant is ED1 and the plain song ED2 — the plain title wins the slot.
    const given = { animethemes: [theme('ED', 1, 'Marutsuke -Piano ver.-', 'X'), theme('ED', 2, 'Marutsuke', 'X'), theme('ED', 3, 'Other', 'Y')] };
    expect(themesFromAnimeThemes([[given]]).map((t) => t.song)).toEqual(['Marutsuke', 'Other']);
    expect(songKey('Refrain Boy -TEKINA remix-')).toBe(songKey('Refrain Boy'));
    expect(songKey('Fly Me to the Moon -4 Beat Version (Off-Vocal)-')).toBe(songKey('Fly Me to the Moon'));
    expect(songKey('Fly Me to the Moon -B22 (A-Type)-')).toBe(songKey('Fly Me to the Moon'));
    // No space before the mark: part of the title, not a subtitle.
    expect(songKey('1/2')).not.toBe(songKey('1'));
  });

  it('treats a lone null sequence as first, keeps a reused song once, and skips insert songs', () => {
    const s1 = { animethemes: [theme('OP', null, 'Gurenge', 'LiSA'), theme('IN', 1, 'Insert', 'Y')] };
    const s2 = { animethemes: [theme('OP', 1, 'gurenge ', 'LiSA')] };
    expect(themesFromAnimeThemes([[s1], [s2]])).toEqual([{ type: 'OP', song: 'Gurenge', artists: ['LiSA'] }]);
  });

  it('keeps a song with no linked performer, without an artists list', () => {
    const out = themesFromAnimeThemes([[{ animethemes: [theme('OP', 1, 'R★O★C★K★S')] }]]);
    expect(out).toEqual([{ type: 'OP', song: 'R★O★C★K★S' }]);
    expect(validateFact({ kind: 'show', key: 'naruto', field: 'themes', value: out }).ok).toBe(true);
  });

  it('returns null when a franchise has nothing usable', () => {
    expect(themesFromAnimeThemes([[], [{ animethemes: [theme('OP', 1, null)] }]])).toBeNull();
    expect(themesFromAnimeThemes(undefined)).toBeNull();
  });
});

describe('the themes field', () => {
  const ok = (value) => validateFact({ kind: 'show', key: 'k', field: 'themes', value }).ok;
  it('rejects malformed entries', () => {
    expect(ok([{ type: 'OP', song: 'A', artists: ['B'] }])).toBe(true);
    expect(ok([{ type: 'IN', song: 'A' }])).toBe(false);
    expect(ok([{ type: 'OP', song: '' }])).toBe(false);
    expect(ok([{ type: 'OP', song: 'A', artists: [] }])).toBe(false);
    expect(ok([])).toBe(false);
  });
});

// One row per work, the shape factSources/wikidata.js builds from its query.
const work = (over) => ({
  types: ['manga series'], magazines: [], magazinePublishers: [], publishers: [], authors: [], start: '', ...over,
});

describe('originFromWikidata', () => {
  it("reads a manga's magazine, the magazine's publisher, and the year it began", () => {
    const rows = [work({
      magazines: ['Weekly Shōnen Jump', 'Weekly Shonen Jump'], magazinePublishers: ['Shueisha'],
      publishers: ['Jump Comics'], authors: ['Koyoharu Gotōge'], start: '2016-02-15T00:00:00Z',
    })];
    expect(originFromWikidata(rows, 'MANGA')).toEqual({
      serializedIn: 'Weekly Shōnen Jump', originalPublisher: 'Shueisha', originalYear: 2016, author: 'Koyoharu Gotōge',
    });
  });

  it("reads a light novel's Japanese imprint as its publisher", () => {
    const rows = [work({ types: ['light novel series'], publishers: ['Dengeki Bunko'], start: '2009-04-10T00:00:00Z' })];
    expect(originFromWikidata(rows, 'LIGHT_NOVEL')).toEqual({ originalPublisher: 'Dengeki Bunko', originalYear: 2009 });
  });

  it('never attaches a work of a different kind than AniList names', () => {
    const novel = [work({ types: ['light novel series'], publishers: ['Dengeki Bunko'], start: '2009-01-01' })];
    expect(originFromWikidata(novel, 'MANGA')).toEqual({});
    expect(originFromWikidata([work({ magazines: ['Jump'] })], 'ORIGINAL')).toEqual({});
  });

  it('drops a value the source disagrees with itself about', () => {
    const rows = [work({ magazines: ['Shōnen Gangan'], magazinePublishers: ['Square Enix', 'Enix'], authors: ['A', 'B'] })];
    expect(originFromWikidata(rows, 'MANGA')).toEqual({ serializedIn: 'Shōnen Gangan' });
  });

  it('gives no publisher to a manga with no settled magazine', () => {
    const rows = [work({ magazines: ['Jump', 'Magazine'], magazinePublishers: ['Shueisha'] })];
    expect(originFromWikidata(rows, 'MANGA')).toEqual({});
  });
});
