// Ties the pieces together: players' anime lists -> AnimeThemes matches ->
// themes -> a playable round. This is the only place in AniTune that does
// network work on behalf of the game loop; questionPool.js holds the rules.
import {
  loadResolutionCache, saveResolutionCache, cacheKeyFor, resolvedFromAniList, resolveByTitle,
  extractAniListId,
} from './resolveAnime';
import { fetchAnimeByAniListIds, fetchAnimeBySlugs, BATCH_SIZE } from './animethemesClient';
import { storage } from '../../../shared/services/storage';
import {
  eligibleEntries, buildQuestionPool, pickRound, pickAudioForTheme,
  DEFAULT_SAMPLE_POINT, YEAR_MIN, YEAR_MAX,
} from '../utils/questionPool';
import { DEFAULT_POPULARITY_ID } from '../utils/popularity';

// Themes change rarely, so cache them per slug and skip the round trip on
// later games. Separate from the resolution cache: that one maps titles to
// slugs, this one holds the payload.
//
// The key is versioned because the cached value is a *shape*, not just data. A
// 14-day TTL means widening the API include — artists, most recently — would
// otherwise reach nobody who had played in the past fortnight: they would get
// the new reveal with none of the new fields in it, which looks like the feature
// silently not working. Bump the suffix whenever the client's THEMES_INCLUDE or
// slimThemes below changes.
//
// v3 stores slimThemes' output, not the raw payload. v2 kept every entry and
// every video's full record — measured at ~20 KB a show, so a few hundred shows
// reached localStorage's ~5 MB quota. Past that, storage.setItem failed, NOTHING
// new was cached, and every later game went cold again — while crowding the
// profiles key that shares the quota. v2 is deleted on sight to give it back.
const THEME_CACHE_KEY = 'anitune_theme_cache_v3';
const STALE_THEME_CACHE_KEYS = ['anitune_theme_cache_v2'];
const THEME_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function loadThemeCache() {
  for (const key of STALE_THEME_CACHE_KEYS) storage.removeItem(key);
  return storage.getItem(THEME_CACHE_KEY) || {};
}

/**
 * A show's themes reduced to exactly what buildQuestionPool reads: the theme's
 * own fields, the song and its performers, and the ONE audio link
 * pickAudioForTheme would choose — in the same nested shape, so the pool builder
 * cannot tell a cached show from a fresh one. A theme with no playable audio is
 * dropped here rather than carried as dead weight; buildQuestionPool would skip
 * it anyway, and a show left with none reads as `themeless`, which is the truth.
 *
 * Exported for the playtest seed, which pre-fills this cache the way a finished
 * game leaves it.
 */
export function slimThemes(themes) {
  const out = [];
  for (const theme of themes || []) {
    const audio = pickAudioForTheme(theme);
    if (!audio) continue;
    out.push({
      type: theme.type,
      slug: theme.slug,
      sequence: theme.sequence,
      song: theme.song
        ? {
          title: theme.song.title ?? null,
          artists: (theme.song.artists || []).map((a) => ({ name: a?.name ?? null })),
        }
        : null,
      animethemeentries: [{
        version: audio.entry.version ?? 1,
        videos: [{ audio: { link: audio.link } }],
      }],
    });
  }
  return out;
}

