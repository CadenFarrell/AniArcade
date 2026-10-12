// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The AniList half is mocked; everything between the site and AniList — the
// file read, the MAL export parser, the hydrate step's unmatched count — is the
// real code, because that is the part this screen added.
vi.mock('../services/anilist', () => ({
  fetchUserAnimeList: vi.fn(),
  fetchManyAnimeCharacters: vi.fn(),
  fetchMediaByIds: vi.fn(),
}));

// vitest loads .env.local, and listSources reads the proxy URL once at import —
// pinned empty so the file-only MAL path is what runs once the proxy is set up.
vi.stubEnv('VITE_MAL_PROXY_URL', '');

const { fetchManyAnimeCharacters, fetchMediaByIds } = await import('../services/anilist');
const { default: ListImport } = await import('./ListImport');

const MAL_EXPORT = `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <anime><series_animedb_id>1</series_animedb_id><my_status>Completed</my_status></anime>
  <anime><series_animedb_id>21</series_animedb_id><my_status>Completed</my_status></anime>
  <anime><series_animedb_id>0</series_animedb_id><my_status>Completed</my_status></anime>
  <anime><series_animedb_id>5114</series_animedb_id><my_status>Plan to Watch</my_status></anime>
</myanimelist>`;

// What AniList answers for MAL id 1 — and nothing for 21, which is how a show
// AniList does not carry looks from here.
const BEBOP = {
  id: 1, title: 'Cowboy Bebop', coverImageUrl: '', status: 'COMPLETED', format: 'TV',
  startDate: { year: 1998, month: 4, day: 3 }, episodes: 26, averageScore: 86, popularity: 400000,
  relatedIds: [],
};

const SPIKE = {
  role: 'MAIN',
  node: { id: 1, name: { full: 'Spike Spiegel' }, gender: 'Male', image: { large: '' }, description: '', favourites: 40000 },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ListImport', () => {
  it('imports a MyAnimeList export file into an AniList-shaped profile, and says what it skipped', async () => {
    const user = userEvent.setup();
    fetchMediaByIds.mockResolvedValue({ byAnilistId: new Map(), byMalId: new Map([[1, BEBOP]]) });
    fetchManyAnimeCharacters.mockResolvedValue(new Map([[1, { genres: ['Sci-Fi'], edges: [SPIKE] }]]));
    const onImported = vi.fn();

    render(<ListImport profile={{ id: 'cade', name: 'Cade', animeList: [] }} onClose={() => {}} onImported={onImported} />);

    await user.click(screen.getByRole('button', { name: 'List file' }));
    const file = new File([MAL_EXPORT], 'animelist.xml', { type: 'text/xml' });
    await user.upload(screen.getByLabelText('Your exported list'), file);
    await user.click(screen.getByRole('button', { name: 'Read My List' }));

    // Only completed shows reach AniList, by MAL id.
    expect(fetchMediaByIds.mock.calls[0][0]).toEqual({ anilistIds: [], malIds: [1, 21] });
    expect(await screen.findByText('Cowboy Bebop')).toBeTruthy();
    // id 0 (the exporter could not place it) and id 21 (AniList has no entry).
    expect(screen.getByText(/2 shows on your list aren’t on/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Import Selected/ }));
    expect(await screen.findByText(/2 shows not found on AniList, skipped/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Done' }));

    const saved = onImported.mock.calls[0][0];
    expect(saved.listSource).toEqual({ site: 'file' });
    expect(saved.anilistUsername).toBeUndefined();
    expect(saved.anilistImportedIds).toEqual([1]);
    expect(saved.animeList).toHaveLength(1);
    expect(saved.animeList[0]).toMatchObject({ id: 'anilist_anime_1', title: 'Cowboy Bebop', popularity: 400000 });
    expect(saved.animeList[0].characters.map((c) => c.name)).toEqual(['Spike Spiegel']);
  });

  it('opens on the site a profile last used, and never carries its username to another site', async () => {
    const user = userEvent.setup();
    render(
      <ListImport
        profile={{ id: 'cade', name: 'Cade', animeList: [], anilistUsername: 'CadeOnAniList' }}
        onClose={() => {}}
        onImported={() => {}}
      />
    );

    const sites = screen.getByRole('group', { name: 'Where is your list?' });
    expect(within(sites).getByRole('button', { name: 'AniList' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('AniList username').value).toBe('CadeOnAniList');

    await user.click(within(sites).getByRole('button', { name: 'Kitsu' }));
    expect(screen.getByLabelText('Kitsu username or profile link').value).toBe('');
    await user.click(within(sites).getByRole('button', { name: 'AniList' }));
    expect(screen.getByLabelText('AniList username').value).toBe('CadeOnAniList');
  });

  it('asks MAL players for their export file while no proxy is configured', async () => {
    const user = userEvent.setup();
    render(<ListImport profile={{ id: 'cade', name: 'Cade', animeList: [] }} onClose={() => {}} onImported={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'MyAnimeList' }));
    expect(screen.getByLabelText('Your MyAnimeList export')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Export My List' }).getAttribute('href'))
      .toBe('https://myanimelist.net/panel.php?go=export');
  });
});
