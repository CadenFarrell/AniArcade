// The network half of importing a list from any supported site. Each site
// answers one question — which shows did this person watch — as ids, and every
// one of them is then hydrated through AniList by fetchMediaByIds, so whatever
// site a list came from, it reaches the import screen as exactly the entries
// fetchUserAnimeList returns. shared/utils/listImport.js holds the pure half
// and the reasoning; read it first.
import { fetchMediaByIds, fetchUserAnimeList } from './anilist';
import {
  COMPLETED, kitsuSlugFrom, listSourceOf, mapKitsuLibrary, mapMalProxy, parseMalExport,
} from '../utils/listImport';

const KITSU_API = 'https://kitsu.app/api/edge';

// MyAnimeList's API sends no CORS headers (measured: no Access-Control-Allow-
// Origin on any response, a 405 on the preflight), so no browser can call it.
// workers/mal-proxy is a Cloudflare Worker that calls it on our behalf with the
// app's client id. Unset — a fork, or before the worker is deployed — and MAL
// falls back to the file upload, which needs no server at all.
const MAL_PROXY = (import.meta.env?.VITE_MAL_PROXY_URL || '').replace(/\/+$/, '');

export const malProxyEnabled = () => Boolean(MAL_PROXY);

// The sites the import screen offers, in the order it offers them. `input` is
// what the screen asks for. MAL is a username when the proxy is configured and
// a file otherwise, so the screen asks this rather than hardcoding it.
export const LIST_SITES = [
  { id: 'anilist', label: 'AniList', input: 'username' },
  { id: 'mal', label: 'MyAnimeList', input: 'username' },
  { id: 'kitsu', label: 'Kitsu', input: 'username' },
  { id: 'file', label: 'List file', input: 'file' },
];

export const siteLabel = (id) => LIST_SITES.find((s) => s.id === id)?.label ?? 'AniList';

async function getJson(url, { signal, notFound } = {}) {
  let res;
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/vnd.api+json, application/json' } });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    // A network failure, not an HTTP error — the case the MAL screen turns into
    // "use the file instead", so it is tagged rather than reworded here.
    const wrapped = new Error('Could not reach the server. Check your connection and try again.');
    wrapped.network = true;
    throw wrapped;
  }
  if (res.status === 404 && notFound) throw new Error(notFound);
  if (!res.ok) {
    let message = '';
    try { message = (await res.json())?.error ?? ''; } catch { /* not JSON */ }
    throw new Error(message || `The server answered ${res.status}. Try again in a minute.`);
  }
  return res.json();
}

// Turns { entries: [{ anilistId?, malId?, status }] } into list entries. An
// id AniList does not know is counted, not dropped silently — the screen says
// how many shows it could not place.
async function hydrate(found, { signal, unmatched = 0 }) {
  const statusById = new Map();
  const anilistIds = [];
  const malIds = [];
  for (const e of found) {
    if (e.anilistId != null) {
      anilistIds.push(e.anilistId);
      statusById.set(`anilist:${e.anilistId}`, e.status);
    } else {
      malIds.push(e.malId);
      statusById.set(`mal:${e.malId}`, e.status);
    }
  }
  const { byAnilistId, byMalId } = await fetchMediaByIds({ anilistIds, malIds }, {
    signal,
    statusOf: (kind, id) => statusById.get(`${kind}:${id}`) ?? COMPLETED,
  });

  // Deduped by AniList id: two of a Kitsu library's entries can map to one
  // AniList show, and a list with a show twice would offer it twice.
  const out = new Map();
  let missing = unmatched;
  for (const e of found) {
    const entry = e.anilistId != null ? byAnilistId.get(e.anilistId) : byMalId.get(e.malId);
    if (!entry) { missing++; continue; }
    if (!out.has(entry.id)) out.set(entry.id, entry);
  }
  return { entries: [...out.values()], unmatched: missing };
}

