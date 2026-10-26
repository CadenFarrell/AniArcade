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
const { ProfileContext } = await import('../context/profileContext');

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
  vi.unstubAllGlobals();
});

// Kitsu is called straight from the browser (it sends CORS headers), so its
// half is a fetch stub: one user lookup, one library page mapping to AniList 1.
function stubKitsu() {
  const fetchMock = vi.fn(async (url) => {
    const body = String(url).includes('/users?')
      ? { data: [{ id: '7', type: 'users' }] }
      : {
          data: [{
            id: '100', type: 'libraryEntries', attributes: { status: 'completed' },
            relationships: { anime: { data: { type: 'anime', id: '1' } } },
          }],
          included: [
            { id: '1', type: 'anime', relationships: { mappings: { data: [{ type: 'mappings', id: '9' }] } } },
            { id: '9', type: 'mappings', attributes: { externalSite: 'anilist/anime', externalId: '1' } },
          ],
          links: {},
        };
    return { ok: true, status: 200, json: async () => body };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

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

  it('saves a pasted Kitsu profile link as just the username', async () => {
    const user = userEvent.setup();
    const fetchMock = stubKitsu();
    fetchMediaByIds.mockResolvedValue({ byAnilistId: new Map([[1, BEBOP]]), byMalId: new Map() });
    fetchManyAnimeCharacters.mockResolvedValue(new Map([[1, { genres: ['Sci-Fi'], edges: [SPIKE] }]]));
    const onImported = vi.fn();

    render(<ListImport profile={{ id: 'cade', name: 'Cade', animeList: [] }} onClose={() => {}} onImported={onImported} />);

    await user.click(screen.getByRole('button', { name: 'Kitsu' }));
    await user.type(screen.getByLabelText('Kitsu username or profile link'), 'https://kitsu.app/users/vikhyat');
    await user.click(screen.getByRole('button', { name: 'Fetch My List' }));

    expect(await screen.findByText('Cowboy Bebop')).toBeTruthy();
    expect(String(fetchMock.mock.calls[0][0])).toContain('filter[slug]=vikhyat');
    expect(fetchMediaByIds.mock.calls[0][0]).toEqual({ anilistIds: [1], malIds: [] });

    await user.click(screen.getByRole('button', { name: /Import Selected/ }));
    await user.click(await screen.findByRole('button', { name: 'Done' }));

    // The slug, not the URL — it is what the username box shows next time.
    expect(onImported.mock.calls[0][0].listSource).toEqual({ site: 'kitsu', username: 'vikhyat' });
  });

  it('asks MAL players for their export file while no proxy is configured', async () => {
    const user = userEvent.setup();
    render(<ListImport profile={{ id: 'cade', name: 'Cade', animeList: [] }} onClose={() => {}} onImported={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'MyAnimeList' }));
    expect(screen.getByLabelText('Your MyAnimeList export')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Export My List' }).getAttribute('href'))
      .toBe('https://myanimelist.net/panel.php?go=export');
  });

  describe('with no profile: making one from the import', () => {
    const stubFetch = () => {
      stubKitsu();
      fetchMediaByIds.mockResolvedValue({ byAnilistId: new Map([[1, BEBOP]]), byMalId: new Map() });
      fetchManyAnimeCharacters.mockResolvedValue(new Map([[1, { genres: ['Sci-Fi'], edges: [SPIKE] }]]));
    };
    const importFromKitsu = async (user) => {
      await user.click(screen.getByRole('button', { name: 'Kitsu' }));
      await user.type(screen.getByLabelText('Kitsu username or profile link'), 'https://kitsu.app/users/vikhyat');
    };
    const finish = async (user) => {
      await user.click(screen.getByRole('button', { name: 'Fetch My List' }));
      await user.click(await screen.findByRole('button', { name: /Import Selected/ }));
      await user.click(await screen.findByRole('button', { name: 'Done' }));
    };

    it("names the new profile after the account, and says so as it's typed", async () => {
      const user = userEvent.setup();
      stubFetch();
      const onImported = vi.fn();
      render(<ListImport profile={null} onClose={() => {}} onImported={onImported} />);

      expect(screen.getByRole('heading', { name: 'Bring your anime list' })).toBeTruthy();
      await importFromKitsu(user);
      // The slug, not the pasted link.
      expect(screen.getByLabelText('Your name in the arcade').value).toBe('vikhyat');
      await finish(user);

      const made = onImported.mock.calls[0][0];
      expect(made).toMatchObject({ id: 'vikhyat', name: 'vikhyat', listSource: { site: 'kitsu', username: 'vikhyat' } });
      expect(made.animeList.map((a) => a.title)).toEqual(['Cowboy Bebop']);
    });

    it('lets the name be changed, and needs one for a file', async () => {
      const user = userEvent.setup();
      stubFetch();
      const onImported = vi.fn();
      render(<ListImport profile={null} onClose={() => {}} onImported={onImported} />);

      await user.click(screen.getByRole('button', { name: 'List file' }));
      await user.upload(screen.getByLabelText('Your exported list'), new File([MAL_EXPORT], 'a.xml', { type: 'text/xml' }));
      expect(screen.getByRole('button', { name: 'Read My List' }).disabled).toBe(true);
      await user.type(screen.getByLabelText('Your name in the arcade'), 'Sam Lee');
      expect(screen.getByRole('button', { name: 'Read My List' }).disabled).toBe(false);
    });

    it('imports into a saved profile the name folds onto, rather than minting a second one', async () => {
      const user = userEvent.setup();
      stubFetch();
      const onImported = vi.fn();
      const saved = {
        id: 'vikhyat', name: 'Vikhyat', portraitKey: 'spike spiegel',
        animeList: [{ id: 'old_1', title: 'Trigun', characters: [] }],
      };
      render(
        <ProfileContext.Provider value={{ profiles: { vikhyat: saved } }}>
          <ListImport profile={null} onClose={() => {}} onImported={onImported} />
        </ProfileContext.Provider>
      );

      await importFromKitsu(user);
      expect(screen.getByText(/Adds to Vikhyat, already saved on this device/)).toBeTruthy();
      await finish(user);

      const merged = onImported.mock.calls[0][0];
      expect(merged).toMatchObject({ id: 'vikhyat', name: 'Vikhyat', portraitKey: 'spike spiegel' });
      expect(merged.animeList.map((a) => a.title).sort()).toEqual(['Cowboy Bebop', 'Trigun']);
    });
  });
});
