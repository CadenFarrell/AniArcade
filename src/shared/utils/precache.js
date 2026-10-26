// Which built files the service worker stores for offline play — the pure half
// of sw/plugin.js, which walks the finished build and hands the paths here.
//
// Imported by vite.config.js under plain Node, so like facts.js it carries no
// app imports and would need explicit `.js` extensions if it ever gained one.
//
// Everything local play can ask for goes in: the page, every game's chunk (a
// game opened offline has to be on the phone already), the fact pack, fonts,
// prints, sounds, icons. Left out:
//
//   og.png              the link-preview card — chat crawlers fetch it, the app
//                       never does, and at ~480 KB it is the largest file built
//   facts/pack-*.json   all but the pack index.json names as current: a stale
//                       pack left in the folder would be stored and never read
//   casts/              the cast pack, megabytes of it, read only by a list
//                       import — which needs AniList for the list itself, so it
//                       never runs offline and storing casts for it would cost
//                       every visitor the download for nothing
//   *.map               source maps, if a build ever turns them on
//   sw.js               the worker itself — the browser fetches it on its own
//                       schedule, and a cached copy would pin it forever

const SKIP = [/^og\.png$/, /\.map$/, /^sw\.js$/, /^casts\//];
const PACK = /^facts\/pack-[^/]+\.json$/;

/**
 * `paths` are the build's files relative to its root, `/`-separated
 * ("assets/index-abc.js", "facts/index.json"); `currentPack` is the file name
 * index.json's `current` names. Returns root-relative URLs, sorted, so the
 * same build always yields the same list (and the same version hash).
 */
export function precacheList(paths, currentPack) {
  return paths
    .filter((p) => !p.split('/').some((part) => part.startsWith('.')))
    .filter((p) => !SKIP.some((re) => re.test(p)))
    .filter((p) => !PACK.test(p) || p === `facts/${currentPack}`)
    .map((p) => `/${p}`)
    .sort();
}
