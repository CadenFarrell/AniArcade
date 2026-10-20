// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The network half is mocked; the grouping, the "already in your list" check
// and the merge are the real code, because those are what decide what a
// searched show becomes on the profile.
vi.mock('../services/anilist', () => ({ searchAnime: vi.fn() }));
vi.mock('../services/importGroups', () => ({ buildImportedAnime: vi.fn() }));

const { searchAnime } = await import('../services/anilist');
const { buildImportedAnime } = await import('../services/importGroups');
const { default: AnimeSearch } = await import('./AnimeSearch');

// Shaped like toListEntry's output, which is what searchAnime returns.
const hit = (id, title, year) => ({
  id, title, coverImageUrl: '', status: null, format: 'TV',
  startDate: { year }, episodes: 12, averageScore: 80, popularity: 1000, relatedIds: [],
});

const FRIEREN = hit(154587, "Frieren: Beyond Journey's End", 2023);
const BEBOP = hit(1, 'Cowboy Bebop', 1998);

const FRIEREN_CAST = [
  { id: 'c1', name: 'Frieren', role: 'MAIN', gender: 'Female', imageUrl: 'https://x/f.png', favourites: 9000, genres: ['Fantasy'] },
  { id: 'c2', name: 'Fern', role: 'MAIN', gender: 'Female', imageUrl: 'https://x/fe.png', favourites: 5000, genres: ['Fantasy'] },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function search(user, text) {
  await user.type(screen.getByRole('searchbox', { name: /search for an anime/i }), text);
  await user.click(screen.getByRole('button', { name: /^search$/i }));
}

describe('AnimeSearch', () => {
  it('adds a searched show with its real cast and records it as fetched', async () => {
    const user = userEvent.setup();
    searchAnime.mockResolvedValue([FRIEREN, BEBOP]);
    buildImportedAnime.mockImplementation(async (groups) => ({
      memberIds: groups.flatMap((g) => g.memberIds),
      importedAnimeList: groups.map((g) => ({
        animeId: g.key, memberIds: g.memberIds, title: g.title, characters: FRIEREN_CAST,
      })),
    }));
    const onAdded = vi.fn();
    const profile = { id: 'cade', name: 'Cade', animeList: [], anilistImportedIds: [1] };

    render(<AnimeSearch profile={profile} onAdded={onAdded} />);
    await search(user, 'frieren');

    expect(searchAnime).toHaveBeenCalledWith('frieren', expect.anything());
    const results = screen.getByRole('list', { name: /search results/i });
    expect(within(results).getByText("Frieren: Beyond Journey's End")).toBeTruthy();
    expect(within(results).getByText('TV · 2023')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: "Add Frieren: Beyond Journey's End" }));

    expect(onAdded).toHaveBeenCalledTimes(1);
    const saved = onAdded.mock.calls[0][0];
    expect(saved.animeList).toHaveLength(1);
    expect(saved.animeList[0].characters.map((c) => c.name)).toEqual(['Frieren', 'Fern']);
    // Merged with what was recorded before, sorted, so the next import's
    // checklist knows this show is paid for.
    expect(saved.anilistImportedIds).toEqual([1, 154587]);
    // One show added by hand is not where the list comes from.
    expect(saved.listSource).toBeUndefined();
    expect(await screen.findByText(/added frieren.*with 2 characters/i)).toBeTruthy();
  });

  it('marks a show already on the list instead of offering to add it again', async () => {
    const user = userEvent.setup();
    searchAnime.mockResolvedValue([BEBOP, FRIEREN]);
    const profile = {
      id: 'cade',
      name: 'Cade',
      animeList: [{ id: 'anilist_anime_1', title: 'Cowboy Bebop', characters: [] }],
      anilistImportedIds: [1],
    };

    render(<AnimeSearch profile={profile} onAdded={() => {}} />);
    await search(user, 'bebop');

    const rows = within(screen.getByRole('list', { name: /search results/i })).getAllByRole('listitem');
    expect(within(rows[0]).getByText('In your list')).toBeTruthy();
    expect(within(rows[0]).queryByRole('button')).toBeNull();
    expect(within(rows[1]).getByRole('button', { name: /^add /i })).toBeTruthy();
  });

  it('says so when nothing matches, and shows a failed search as an error', async () => {
    const user = userEvent.setup();
    searchAnime.mockResolvedValueOnce([]);
    render(<AnimeSearch profile={{ id: 'cade', name: 'Cade', animeList: [] }} onAdded={() => {}} />);

    await search(user, 'zzzz');
    expect(screen.getByText(/no shows found/i)).toBeTruthy();

    searchAnime.mockRejectedValueOnce(new Error('AniList is rate limiting requests.'));
    await user.click(screen.getByRole('button', { name: /^search$/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/rate limiting/);
  });
});
