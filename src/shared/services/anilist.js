// Explicit .js extensions: generateCasts.js imports this file under plain Node
// for the batch query and the live page fetch, so the pack it writes and the
// pages an import fetches cannot drift apart.
import { anilistRequest } from './anilistClient.js';
import { toListEntry } from '../utils/anilistFormat.js';
import { pageCasts } from '../utils/castPaging.js';
import { loadPackPages } from './castPack.js';
import { readCachedPages, writeCachedPages } from './castCache.js';

// Every field a list entry is built from (see anilistFormat.js toListEntry).
// One string for both queries below, so an AniList list and a list hydrated
// from another site can never disagree about what a show carries.
const MEDIA_FIELDS = `
  id
  format
  episodes
  duration
  averageScore
  popularity
  source
  season
  seasonYear
  startDate { year month day }
  title { romaji english }
  coverImage { large }
  studios(isMain: true) { nodes { name } }
  relations {
    edges {
      relationType(version: 2)
      node { id type }
    }
  }`;

const LIST_QUERY = `
query ($userName: String, $type: MediaType, $statusIn: [MediaListStatus]) {
  MediaListCollection(userName: $userName, type: $type, status_in: $statusIn) {
    lists {
      entries {
        status
        media {${MEDIA_FIELDS}
        }
      }
    }
  }
}`;

// AniList silently caps the characters connection at 25 per page regardless of
// the perPage we request, so the page size is fixed.
const CHAR_PER_PAGE = 25;

// How many shows to pack into a single aliased request. Measured 2026-10-26:
// each alias costs 18 against AniList's complexity cap of 500 (30 aliases came
// back "Max query complexity should be 500 but got 540"), so 27 is the most one
// query can carry. It was 15 by guesswork, which cost nearly twice the
// requests. fetchLiveChunk halves a batch AniList still refuses, so a change on
// their end costs requests, not the import.
const BATCH_SIZE = 27;

// Builds one aliased GraphQL query fetching page `page` of characters for
// several media ids at once (aliases m0..mN). ids are AniList integers, coerced
// with Number() so they are safe to inline into the query string.
export function buildBatchCharacterQuery(ids, page) {
  const aliases = ids.map((id, i) => `m${i}: Media(id: ${Number(id)}, type: ANIME) {
    genres
    characters(sort: [ROLE, FAVOURITES_DESC], perPage: ${CHAR_PER_PAGE}, page: ${page}) {
      pageInfo { hasNextPage }
      edges {
        role
        node { id name { full native alternative } gender image { large } description(asHtml: false) favourites }
      }
    }
  }`);
  return `query { ${aliases.join('\n')} }`;
}

const isComplexityError = (err) => /complexity/i.test(err?.message ?? '');

async function fetchLiveChunk(ids, page, signal) {
  let data;
  try {
    data = await anilistRequest(buildBatchCharacterQuery(ids, page), {}, { signal });
  } catch (err) {
    if (ids.length < 2 || !isComplexityError(err)) throw err;
    const half = Math.ceil(ids.length / 2);
    const [a, b] = await Promise.all([
      fetchLiveChunk(ids.slice(0, half), page, signal),
      fetchLiveChunk(ids.slice(half), page, signal),
    ]);
    return new Map([...a, ...b]);
  }
  return new Map(ids.map((id, j) => {
    const media = data?.[`m${j}`];
    return [id, {
      genres: media?.genres ?? [],
      edges: media?.characters?.edges ?? [],
      hasNextPage: media?.characters?.pageInfo?.hasNextPage ?? false,
    }];
  }));
}

/**
 * Page `page` of characters for many ids, straight from AniList: aliased
 * batches of `batchSize`, all requested at once — anilistClient.js decides how
 * many are actually in flight. onBatch(Map) fires as each batch lands. Returns
 * Map<id, { genres, edges, hasNextPage }>, raw and unfiltered.
 */
export async function fetchCharacterPagesLive(ids, page, { signal, batchSize = BATCH_SIZE, onBatch } = {}) {
  const out = new Map();
  const chunks = [];
  for (let i = 0; i < ids.length; i += batchSize) chunks.push(ids.slice(i, i + batchSize));
  await Promise.all(chunks.map(async (chunk) => {
    const got = await fetchLiveChunk(chunk, page, signal);
    for (const [id, result] of got) out.set(id, result);
    onBatch?.(got);
  }));
  return out;
}

