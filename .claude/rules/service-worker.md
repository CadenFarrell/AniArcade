---
paths:
  - "sw/**"
  - "src/shared/utils/precache.js"
  - "src/shared/services/serviceWorker.js"
  - "firebase.json"
  - "vite.config.js"
  - "playtest/browser/offline.spec.js"
---

# The service worker

Moved from the root `CLAUDE.md` so it loads only when Claude works on the files above. The
cross-game architecture it builds on is still there.

## Offline: the service worker


Because local play only ever asks its own origin for anything, all of it can be stored, and
is: a production build carries `/sw.js` (`sw/serviceWorker.template.js`, written into the
build by `sw/plugin.js` at `writeBundle`), and once a phone has opened the arcade with signal
it opens, and plays locally, with none. What is stored is decided by
`shared/utils/precache.js` over the finished build: every chunk (a game opened offline must
already be there), the page, the fact pack `index.json` names and no other, fonts, prints,
sounds and icons — about 3.5 MB, not `og.png`. The version hashes every stored file's bytes,
because `public/` names are not content-hashed and a re-encoded sound must still ship.

- **It never touches another origin.** Firebase, AniList, AnimeThemes, the MAL proxy and
  portraits go straight to the network, so online play is exactly as live as before and the
  property above holds. "Play online" is disabled on the cover page while `navigator.onLine`
  is false (`useOnline`), and an invite link waits on the cover until signal returns.
- **Updates are quiet.** A new build installs and takes over at once, but a page already open
  keeps running what it loaded — its lazily loaded chunks still come from the previous build's
  cache, which activation keeps (newest two, never more). The next load is the new build. Page
  loads are network-first with a 3s wait, so a deploy reaches the next load and a dead
  connection still opens.
- **Never cache an HTML answer to a file request.** Hosting rewrites a missing file to
  `index.html` with a 200; stored under an old chunk's name it would break every later load.
- **It answers only for what it stored, and `/assets/` chunks.** Everything else passes
  through, because a preview build on `localhost:5173` registers the worker on the same origin
  the dev server uses, and a worker caching whatever it saw would freeze `/src` modules
  across every edit. Dev page loads are still network-first, so they stay live; Application →
  Service workers → Unregister in DevTools clears it entirely.
- **Lookups ignore `Vary`.** The precache stores plain requests, the page asks for module
  scripts with an `Origin` header, and a `Vary: Origin` answer (vite preview's) made every
  stored file a miss — the page loaded offline and then failed every script on it.
- `firebase.json` serves `/sw.js` `no-cache` (JSON has no comments, so the reason lives here),
  and `registerServiceWorker` registers only in a production bundle, after `load`, and never
  under Data Saver — the same people `preloadGames` already spares the download.
- The playtest bots run with `serviceWorkers: 'block'` (a worker's fetches go around
  Playwright's routing); `playtest/browser/offline.spec.js` is the one project that allows it,
  and checks a phone with no signal can open the arcade and set up AniQuiz, the game with the
  most fetched on demand.
