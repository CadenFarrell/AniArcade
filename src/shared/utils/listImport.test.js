import { describe, it, expect } from 'vitest';
import {
  COMPLETED, CURRENT, kitsuSlugFrom, listSourceOf, mapKitsuLibrary, mapMalProxy, parseMalExport,
} from './listImport';

// Trimmed from a real MyAnimeList export: the same tags, CDATA and statuses.
const MAL_EXPORT = `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo>
    <user_name>someone</user_name>
    <user_export_type>1</user_export_type>
  </myinfo>
  <anime>
    <series_animedb_id>1</series_animedb_id>
    <series_title><![CDATA[Cowboy Bebop]]></series_title>
    <my_status>Completed</my_status>
  </anime>
  <anime>
    <series_animedb_id>16498</series_animedb_id>
    <series_title><![CDATA[Shingeki no Kyojin]]></series_title>
    <my_status>Watching</my_status>
  </anime>
  <anime>
    <series_animedb_id>5114</series_animedb_id>
    <series_title><![CDATA[Fullmetal Alchemist: Brotherhood]]></series_title>
    <my_status>Plan to Watch</my_status>
  </anime>
  <anime>
    <series_animedb_id>0</series_animedb_id>
    <series_title><![CDATA[Something MAL never had]]></series_title>
    <my_status>Completed</my_status>
  </anime>
  <anime>
    <series_animedb_id> 21 </series_animedb_id>
    <my_status>2</my_status>
  </anime>
</myanimelist>`;

describe('parseMalExport', () => {
  it('reads completed shows by MAL id, and counts the ones the exporter could not place', () => {
    expect(parseMalExport(MAL_EXPORT)).toEqual({
      entries: [{ malId: 1, status: COMPLETED }, { malId: 21, status: COMPLETED }],
      unmatched: 1,
    });
  });

  it('adds what you are watching only when asked, and never plan-to-watch', () => {
    const { entries } = parseMalExport(MAL_EXPORT, { statusIn: [COMPLETED, CURRENT] });
    expect(entries.map((e) => e.malId)).toEqual([1, 16498, 21]);
    expect(entries.find((e) => e.malId === 16498).status).toBe(CURRENT);
  });

  it('refuses a file that is not an export, rather than importing nothing', () => {
    expect(() => parseMalExport('<html>nope</html>')).toThrow(/not a MyAnimeList export/);
    expect(() => parseMalExport(null)).toThrow();
  });
});

describe('mapMalProxy', () => {
  it('keeps well-formed rows in the requested statuses', () => {
    const json = { entries: [
      { malId: 1, status: 'completed' },
      { malId: '2', status: 'watching' },
      { malId: 'x', status: 'completed' },
      { malId: 3, status: 'dropped' },
    ] };
    expect(mapMalProxy(json).entries).toEqual([{ malId: 1, status: COMPLETED }]);
    expect(mapMalProxy(json, { statusIn: [COMPLETED, CURRENT] }).entries).toHaveLength(2);
    expect(mapMalProxy(null).entries).toEqual([]);
  });
});

// The JSON:API shape kitsu.app/api/edge/library-entries?include=anime.mappings
// actually returns, cut down to what the mapper reads.
const KITSU_PAGE = {
  data: [
    { attributes: { status: 'completed' }, relationships: { anime: { data: { type: 'anime', id: '1376' } } } },
    { attributes: { status: 'current' }, relationships: { anime: { data: { type: 'anime', id: '3936' } } } },
    { attributes: { status: 'completed' }, relationships: { anime: { data: { type: 'anime', id: '7926' } } } },
    { attributes: { status: 'planned' }, relationships: { anime: { data: { type: 'anime', id: '1376' } } } },
    { attributes: { status: 'completed' }, relationships: { anime: { data: { type: 'anime', id: '42' } } } },
  ],
  included: [
    { type: 'anime', id: '1376', relationships: { mappings: { data: [{ type: 'mappings', id: 'm1' }, { type: 'mappings', id: 'm2' }] } } },
    { type: 'anime', id: '3936', relationships: { mappings: { data: [{ type: 'mappings', id: 'm3' }] } } },
    { type: 'anime', id: '7926', relationships: { mappings: { data: [{ type: 'mappings', id: 'm4' }] } } },
    { type: 'anime', id: '42', relationships: { mappings: { data: [{ type: 'mappings', id: 'm5' }] } } },
    { type: 'mappings', id: 'm1', attributes: { externalSite: 'myanimelist/anime', externalId: '1535' } },
    { type: 'mappings', id: 'm2', attributes: { externalSite: 'anilist/anime', externalId: '1535' } },
    { type: 'mappings', id: 'm3', attributes: { externalSite: 'myanimelist/anime', externalId: '5114' } },
    { type: 'mappings', id: 'm4', attributes: { externalSite: 'thetvdb/series', externalId: '79481' } },
    { type: 'mappings', id: 'm5', attributes: { externalSite: 'anilist/anime', externalId: '21' } },
  ],
};

describe('mapKitsuLibrary', () => {
  it('joins each entry to its mappings, preferring AniList, and counts the unmappable', () => {
    expect(mapKitsuLibrary(KITSU_PAGE)).toEqual({
      entries: [
        { anilistId: 1535, malId: 1535, status: COMPLETED },
        { anilistId: 21, status: COMPLETED },
      ],
      unmatched: 1,
    });
  });

  it('falls back to the MAL id, and reads "current" as watching', () => {
    const { entries } = mapKitsuLibrary(KITSU_PAGE, { statusIn: [COMPLETED, CURRENT] });
    expect(entries).toContainEqual({ malId: 5114, status: CURRENT });
  });

  it('survives an empty or garbage page', () => {
    expect(mapKitsuLibrary(null)).toEqual({ entries: [], unmatched: 0 });
    expect(mapKitsuLibrary({ data: [{}] })).toEqual({ entries: [], unmatched: 0 });
  });
});

describe('kitsuSlugFrom', () => {
  it('accepts a slug, a name, or a pasted profile link', () => {
    expect(kitsuSlugFrom('  vikhyat ')).toBe('vikhyat');
    expect(kitsuSlugFrom('https://kitsu.app/users/vikhyat/library')).toBe('vikhyat');
    expect(kitsuSlugFrom('kitsu.io/users/Some%20Name')).toBe('Some Name');
    expect(kitsuSlugFrom('@vikhyat')).toBe('vikhyat');
  });
});

describe('listSourceOf', () => {
  it('reads the saved source', () => {
    expect(listSourceOf({ listSource: { site: 'kitsu', username: 'vikhyat' } }))
      .toEqual({ site: 'kitsu', username: 'vikhyat' });
    expect(listSourceOf({ listSource: { site: 'file' } })).toEqual({ site: 'file', username: '' });
  });

  it('reads a profile from before there was a choice as AniList', () => {
    expect(listSourceOf({ anilistUsername: 'Cade' })).toEqual({ site: 'anilist', username: 'Cade' });
    expect(listSourceOf(null)).toEqual({ site: 'anilist', username: '' });
  });

  it('ignores a source naming a site that does not exist', () => {
    expect(listSourceOf({ listSource: { site: 'myspace' }, anilistUsername: 'Cade' }))
      .toEqual({ site: 'anilist', username: 'Cade' });
  });
});