// Raw character pages by `${id}:${page}`, for this session. Stored data is
// unfiltered, so it is reused regardless of the caller's favourites/mainOnly
// settings (those only affect client-side filtering, not what we fetch).
//
// The first of three layers, checked in order: this, then the device's cache
// of pages it fetched live (services/castCache.js, IndexedDB, 30 days), then
// the network. The cast pack (services/castPack.js) is copied INTO this one
// before an import pages anything, so it is served as a hit like any other.
const pageCache = new Map();

// Resolves page `page` of characters for many ids, serving hits from the cache
// layers for free and fetching the misses live. Invokes onBatch(Map<id,
// pageResult>) after each resolution (every hit up front, then once per
// network round-trip) so callers can advance a progress bar incrementally.
// Returns Map<id, { genres, edges, hasNextPage }>.
async function fetchCharacterPage(ids, page, { signal, batchSize, onBatch }) {
  const out = new Map();
  let misses = [];
  for (const id of ids) {
    const cached = pageCache.get(`${id}:${page}`);
    if (cached) out.set(id, cached);
    else misses.push(id);
  }

  if (misses.length) {
    const stored = await readCachedPages(misses.map((id) => `${id}:${page}`));
    misses = misses.filter((id) => {
      const hit = stored.get(`${id}:${page}`);
      if (!hit) return true;
      pageCache.set(`${id}:${page}`, hit);
      out.set(id, hit);
      return false;
    });
  }
  if (out.size > 0) onBatch?.(new Map(out));
  if (!misses.length) return out;

  const fetched = new Map();
  await fetchCharacterPagesLive(misses, page, {
    signal,
    batchSize,
    onBatch: (got) => {
      for (const [id, result] of got) {
        pageCache.set(`${id}:${page}`, result);
        fetched.set(`${id}:${page}`, result);
        out.set(id, result);
      }
      onBatch?.(got);
    },
  });
  writeCachedPages(fetched);
  return out;
}

// Fetches a public AniList user's anime list. Throws a friendly error if the
// username doesn't exist (AniList returns a GraphQL error, not a null result,
// for an unknown user).
export async function fetchUserAnimeList(username, { statusIn = ['COMPLETED'], signal } = {}) {
  let data;
  try {
    data = await anilistRequest(LIST_QUERY, { userName: username, type: 'ANIME', statusIn }, { signal });
  } catch (err) {
    if (/not found/i.test(err.message)) {
      throw new Error(`AniList user "${username}" not found.`);
    }
    throw err;
  }

  const collection = data?.MediaListCollection;
  if (!collection) throw new Error(`AniList user "${username}" not found.`);

  const seen = new Map();
  for (const list of collection.lists ?? []) {
    for (const entry of list.entries ?? []) {
      const media = entry.media;
      if (!media || seen.has(media.id)) continue;
      seen.set(media.id, toListEntry(media, entry.status));
    }
  }
  return [...seen.values()];
}

const SEARCH_QUERY = `
query ($search: String) {
  Page(perPage: 10) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {${MEDIA_FIELDS}
    }
  }
}`;

// Shows matching a typed title, best match first, as list entries — the same
// shape a listed or hydrated show takes, so a show added from a search goes
// through the import's grouping, cast fetch and merge unchanged. This is what
// replaced ListManager's free-text "add an anime" box: a show typed in by hand
// had no id, no stats and no cast anyone else could recognise.
export async function searchAnime(query, { signal } = {}) {
  const data = await anilistRequest(SEARCH_QUERY, { search: query }, { signal });
  return (data?.Page?.media ?? []).map((media) => toListEntry(media, null));
}

