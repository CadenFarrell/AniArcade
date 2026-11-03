// Low-level AnimeThemes.moe client for the browser. No auth or API key — the
// whole API is public. Throttles from the x-ratelimit-limit header the API
// actually returns (90/min as of writing) and backs off on 429.
//
// Two things learned the hard way, both verified against the live API:
//
//  1. The API bot-filters on User-Agent. A request with no UA (Node's built-in
//     fetch) gets a 403 HTML error page instead of JSON, which parses as a
//     confusing SyntaxError rather than an obvious failure. Browsers send a
//     real UA so this is a non-issue here, but any Node-side script using this
//     module must set one — fetch() in the browser cannot set User-Agent at
//     all (it is a forbidden header), so we rely on the browser's own.
//
//  2. The audio CDN (a.animethemes.moe) answers OPTIONS preflight with CORS
//     headers but omits them on the actual GET. Plain <audio src> playback and
//     Range seeking both work; fetch()/decodeAudioData/crossOrigin="anonymous"
//     do not. Do not try to pull audio bytes into JS without a proxy.
const ENDPOINT = 'https://api.animethemes.moe';
const FALLBACK_MIN_INTERVAL_MS = 750; // ~80 req/min, under the observed 90 limit

let nextSlotAt = 0;
let minIntervalMs = FALLBACK_MIN_INTERVAL_MS;

// Spaces request STARTS, not request lifetimes: each caller reserves the next
// free slot synchronously, before it awaits anything. That is what lets
// buildQuestions keep several batches in flight — a 25-show batch spends ~3s
// on the server, and waiting for each before starting the next tripled a cold
// deal — while the per-minute count stays where the limit wants it. The old
// form read a shared "last request" stamp and wrote it after the wait, so
// callers arriving together all saw the same stamp and fired at once.
async function throttle(signal) {
  const now = Date.now();
  const slot = Math.max(now, nextSlotAt);
  nextSlotAt = slot + minIntervalMs;
  const wait = slot - now;
  if (wait > 0) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, wait);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
  }
}

function updateThrottleFromHeaders(res) {
  const limit = Number(res.headers.get('x-ratelimit-limit'));
  if (Number.isFinite(limit) && limit > 0) {
    minIntervalMs = Math.max(Math.ceil(60000 / limit) + 100, 300);
  }
}

// `params` values are encoded as-is; bracketed keys like 'filter[site]' are
// what the API expects, so callers pass them literally.
//
// `path` may also be a whole URL — a list response's `links.next` — but only one
// on the API's own origin: a next link is data from the response, and following
// it anywhere else would hand a third party our request.
export async function animethemesRequest(path, params = {}, { signal } = {}) {
  const url = /^https?:/i.test(path)
    ? new URL(path)
    : new URL(path.startsWith('/') ? path : `/${path}`, ENDPOINT);
  if (url.origin !== new URL(ENDPOINT).origin) {
    throw new Error(`AnimeThemes: refusing to follow ${url.origin}`);
  }
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  for (let attempt = 1; attempt <= 4; attempt++) {
    await throttle(signal);

    let res;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      if (attempt === 4) throw new Error(`AnimeThemes request failed: ${err.message}`);
      continue;
    }

    updateThrottleFromHeaders(res);

    if (res.status === 429 || res.status >= 500) {
      const retryAfterSec = Number(res.headers.get('Retry-After'));
      const waitMs = Number.isFinite(retryAfterSec)
        ? retryAfterSec * 1000
        : Math.min(1000 * 2 ** attempt, 30000);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    // A 403 here is almost always the bot filter (see note 1 above) and the
    // body is HTML, so surface it as something recognisable rather than
    // letting res.json() throw a bare SyntaxError.
    if (res.status === 403) {
      throw new Error('AnimeThemes returned 403 (likely User-Agent bot filter)');
    }

    const json = await res.json().catch(() => null);
    if (!res.ok || !json) {
      throw new Error(`AnimeThemes error: HTTP ${res.status}`);
    }
    return json;
  }
  throw new Error('AnimeThemes request failed after retries');
}

// Free-text search. The API does the English->romaji work ("Demon Slayer"
// finds "Kimetsu no Yaiba"), but its ordering is unreliable — see
// scoreCandidate in resolveAnime.js.
export async function searchAnime(query, { signal } = {}) {
  const json = await animethemesRequest('/search', {
    q: query,
    'fields[search]': 'anime',
  }, { signal });
  return json?.search?.anime ?? [];
}