function chunks(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const isAbort = (err) => err?.name === 'AbortError';

/**
 * Prepares everything needed to play.
 *
 * Network work comes in batches. Shows with an AniList id (every import) go
 * BATCH_SIZE to a request, which brings back the match and its themes at once.
 * Only shows with no id pay a request each, for the title search, and their
 * themes are batched by slug after it. It used to be two throttled requests per
 * show: ~400 requests, about five minutes, for a cold 200-show pool. Now it is
 * eight, overlapping, in ~9s. onProgress still reports {phase, done, total}, so the setup screens
 * show it moving. A warm run makes no requests.
 *
 * Both caches are read once and written once (in `finally`, so a cancelled
 * deal keeps what it already fetched). The old per-show read/modify/write
 * parsed, re-serialised and read back the whole cache for every show, which is
 * quadratic in the pool.
 *
 * Returns { questions, round, eligible, unresolved, themeless }.
 * `unresolved` and `themeless` are surfaced so the setup screen can tell the
 * player which of their shows AniTune cannot use, instead of silently
 * dropping them.
 */
export async function prepareQuestions(players, {
  sharedSongsOnly = true,
  includeOpenings = true,
  includeEndings = true,
  popularity = DEFAULT_POPULARITY_ID,
  yearFrom = YEAR_MIN,
  yearTo = YEAR_MAX,
  samplePoint = DEFAULT_SAMPLE_POINT,
  roundSize = 10,
  maxPerAnime = 2,
  signal,
  onProgress,
} = {}) {
  // Every pool filter is applied here, before a single request goes out — the
  // dials narrow what gets resolved, so a tight setting also makes the first
  // run faster rather than fetching everything and discarding most of it.
  const entries = eligibleEntries(players, {
    sharedSongsOnly, popularity, yearFrom, yearTo,
  });

  const resolutions = loadResolutionCache();
  const themeCache = loadThemeCache();
  let resolutionsDirty = false;
  let themesDirty = false;
  const now = Date.now();

  const freshThemes = (slug) => {
    const hit = themeCache[slug];
    return hit && now - hit.cachedAt < THEME_CACHE_TTL_MS ? hit.themes : null;
  };
  const storeThemes = (slug, themes) => {
    themeCache[slug] = { themes, cachedAt: now };
    themesDirty = true;
  };
  const storeResolution = (item, resolved) => {
    resolutions[item.key] = resolved;
    resolutionsDirty = true;
  };

  // One working record per show. `resolved` is undefined while unknown and null
  // for a settled "no match". A dropped request leaves it undefined: the show is
  // unusable this game, but nothing is cached as its answer.
  const items = entries.map(({ anime: entry, owners }) => {
    const key = cacheKeyFor(entry);
    const known = Object.prototype.hasOwnProperty.call(resolutions, key);
    return {
      entry, owners, key, known,
      anilistId: extractAniListId(entry.id),
      resolved: known ? resolutions[key] : undefined,
      themes: null,
    };
  });

  // Who needs which request:
  //  - a known match: only its themes, and only when the cached copy is stale;
  //  - an AniList-id show with no match on file: the id batch. That includes a
  //    cached "no match", because re-checking it costs a fiftieth of a request
  //    and AnimeThemes keeps adding shows;
  //  - an id-less show never seen before: the title search;
  //  - an id-less show already searched for in vain stays a miss. The resolver
  //    always meant "cache misses too", but its truthiness check re-ran every
  //    failed search on every game, one throttled request each.
  const byId = [];
  const bySearch = [];
  for (const item of items) {
    if (item.resolved) item.themes = freshThemes(item.resolved.slug);
    else if (item.anilistId) byId.push(item);
    else if (!item.known) bySearch.push(item);
  }

  let done = 0;
  let total = byId.length + bySearch.length;
  const step = (phase, n, entry) => {
    done += n;
    onProgress?.({ phase, done, total, entry });
  };

  // Every stage starts all of its requests at once and lets the client's
  // throttle space them out: a batch spends seconds on the server, so waiting
  // for each before starting the next made a cold deal several times longer
  // than the rate limit asks. The throttle reserves start slots, so this stays
  // at the same requests per minute — just with several in flight. Results are
  // applied as each lands; JS runs one callback at a time, so the shared caches
  // and counters need no locking.
  try {
    // Stage 1a — AniList ids, BATCH_SIZE at a time: match and themes together.
    const fallbacks = [];
    await Promise.all(chunks(byId, BATCH_SIZE).map(async (batch) => {
      let found = null;
      try {
        found = await fetchAnimeByAniListIds(batch.map((item) => item.anilistId), { signal });
      } catch (err) {
        if (isAbort(err)) throw err;
      }
      for (const item of batch) {
        if (!found) continue; // dropped request: unusable this game, not cached
        const anime = found.get(item.anilistId);
        if (anime) {
          item.resolved = resolvedFromAniList(anime);
          storeResolution(item, item.resolved);
          item.themes = slimThemes(anime.animethemes);
          storeThemes(anime.slug, item.themes);
        } else if (!item.known) {
          // AnimeThemes has no AniList link for it; the title may still find
          // it, exactly as the one-at-a-time resolver fell back.
          fallbacks.push(item);
          total += 1;
        }
      }
      step('resolving', batch.length, batch[batch.length - 1].entry);
    }));
    // In pool order, so a replayed deal searches in the same order whichever
    // batch happened to land first.
    const searchSet = new Set([...bySearch, ...fallbacks]);
    const searches = items.filter((item) => searchSet.has(item));

    // Stage 1b — title search, one request per show (each is its own query).
    await Promise.all(searches.map(async (item) => {
      try {
        item.resolved = await resolveByTitle(item.entry, { signal });
        storeResolution(item, item.resolved);
        if (item.resolved) item.themes = freshThemes(item.resolved.slug);
      } catch (err) {
        if (isAbort(err)) throw err;
      }
      step('resolving', 1, item.entry);
    }));

    // Stage 2 — themes for every match still without them, BATCH_SIZE slugs a request.
    const slugs = [...new Set(
      items.filter((item) => item.resolved && !item.themes).map((item) => item.resolved.slug),
    )];
    done = 0;
    total = slugs.length;
    const fetched = new Map();
    await Promise.all(chunks(slugs, BATCH_SIZE).map(async (batch) => {
      try {
        const found = await fetchAnimeBySlugs(batch, { signal });
        for (const slug of batch) {
          // A slug the list does not return has no themes on record — the same
          // answer the old /anime/{slug} path cached as an empty list.
          const themes = slimThemes(found.get(slug)?.animethemes);
          fetched.set(slug, themes);
          storeThemes(slug, themes);
        }
      } catch (err) {
        if (isAbort(err)) throw err;
      }
      step('themes', batch.length);
    }));
    for (const item of items) {
      if (item.resolved && !item.themes) item.themes = fetched.get(item.resolved.slug) ?? [];
    }
  } finally {
    if (resolutionsDirty) saveResolutionCache(resolutions);
    if (themesDirty) storage.setItem(THEME_CACHE_KEY, themeCache);
  }

  const resolvedAnime = [];
  const unresolved = [];
  const themeless = [];
  for (const { entry, owners, resolved, themes } of items) {
    if (!resolved) unresolved.push(entry);
    else if (!themes?.length) themeless.push(entry);
    else resolvedAnime.push({ entry, resolved, themes, owners });
  }

  const questions = buildQuestionPool(resolvedAnime, { includeOpenings, includeEndings });

  return {
    questions,
    round: pickRound(questions, { count: roundSize, maxPerAnime, samplePoint }),
    eligible: entries.map((e) => e.anime),
    unresolved,
    themeless,
  };
}