async function fetchKitsu(input, { statusIn, signal }) {
  const slug = kitsuSlugFrom(input);
  if (!slug) throw new Error('Enter your Kitsu username or profile link.');
  const q = encodeURIComponent(slug);
  // Slug first (it is what the profile URL shows), then display name — plenty
  // of Kitsu accounts never set a slug and are reachable only by name.
  let user = (await getJson(`${KITSU_API}/users?filter[slug]=${q}&fields[users]=name`, { signal }))?.data?.[0];
  if (!user) user = (await getJson(`${KITSU_API}/users?filter[name]=${q}&fields[users]=name`, { signal }))?.data?.[0];
  if (!user) throw new Error(`Kitsu user "${slug}" not found.`);

  const kitsuStatus = statusIn.map((s) => (s === COMPLETED ? 'completed' : 'current')).join(',');
  let url = `${KITSU_API}/library-entries?filter[userId]=${encodeURIComponent(user.id)}`
    + `&filter[kind]=anime&filter[status]=${kitsuStatus}&include=anime.mappings`
    + '&fields[libraryEntries]=status,anime&fields[anime]=mappings'
    + '&fields[mappings]=externalSite,externalId&page[limit]=500';
  const found = [];
  let unmatched = 0;
  // Followed by `links.next` rather than computing offsets, so a page-size cap
  // Kitsu applies silently (it has changed before) costs nothing.
  while (url) {
    const page = await getJson(url, { signal });
    const mapped = mapKitsuLibrary(page, { statusIn });
    found.push(...mapped.entries);
    unmatched += mapped.unmatched;
    url = page?.links?.next ?? null;
  }
  return hydrate(found, { signal, unmatched });
}

async function fetchMal(username, { statusIn, signal }) {
  const name = String(username ?? '').trim();
  if (!name) throw new Error('Enter your MyAnimeList username.');
  if (!MAL_PROXY) throw new Error('MyAnimeList usernames are not set up here yet. Upload your list file instead.');
  const status = statusIn.map((s) => (s === COMPLETED ? 'completed' : 'watching')).join(',');
  const json = await getJson(
    `${MAL_PROXY}/animelist?user=${encodeURIComponent(name)}&status=${status}`,
    { signal, notFound: `MyAnimeList user "${name}" not found, or their list is private.` },
  );
  return hydrate(mapMalProxy(json, { statusIn }).entries, { signal });
}

// A gzip file starts 1f 8b. MAL hands its export out as .xml.gz; other sites
// give plain .xml. Sniffed rather than trusted from the file name, because a
// browser that already unpacked the download keeps the .gz name half the time.
async function readListFile(file) {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  if (head[0] === 0x1f && head[1] === 0x8b) {
    const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }
  return file.text();
}

async function fetchFile(file, { statusIn, signal }) {
  if (!file) throw new Error('Choose your exported list file.');
  const { entries, unmatched } = parseMalExport(await readListFile(file), { statusIn });
  return hydrate(entries, { signal, unmatched });
}

/**
 * Every site's list, as { entries, unmatched }: `entries` exactly as
 * fetchUserAnimeList returns them, `unmatched` how many shows could not be
 * placed on AniList (always 0 for an AniList list).
 *
 * `input` is a username for username sites and a File for 'file'.
 */
export async function fetchListEntries(site, input, { statusIn = [COMPLETED], signal } = {}) {
  switch (site) {
    case 'mal': return fetchMal(input, { statusIn, signal });
    case 'kitsu': return fetchKitsu(input, { statusIn, signal });
    case 'file': return fetchFile(input, { statusIn, signal });
    default: return { entries: await fetchUserAnimeList(input, { statusIn }), unmatched: 0 };
  }
}

/**
 * Whether a profile's list can be re-fetched in one tap: a username saved for a
 * site that can be asked by username. A file-based profile cannot (nothing can
 * re-read a file the player has not chosen again), and neither can a MAL one
 * while the proxy is unconfigured. Every Refresh button gates on this, so none
 * of them offers a refresh that would only open on an upload box.
 */
export function canRefreshList(profile) {
  const { site, username } = listSourceOf(profile);
  if (!username || site === 'file') return false;
  return site !== 'mal' || malProxyEnabled();
}