// The include every theme-bearing request asks for: the audio file and the
// song's performers. `animethemes.song.artists` is one extra nesting level on a
// request we were making anyway, so it costs nothing beyond payload — and it is
// the difference between a reveal that names the band and one that doesn't.
// Changing this changes the shape of what buildQuestions caches, which is why
// that cache key carries a version; bump it alongside any change here.
const THEMES_INCLUDE = 'animethemes.animethemeentries.videos.audio,animethemes.song.artists';

// Sparse fieldsets: only what resolvedFromAniList, slimThemes and
// buildQuestionPool read. A third of the bytes (measured 2026-11-03: 343 KB ->
// 111 KB for 50 shows, identical themes and audio links) — the full records
// carry every video's resolution, size, tags and paths, none of which a clip
// needs, and this is a download a player may be making on phone data. It does
// not make the server faster; batch size does (below). A field read anywhere
// downstream that is missing here comes back absent, silently, so add it here
// first.
const SPARSE_FIELDS = {
  'fields[anime]': 'slug,name,media_format,year',
  'fields[resource]': 'site,external_id',
  'fields[animetheme]': 'type,slug,sequence',
  'fields[animethemeentry]': 'version',
  'fields[video]': 'basename',
  'fields[audio]': 'link',
  'fields[song]': 'title',
  'fields[artist]': 'name',
};

// How many shows go in one list request. Server time grows with the batch —
// measured 2.6s for 10 ids, 3.2s for 25, 7.7s for 50 — so 25 a request, with
// buildQuestions keeping several in flight (the throttle spaces their starts),
// finishes a 200-show cold deal in ~9s where four sequential 50s took ~31s.
// page[size]=100 leaves room for the records a split cour adds without usually
// needing a second page.
export const BATCH_SIZE = 25;

// Walks a list response's pages. The API pages /anime at 15 by default, and a
// batch can return more records than ids asked for (one AniList id can sit on
// several AnimeThemes records), so `links.next` is followed until it runs out.
async function listAnime(params, { signal }) {
  const all = [];
  let next = '/anime';
  let query = { ...params, ...SPARSE_FIELDS, 'page[size]': 100 };
  while (next) {
    const json = await animethemesRequest(next, query, { signal });
    all.push(...(json?.anime ?? []));
    next = json?.links?.next ?? null;
    // The next link already carries every parameter.
    query = {};
  }
  return all;
}

/**
 * Up to BATCH_SIZE shows by AniList media id, in ONE request: the match and its
 * themes together, which used to be a /resource lookup and an /anime/{slug}
 * fetch per show — two throttled requests each, minutes for a big pool.
 *
 * Returns Map<anilistId, anime>. A record can carry several AniList resources (a
 * split cour), so it serves every requested id among them; an id that matched
 * nothing is simply absent. Same rule as the generator's fetchBatch. The
 * `filter[site]`/`filter[external_id]` filters are unscoped on purpose and safe
 * that way: only resources have those fields, so they narrow the included
 * resources to the ones we asked about and touch nothing else (verified live
 * 2026-11-03) — unlike `slug`, below.
 */
export async function fetchAnimeByAniListIds(ids, { signal } = {}) {
  const wanted = new Set(ids.map(Number));
  const byId = new Map();
  if (!wanted.size) return byId;
  const records = await listAnime({
    'filter[has]': 'resources',
    'filter[site]': 'AniList',
    'filter[external_id]': [...wanted].join(','),
    include: `resources,${THEMES_INCLUDE}`,
  }, { signal });
  for (const anime of records) {
    for (const r of anime?.resources ?? []) {
      if (r?.site !== 'AniList') continue;
      const id = Number(r.external_id);
      if (wanted.has(id) && !byId.has(id)) byId.set(id, anime);
    }
  }
  return byId;
}

/**
 * Up to BATCH_SIZE shows by AnimeThemes slug, with their themes, in one request
 * — for shows matched by title search, which have a slug but no AniList id.
 *
 * **The filter must be scoped to the type: `filter[anime][slug]`.** A bare
 * `filter[slug]` also applies to every INCLUDED resource that has a slug field,
 * and themes do ("OP1"), so it comes back with each show and zero themes — a
 * 200 that looks exactly like "this show has no music". Verified live
 * 2026-11-03; buildQuestions.test.js holds the line.
 *
 * Returns Map<slug, anime>.
 */
export async function fetchAnimeBySlugs(slugs, { signal } = {}) {
  const bySlug = new Map();
  if (!slugs.length) return bySlug;
  const records = await listAnime({
    'filter[anime][slug]': [...new Set(slugs)].join(','),
    include: THEMES_INCLUDE,
  }, { signal });
  for (const anime of records) {
    if (anime?.slug) bySlug.set(anime.slug, anime);
  }
  return bySlug;
}
