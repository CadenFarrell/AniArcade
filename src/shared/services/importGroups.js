import { fetchManyAnimeCharacters } from './anilist';
import { filterAndMapCharacterEdges, mergeCharacterEdges, summarizeGroupStats } from '../utils/anilistFormat';

const MAX_CHARACTERS_PER_SHOW = 60;

// Franchise groups in, profile-ready anime entries out: the cast fetch and the
// filter that the list import and ListManager's single-show search both run.
// One copy, because the favourites threshold, the main-only switch and the
// per-show cap are what decide which characters a game can deal, and two
// copies of that would let a searched show carry a different cast than the
// same show imported.
//
// Returns { importedAnimeList, memberIds } for mergeAnimeIntoProfile and
// mergeImportedAnilistIds. Throws whatever the fetch throws, AbortError
// included — what a cancel means is the caller's business.
export async function buildImportedAnime(groups, {
  signal,
  minSupportingFavourites = 100,
  mainOnly = false,
  onProgress,
} = {}) {
  // Characters are still fetched per AniList media id — a progress bar counts
  // those fetches, so its total is the flattened member count.
  //
  // Every member of a group is fetched, including ones already covered:
  // filterAndMapCharacterEdges applies the favourites filter and the per-show
  // cap across the WHOLE franchise cast below, so a group that only gained a
  // season still needs its earlier seasons' edges to filter against.
  const memberIds = groups.flatMap((g) => g.memberIds);

  const charactersById = await fetchManyAnimeCharacters(memberIds, {
    signal,
    minSupportingFavourites,
    mainOnly,
    onProgress,
  });

  const importedAnimeList = groups.map((group) => {
    const memberResults = group.memberIds.map((id) => charactersById.get(id) ?? { genres: [], edges: [] });
    // Merge every season's cast, then apply the favourites/main filters and
    // the per-show cap once across the whole franchise.
    const edges = mergeCharacterEdges(memberResults.map((r) => r.edges));
    const genres = [...new Set(memberResults.flatMap((r) => r.genres))];
    const characters = filterAndMapCharacterEdges(edges, {
      minSupportingFavourites,
      mainOnly,
      maxCharacters: MAX_CHARACTERS_PER_SHOW,
      genres,
    });
    // The per-show facts ride along with the cast. Without them a saved entry
    // is only { id, title, characters }, which is why every ranking axis but
    // "opinion" had no data to sort by.
    return {
      animeId: group.key,
      memberIds: group.memberIds,
      title: group.title,
      ...summarizeGroupStats(group),
      characters,
    };
  });

  return { importedAnimeList, memberIds };
}
