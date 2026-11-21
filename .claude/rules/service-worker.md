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

A production build carries `/sw.js` (`sw/serviceWorker.template.js`, written by `sw/plugin.js` at
`writeBundle`), so a phone that opened the arcade once with signal opens and plays locally with
none. `shared/utils/precache.js` decides what is stored over the finished build: every chunk, the
page, the fact pack `index.json` names (no other), fonts, prints, sounds and icons — 113 files,
4.1 MB, 1.45 MB on the wire (2026-11-15; 119 files on 2026-11-16, with the `unlock` sound and
the record page and privacy note as chunks of their own) —
not `og.png`, and not the cast pack (`casts/`: megabytes only an import reads, and an import
needs AniList, so never offline). The version hashes every stored file's bytes, because `public/` names are not
content-hashed and a re-encoded sound must still ship.

- **A deploy downloads only the files whose bytes changed.** `PRECACHE` is url → content hash
  (`sw/plugin.js`); install hashes the copy a cache of ours already holds and copies it when it
  matches, and fetches the rest. Before this every deploy cost every returning player the whole
  1.45 MB, against Spark Hosting's ~360 MB a day. Held files are verified by their bytes, never
  trusted by name. Install gathers every file before writing any, so a failed one leaves no
  partial cache to take the previous build's place in activate. `sw/serviceWorker.test.js` runs
  install against a fake CacheStorage.

- **It never touches another origin** (Firebase, AniList, AnimeThemes, the MAL proxy,
  portraits), so online play stays live. "Play online" is disabled on the cover while
  `navigator.onLine` is false (`useOnline`); an invite link waits there until signal returns.
- **Updates are quiet.** A new build takes over at once, but an open page keeps what it loaded —
  its lazy chunks still come from the previous cache, which activation keeps (newest two). Page
  loads are network-first with a 3s wait, so a deploy reaches the next load and a dead
  connection still opens.
- **A stored file is looked up in THIS build's cache first, then the others** (`stored()`).
  `caches.match` alone searches in creation order, so the previous build won every name the two
  share: an offline load opened the page from one deploy back, and a re-encoded sound stayed
  the old one until the deploy after.
- **Never cache an HTML answer to a file request:** Hosting rewrites a missing file to
  `index.html` with a 200, and stored under an old chunk's name it breaks every later load.
- **It answers only for what it stored, and `/assets/` chunks.** A preview build on
  `localhost:5173` registers on the dev server's origin, and caching whatever it saw would freeze
  `/src` modules across edits. DevTools → Application → Service workers → Unregister clears it.
- **Lookups ignore `Vary`:** the page asks for module scripts with an `Origin` header, and vite
  preview's `Vary: Origin` made every stored file a miss offline.
- `firebase.json` serves `/sw.js` `no-cache` (JSON has no comments, so the reason is here).
  `registerServiceWorker` registers only in a production bundle, after `load`, never under Data
  Saver.
- The playtest bots run with `serviceWorkers: 'block'` (a worker's fetches bypass Playwright's
  routing); `playtest/browser/offline.spec.js` alone allows it, opening the arcade with no
  signal and setting up AniQuiz, the game with the most fetched on demand.