// Fetches characters for many anime at once. Rather than one request per show
// (the AniList API allows only 30 a minute), this fetches page 1 of every show
// in a few aliased batch requests, then pages further only where a later page
// could still change the cast an import keeps — utils/castPaging.js owns that
// decision. Returns Map<id, { genres, edges }> — edges accumulated across
// pages and still unfiltered (callers apply filterAndMapCharacterEdges).
//
// `groups` is the franchises, as arrays of member ids, and `max` the per-show
// cap the caller will apply across each one's merged cast; together they let
// paging stop at the cap. Without them every id is its own show, uncapped.
//
// onProgress(n) reports how many groups are fully done.
export async function fetchManyAnimeCharacters(ids, {
  signal,
  minSupportingFavourites = 100,
  mainOnly = false,
  batchSize = BATCH_SIZE,
  maxPages = 12,
  groups,
  max = Infinity,
  onProgress,
} = {}) {
  const groupList = groups ?? ids.map((id) => [id]);

  // The pack's pages become hits before anything is asked for, so page 1 of a
  // popular list resolves without a single AniList request.
  for (const [key, page] of await loadPackPages(groupList.flat())) {
    if (!pageCache.has(key)) pageCache.set(key, page);
  }

  return pageCasts(
    groupList,
    (pageIds, page, { onBatch }) => fetchCharacterPage(pageIds, page, { signal, batchSize, onBatch }),
    { minSupportingFavourites, mainOnly, max, maxPages, onProgress },
  );
}

// How many ids one hydrate request asks for. AniList's Page caps perPage at 50,
// and MEDIA_FIELDS at 50 sits well inside the complexity cap (measured: one
// request, no error) — the relations connection is the heavy part and it is
// unpaged here.
const HYDRATE_PER_PAGE = 50;

const HYDRATE_QUERY = (idField) => `
query ($ids: [Int], $page: Int) {
  Page(page: $page, perPage: ${HYDRATE_PER_PAGE}) {
    pageInfo { hasNextPage }
    media(${idField}: $ids, type: ANIME) {
      idMal${MEDIA_FIELDS}
    }
  }
}`;

async function hydrateChunk(idField, ids, { signal }) {
  const media = [];
  // Paged even though a chunk is never longer than a page: AniList returns
  // fewer media than ids for unknown ids, but a MAL id that two AniList entries
  // claim would push a full chunk onto a second page, and dropping it silently
  // is the failure that reads as "the import just forgot one show".
  for (let page = 1; ; page++) {
    const data = await anilistRequest(HYDRATE_QUERY(idField), { ids, page }, { signal });
    media.push(...(data?.Page?.media ?? []));
    if (!data?.Page?.pageInfo?.hasNextPage) break;
  }
  return media;
}

/**
 * Looks up shows another site named, so they arrive exactly as an AniList list
 * entry would (see toListEntry for why that is the whole cross-site design).
 *
 * `anilistIds` are AniList's own ids (Kitsu maps most of its library straight
 * to them); `malIds` are MyAnimeList ids, resolved through AniList's `idMal`.
 * Returns { byAnilistId, byMalId }: Maps to list entries carrying `status`,
 * where `statusOf(id)` says which list each id came from. An id AniList does
 * not know is simply absent — the caller counts those as unmatched.
 */
export async function fetchMediaByIds({ anilistIds = [], malIds = [] } = {}, { signal, statusOf } = {}) {
  const byAnilistId = new Map();
  const byMalId = new Map();
  const runs = [
    ['id_in', [...new Set(anilistIds)], byAnilistId, (m) => m.id],
    ['idMal_in', [...new Set(malIds)], byMalId, (m) => m.idMal],
  ];
  // Every chunk asked for at once; anilistClient.js paces them. Results are
  // applied in chunk order afterwards, so which of two duplicates wins does not
  // depend on which answer came back first.
  const jobs = [];
  for (const [idField, ids, out, keyOf] of runs) {
    for (let i = 0; i < ids.length; i += HYDRATE_PER_PAGE) {
      const chunk = ids.slice(i, i + HYDRATE_PER_PAGE).map(Number);
      jobs.push({ idField, out, keyOf, media: hydrateChunk(idField, chunk, { signal }) });
    }
  }
  const settled = await Promise.all(jobs.map((job) => job.media));
  jobs.forEach(({ idField, out, keyOf }, j) => {
    for (const media of settled[j]) {
      const key = keyOf(media);
      if (key == null || out.has(key)) continue;
      out.set(key, toListEntry(media, statusOf?.(idField === 'id_in' ? 'anilist' : 'mal', key) ?? null));
    }
  });
  return { byAnilistId, byMalId };
}
