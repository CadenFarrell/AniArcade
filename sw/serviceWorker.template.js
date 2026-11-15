// The arcade's service worker: local play with no signal.
//
// A TEMPLATE, not a module the app imports. sw/plugin.js reads it after every
// build, puts one line in front of it — `self.__ANIARCADE_SW__ = { VERSION,
// PRECACHE }`, the build's version hash and its files as url -> content hash
// (see src/shared/utils/precache.js for what is in it) — and writes dist/sw.js.
// A classic worker rather than a module one, so it needs nothing from the
// browser beyond service workers themselves.
//
// What it promises, and nothing more: every file local play asks for is on the
// phone, so a game opens and plays offline. It never touches another origin —
// Firebase, AniList, AnimeThemes, the MAL proxy and imported portraits all go
// straight to the network as before, which keeps "local play touches no
// third-party network" true, and keeps online play exactly as live as it was.
//
// Updates are quiet. A new build installs in the background and takes over at
// once, but a page already open keeps running the build it loaded with: its
// lazily loaded game chunks still come from the PREVIOUS cache, which activate
// keeps for that reason (newest two, never more). The next load is the new
// build. Nothing prompts, nothing reloads under a game in progress.
//
// And cheap: a new build downloads only the files whose bytes changed. The
// rest are copied from the cache the last build filled (see install).
const { VERSION, PRECACHE } = self.__ANIARCADE_SW__;
const PREFIX = 'aniarcade-';
const CACHE = `${PREFIX}${VERSION}`;
// How long a page load waits on the network before it settles for the stored
// copy. Long enough for a slow phone connection, short enough that a dead one
// is not a blank screen for half a minute.
const NETWORK_WAIT_MS = 3000;
// Lookups ignore Vary. The precache stores each file from a plain request, but
// the page asks for its module scripts with an Origin header, and a server that
// answers `Vary: Origin` (vite preview does; hosting varies on encoding) makes
// every stored file a non-match — the first offline test loaded the page and
// then failed every script on it. These are static files that never differ by
// request header, so the URL alone is the right key.
const MATCH = { ignoreVary: true };
const STORED = new Set(Object.keys(PRECACHE));

// Every file is gathered before any is written, the way cache.addAll did it: a
// download that fails leaves no half-filled cache behind. That matters beyond
// tidiness — activate keeps "the newest other cache" for pages still open on
// the previous build, and a stray partial one would take that place.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const existed = await caches.has(CACHE);
    try {
      const held = await ourCaches();
      const files = await Promise.all(Object.entries(PRECACHE).map(async ([url, hash]) => {
        return [url, (await unchanged(held, url, hash)) ?? (await download(url))];
      }));
      const cache = await caches.open(CACHE);
      await Promise.all(files.map(([url, res]) => cache.put(url, res)));
    } catch (err) {
      // Never a cache that was whole before this install touched it (the same
      // files under a changed worker share one VERSION, so one name).
      if (!existed) await caches.delete(CACHE);
      throw err;
    }
    await self.skipWaiting();
  })());
});

// Our caches, newest first: the build before this one is the likeliest to hold
// a file unchanged.
async function ourCaches() {
  const names = (await caches.keys()).filter((key) => key.startsWith(PREFIX)).reverse();
  return Promise.all(names.map((name) => caches.open(name)));
}

// The copy of this file a cache of ours already holds, if its bytes are
// exactly what this build ships. The bytes are hashed here rather than trusted
// by name or by what an older worker said it stored: public/ names are not
// content-hashed, and a deploy landing in the middle of an old install could
// have stored the next build's file under this one's name. Hashing the whole
// precache is a few megabytes, once per deploy, off the page's thread. Any
// failure is "not held", and the file is downloaded as it always was.
async function unchanged(held, url, hash) {
  try {
    for (const cache of held) {
      const hit = await cache.match(url, MATCH);
      if (hit && (await sha256(hit.clone())).startsWith(hash)) return hit;
    }
  } catch {
    // Fall through to the download.
  }
  return null;
}

async function sha256(res) {
  const digest = await crypto.subtle.digest('SHA-256', await res.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function download(url) {
  // `reload` goes past the HTTP cache: Firebase Hosting serves public/ files
  // with an hour's max-age, and a sound edited under the same name would
  // otherwise be stored stale for this whole version.
  const res = await fetch(new Request(url, { cache: 'reload' }));
  // What addAll enforced: a missing file fails the install rather than being
  // stored as an error page. The browser tries again on a later visit.
  if (!res.ok) throw new Error(`precache: HTTP ${res.status} for ${url}`);
  return res;
}

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const ours = (await caches.keys()).filter((key) => key.startsWith(PREFIX) && key !== CACHE);
    // keys() is in creation order, so the last of the others is the build
    // before this one — the one an open page may still be loading chunks from.
    await Promise.all(ours.slice(0, -1).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Same origin only, and never Firebase Hosting's reserved /__/ paths.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/__/')) return;

  // A page load: the live page when there is signal, so a deploy reaches the
  // next load; the stored one when there is not. Every route is the one page
  // (hosting rewrites them all to index.html), invite links included.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/index.html'));
    return;
  }
  // The fact pack's manifest is fetched no-store on purpose (factPack.js): a
  // data fix ships by changing it. Live when possible, stored when not.
  if (url.pathname === '/facts/index.json') {
    event.respondWith(networkFirst(request, request));
    return;
  }
  // Only what this worker stored, plus any build's hashed chunks (an open page
  // may still want the previous build's). Everything else passes straight
  // through — which matters on localhost: a preview build on :5173 registers
  // this worker, and the dev server on the same origin would otherwise have
  // its /src modules cached on first load and frozen across every edit.
  if (STORED.has(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request, fallback) {
  const network = fetch(request);
  // Lost the race to the timer: still settle it, so a late failure is not an
  // unhandled rejection in the worker's console.
  network.catch(() => {});
  try {
    return await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_WAIT_MS)),
    ]);
  } catch {
    // Offline or too slow. Nothing stored means no worse than no worker: the
    // network's own answer, or its own failure.
    return (await caches.match(fallback, MATCH)) ?? network;
  }
}

// Stored files from ANY of our caches — the previous build's included, for a
// page still running it — then the network, keeping what it brings back.
async function cacheFirst(request) {
  const hit = await caches.match(request, MATCH);
  if (hit) return hit;
  const res = await fetch(request);
  // Not an HTML answer to a non-page request: hosting rewrites a missing file
  // (an old build's chunk after a deploy) to index.html with a 200, and that
  // stored under a .js name would break the next load for good.
  if (res.ok && !(res.headers.get('content-type') ?? '').includes('text/html')) {
    const copy = res.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return res;
}
