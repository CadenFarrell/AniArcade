// Maps a player's profile anime entry onto an AnimeThemes anime, so the
// opening quiz knows which themes belong to which show.
//
// Two routes in, in order of trust:
//
//   1. AniList id. Entries added by the AniList import carry it in their id
//      (`anilist_anime_<id>`, see shared/utils/profileMerge.js), and
//      AnimeThemes indexes AniList directly — an exact, unambiguous lookup.
//
//   2. Title search. Everything else (hand-added and seeded entries) has only
//      an English title. The API's search does the English->romaji work well
//      ("Demon Slayer" finds "Kimetsu no Yaiba"), but its *ordering* is not
//      trustworthy, so we re-rank — see scoreCandidate.
//
// Resolution is deliberately a one-time step whose result is cached, not
// something the game does per question: route 2 is fuzzy, and re-running it
// live would make the same guess repeatedly at 750ms a pop.
//
// Route 1 is no longer a request of its own: buildQuestions asks for 25
// AniList ids at once and gets the match and its themes in the same response
// (animethemesClient's fetchAnimeByAniListIds). What lives here is the cache and
// the two ways a match is written down, so the batched path and the search path
// cannot describe one show differently.
import { storage } from '../../../shared/services/storage';
import { searchAnime } from './animethemesClient';
import { normalizeTitle, extractAniListId, pickBestCandidate } from './matchAnime';

export { normalizeTitle, extractAniListId, scoreCandidate, pickBestCandidate } from './matchAnime';

const CACHE_KEY = 'anitune_animethemes_map';

// Read once and written once per deal by prepareQuestions — never per show.
// The old per-entry read/modify/write parsed, re-serialised and read back the
// whole map for every show, which is quadratic in the pool.
export function loadResolutionCache() {
  return storage.getItem(CACHE_KEY) || {};
}

export function saveResolutionCache(cache) {
  storage.setItem(CACHE_KEY, cache);
}

export function cacheKeyFor(entry) {
  const anilistId = extractAniListId(entry.id);
  return anilistId ? `anilist:${anilistId}` : `title:${normalizeTitle(entry.title)}`;
}

/**
 * A match found through the AniList id — exact by construction.
 *
 * Every resolution is { slug, name, mediaFormat, year, matchType, confidence }.
 * matchType is 'anilist' | 'exact' | 'fuzzy' — anything but 'anilist' and
 * 'exact' is a guess worth showing the user before it is trusted.
 */
export function resolvedFromAniList(anime) {
  return {
    slug: anime.slug,
    name: anime.name,
    mediaFormat: anime.media_format,
    year: anime.year,
    matchType: 'anilist',
    confidence: 1,
  };
}

/**
 * Route 2: the title search, one request (it cannot be batched — every query is
 * its own search). Returns a resolution or null for "no candidate"; a network
 * failure throws, so the caller can tell a real "no match" (worth caching) from
 * a dropped request (worth retrying next game).
 */
export async function resolveByTitle(entry, { signal } = {}) {
  const candidates = await searchAnime(entry.title, { signal });
  const best = pickBestCandidate(candidates, entry.title);
  if (!best) return null;
  const exact = normalizeTitle(best.candidate.name) === normalizeTitle(entry.title);
  return {
    slug: best.candidate.slug,
    name: best.candidate.name,
    mediaFormat: best.candidate.media_format,
    year: best.candidate.year,
    matchType: exact ? 'exact' : 'fuzzy',
    // Rough 0..1 signal for surfacing shaky matches in the UI. The score
    // is unbounded in principle but tops out around 100 in practice.
    confidence: exact ? 1 : Math.min(best.score / 100, 0.95),
  };
}
