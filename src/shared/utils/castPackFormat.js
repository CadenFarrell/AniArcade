// The compact shape character pages are stored in, both in the cast pack
// (public/casts/, written by generateCasts.js) and in the device's own page
// cache (services/castCache.js). Pure, and Node-safe with explicit .js
// extensions, because the generator writes what the app reads.
//
// A stored page expands back to exactly what anilist.js's live fetch puts in
// its page cache — { genres, edges: [{ role, node }], hasNextPage } — so the
// paging and the filter downstream cannot tell a stored page from a fetched
// one. Two things are done to a node on the way in, both of them work the
// filter would do anyway:
//
//   name         resolved through preferEnglishName now, stored as `full` with
//                no native/alternative — which preferEnglishName then returns
//                unchanged. The alternative-names array is most of a name's bytes
//                and nothing else reads it.
//   description  stored already through trimDesc, which cuts a bio of several
//                KB to 280 characters. The filter runs trimDesc again, so it is
//                stored trimmed only where trimming twice changes nothing — the
//                rare bio where it would keeps its raw text, and the import's
//                output is identical either way.
import { preferEnglishName, trimDesc } from './anilistFormat.js';

// Every AniList character portrait lives under this; a stored image is the
// rest of the URL, and one that does not start with it is stored whole.
const IMAGE_PREFIX = 'https://s4.anilist.co/file/anilistcdn/character/large/';

const ROLE_CODE = { MAIN: 'M', SUPPORTING: 'S', BACKGROUND: 'B' };
const ROLE_NAME = { M: 'MAIN', S: 'SUPPORTING', B: 'BACKGROUND' };

function storedDescription(raw) {
  const trimmed = trimDesc(raw);
  return trimDesc(trimmed) === trimmed ? trimmed : (raw ?? '');
}

/** One character node as [name, gender, image, description, favourites]. */
export function compactNode(node) {
  const image = node?.image?.large ?? '';
  return [
    preferEnglishName(node?.name),
    node?.gender ?? null,
    image.startsWith(IMAGE_PREFIX) ? image.slice(IMAGE_PREFIX.length) : image,
    storedDescription(node?.description),
    node?.favourites ?? 0,
  ];
}

export function expandNode(id, row) {
  const [name, gender, image, description, favourites] = row;
  return {
    id: Number(id),
    name: { full: name, native: null, alternative: [] },
    gender,
    image: { large: image && !/^https?:/.test(image) ? IMAGE_PREFIX + image : image },
    description,
    favourites,
  };
}

const compactEdges = (edges, chars) => edges.map((e) => {
  const id = e.node.id;
  if (chars && !(id in chars)) chars[id] = compactNode(e.node);
  return chars ? [id, ROLE_CODE[e.role] ?? 'B'] : [id, ROLE_CODE[e.role] ?? 'B', ...compactNode(e.node)];
});

/**
 * One page on its own (the device cache stores pages one key each):
 * { g: genres, n: hasNextPage, e: [[id, role, ...node row]] }.
 */
export function encodeCastPage(page) {
  return { g: page.genres ?? [], n: page.hasNextPage ? 1 : 0, e: compactEdges(page.edges ?? []) };
}

export function decodeCastPage(stored) {
  return {
    genres: stored.g ?? [],
    hasNextPage: Boolean(stored.n),
    edges: (stored.e ?? []).map(([id, role, ...row]) => ({ role: ROLE_NAME[role], node: expandNode(id, row) })),
  };
}

/**
 * Every page of several shows in one file, a character stored once however
 * many seasons list them — a franchise's main cast is most of every season.
 *
 *   pagesByMedia  Map<mediaId, page[]>, page 1 first
 *   returns       { c: { [charId]: node row }, m: { [mediaId]: { g, p: [[n, edges]] } } }
 */
export function encodeCastFile(pagesByMedia) {
  const chars = {};
  const media = {};
  for (const [id, pages] of pagesByMedia) {
    media[id] = {
      g: pages[0]?.genres ?? [],
      p: pages.map((page) => [page.hasNextPage ? 1 : 0, compactEdges(page.edges ?? [], chars)]),
    };
  }
  return { c: chars, m: media };
}

/** A pack file as Map<'mediaId:page', page>, the page cache's own keys. */
export function decodeCastFile(file) {
  const out = new Map();
  const nodes = new Map();
  const nodeFor = (id) => {
    if (!nodes.has(id)) nodes.set(id, expandNode(id, file.c[id]));
    return nodes.get(id);
  };
  for (const [id, { g, p }] of Object.entries(file?.m ?? {})) {
    p.forEach(([n, edges], i) => {
      out.set(`${id}:${i + 1}`, {
        genres: g ?? [],
        hasNextPage: Boolean(n),
        edges: edges.map(([charId, role]) => ({ role: ROLE_NAME[role], node: nodeFor(charId) })),
      });
    });
  }
  return out;
}
