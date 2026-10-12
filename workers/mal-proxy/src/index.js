// A one-route proxy that lets the browser read a public MyAnimeList list.
//
// It exists because MyAnimeList's API sends no CORS headers — measured: no
// Access-Control-Allow-Origin on any response and a 405 on the preflight — so
// no page can call it directly, however it authenticates. AniList and Kitsu
// both allow it, which is why they need nothing like this.
//
// It does as little as possible, on purpose:
//   - one route, GET /animelist?user=<name>&status=completed[,watching]
//   - it answers ONLY with MAL ids and statuses. Everything else about a show
//     comes from AniList on the player's own device (see
//     src/shared/utils/listImport.js), so nothing MAL-shaped ever reaches a
//     profile and this worker never has to change when a game does.
//   - the client id stays here as a secret, never in the app bundle.
//
// Runs on Cloudflare Workers' free tier, which needs no card — the project
// stays off anything billable (no Firebase Blaze, no Cloud Functions).

const MAL_API = 'https://api.myanimelist.net/v2';

// MAL's own username rules: 2–16 letters, digits, underscores and hyphens.
// Checked here so a crafted "user" can never become a different MAL path.
const USERNAME = /^[A-Za-z0-9_-]{2,16}$/;

// The only statuses an import reads (completed, plus watching when the player
// asks for it). MAL's status filter takes one value per request.
const STATUSES = new Set(['completed', 'watching']);

// 1000 is MAL's page ceiling. A list longer than that pages through `next`.
const PAGE_LIMIT = 1000;
// A runaway guard, not a real limit: 20 pages is 20,000 shows of one status.
const MAX_PAGES = 20;

const CACHE_SECONDS = 600;

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return origin && allowed.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : { Vary: 'Origin' };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

async function fetchStatus(user, status, clientId) {
  const entries = [];
  let url = `${MAL_API}/users/${encodeURIComponent(user)}/animelist`
    + `?status=${status}&limit=${PAGE_LIMIT}&fields=list_status&nsfw=true`;
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const res = await fetch(url, { headers: { 'X-MAL-CLIENT-ID': clientId } });
    // MAL answers 404 for an unknown user and 403 for a private list. The app
    // shows one message for both — from outside, they are the same situation.
    if (res.status === 404 || res.status === 403) return { notFound: true };
    if (!res.ok) throw new Error(`MyAnimeList answered ${res.status}`);
    const body = await res.json();
    for (const row of body?.data ?? []) {
      const malId = row?.node?.id;
      if (Number.isInteger(malId)) entries.push({ malId, status });
    }
    url = body?.paging?.next ?? null;
  }
  return { entries };
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' },
      });
    }
    if (request.method !== 'GET') return json({ error: 'GET only.' }, 405, cors);

    const url = new URL(request.url);
    if (url.pathname !== '/animelist') return json({ error: 'Not found.' }, 404, cors);

    const user = (url.searchParams.get('user') || '').trim();
    if (!USERNAME.test(user)) return json({ error: 'That is not a MyAnimeList username.' }, 400, cors);
    const statuses = [...new Set((url.searchParams.get('status') || 'completed').split(','))]
      .map((s) => s.trim())
      .filter((s) => STATUSES.has(s));
    if (!statuses.length) return json({ error: 'Unknown list status.' }, 400, cors);
    if (!env.MAL_CLIENT_ID) return json({ error: 'The proxy has no MyAnimeList client id set.' }, 500, cors);

    // Cached per user + status set, without the Origin, so the shared answer is
    // reused across sites and CORS is re-applied per request below. Ten minutes
    // is long enough to absorb a table of friends all pressing Refresh, short
    // enough that a show finished just now appears on the next try.
    const cacheKey = new Request(`https://mal-proxy.cache/animelist?user=${user.toLowerCase()}&status=${statuses.sort().join(',')}`);
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) return json(await hit.json(), 200, cors);

    try {
      const entries = [];
      for (const status of statuses) {
        const result = await fetchStatus(user, status, env.MAL_CLIENT_ID);
        if (result.notFound) return json({ error: 'User not found, or their list is private.' }, 404, cors);
        entries.push(...result.entries);
      }
      const body = { entries };
      ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${CACHE_SECONDS}` },
      })));
      return json(body, 200, cors);
    } catch (err) {
      return json({ error: `Could not read the list from MyAnimeList (${err.message}).` }, 502, cors);
    }
  },
};
