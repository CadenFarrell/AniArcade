// Loads the cast pack: character pages for the most popular shows, generated
// offline by generateCasts.js and served as static files out of public/casts/,
// so most of an import's cast comes from this site instead of AniList's
// 30-requests-a-minute API. Same two-step layout as the fact pack
// (services/factPack.js): a small manifest fetched no-store, naming immutable
// files that can be cached hard.
//
//   casts/index.json            { current: 'vN', generatedAt, media: { [anilistId]: file } }
//   casts/vN/<file>.json        one franchise's seasons (utils/castPackFormat.js)
//
// It is a pre-filled page cache and nothing more: anilist.js copies what it
// loads into the same `id:page` cache a live fetch fills, and the paging
// (utils/castPaging.js) asks for pages exactly as before. A page the pack does
// not hold — a show outside it, a season newer than it, a page deeper than it
// went — is fetched live, so the pack can be stale or missing without an
// import coming out wrong. Its favourites are as old as its generatedAt, which
// can move which supporting characters make a show's cut; regenerating is a few
// minutes (see .claude/rules/list-import.md).
//
// Every failure resolves to "no pages", never a throw: the live fetch is the
// fallback, so a missing pack only costs time.
//
// Node-safe at import (generateCasts.js imports anilist.js, which imports this);
// it only fetches when called.
import { decodeCastFile } from '../utils/castPackFormat.js';

const MANIFEST_PATH = 'casts/index.json';

const base = () => import.meta.env?.BASE_URL || '/';

let manifestPending = null;
const filePending = new Map();

async function fetchJson(path, init) {
  const res = await fetch(`${base()}${path}`, init);
  if (!res.ok) throw new Error(`cast pack: HTTP ${res.status} for ${path}`);
  return res.json();
}

function loadManifest() {
  if (!manifestPending) {
    manifestPending = fetchJson(MANIFEST_PATH, { cache: 'no-store' }).catch((err) => {
      console.warn(err);
      // Forgotten, so the next import tries again.
      manifestPending = null;
      return null;
    });
  }
  return manifestPending;
}

function loadFile(path) {
  if (!filePending.has(path)) {
    filePending.set(path, fetchJson(path).then(decodeCastFile).catch((err) => {
      console.warn(err);
      filePending.delete(path);
      return new Map();
    }));
  }
  return filePending.get(path);
}

/**
 * The pack's pages for these AniList media ids, as Map<'id:page', page> —
 * every page of every file they live in. One request per franchise file, all
 * at once: they are this site's own static files, under no rate limit.
 */
export async function loadPackPages(ids) {
  try {
    const manifest = await loadManifest();
    const current = manifest?.current;
    if (typeof current !== 'string' || !current || !manifest.media) return new Map();
    const files = new Set();
    for (const id of ids) {
      const file = manifest.media[id];
      if (file) files.add(`casts/${current}/${file}`);
    }
    const out = new Map();
    for (const pages of await Promise.all([...files].map(loadFile))) {
      for (const [key, page] of pages) out.set(key, page);
    }
    return out;
  } catch (err) {
    console.warn(err);
    return new Map();
  }
}
