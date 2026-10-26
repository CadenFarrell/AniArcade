// How deep to page each show's characters connection: the decision half of
// anilist.js's fetchManyAnimeCharacters, pure so that "fetches less, keeps the
// same cast" is a thing a test can check rather than a hope. generateCasts.js
// runs the same loop to decide how deep the cast pack goes.
//
// Explicit .js extensions, for facts.js's reason: generateCasts.js imports this
// under plain Node.
import { isWantedCharacter, mergeCharacterEdges } from './anilistFormat.js';

// Given the edges of a single page, returns true once no later page can hold a
// wanted character. Results are MAIN-first, then FAVOURITES_DESC within each
// role, so once a SUPPORTING entry below the threshold appears (or any
// SUPPORTING appears in mainOnly mode) everything after is guaranteed unwanted.
export function reachedCutoff(pageEdges, { mainOnly, minSupportingFavourites }) {
  if (mainOnly) return pageEdges.some((e) => e.role !== 'MAIN');
  return pageEdges.some((e) => e.role !== 'MAIN' && (e.node.favourites ?? 0) < minSupportingFavourites);
}

/**
 * The most favourites any character on a LATER page of this show could have,
 * read off the last edge fetched — the same ROLE, FAVOURITES_DESC order
 * reachedCutoff leans on:
 *
 *   last edge SUPPORTING   later edges are SUPPORTING at or below it, or
 *                          BACKGROUND, which is never kept: its favourites.
 *   last edge MAIN         later MAINs are at or below it, but the SUPPORTING
 *                          that follow restart the order and can be anyone, so
 *                          no bound — unless main-only, where they never count.
 *   last edge BACKGROUND   nothing later is kept.
 */
export function unseenBound(lastPageEdges, { mainOnly }) {
  const last = lastPageEdges[lastPageEdges.length - 1];
  if (!last) return Infinity;
  const favourites = last.node?.favourites ?? 0;
  if (last.role === 'MAIN') return mainOnly ? favourites : Infinity;
  if (last.role === 'SUPPORTING') return favourites;
  return -Infinity;
}

/**
 * Which of one franchise's members still need their next page.
 *
 * The import keeps a franchise's top `max` wanted characters by favourites
 * (filterAndMapCharacterEdges' cap, run over the merged cast), and paging used
 * not to know that: One Piece paged to its twelfth page — 300 characters — to
 * keep 60, and every member of a franchise paged as if it were the whole show.
 * Once the merged cast holds `max` wanted characters, the max-th one's
 * favourites is a floor no later page can beat unless its bound is above it,
 * so a member whose bound is not above the floor is finished.
 *
 * Exact except at a tie with the floor (equal favourites, where the cap's sort
 * is decided by merge order), which this lets go rather than fetching a page
 * on the off chance.
 *
 * `state` maps id → { edges (every page so far), lastPageEdges, done }.
 */
export function membersToPage(memberIds, state, { minSupportingFavourites, mainOnly, max = Infinity }) {
  const open = memberIds.filter((id) => !state.get(id).done);
  if (open.length === 0 || !Number.isFinite(max)) return open;

  const wanted = mergeCharacterEdges(memberIds.map((id) => state.get(id).edges))
    .filter((e) => isWantedCharacter(e, { minSupportingFavourites, mainOnly }));
  if (wanted.length < max) return open;

  const floor = wanted.map((e) => e.node.favourites ?? 0).sort((a, b) => b - a)[max - 1];
  return open.filter((id) => unseenBound(state.get(id).lastPageEdges, { mainOnly }) > floor);
}

/**
 * Pages every franchise's cast as far as it can matter. `groups` is an array of
 * member-id arrays, one per franchise; a lone show is a group of one.
 *
 * `fetchPage(ids, page, { onBatch })` resolves to Map<id, { genres, edges,
 * hasNextPage }>, and may call onBatch(partialMap) as batches land so the
 * progress bar moves during page 1. `onProgress(n)` reports how many
 * FRANCHISES are finished.
 *
 * Returns Map<id, { genres, edges }>, edges unfiltered and in page order.
 */
export async function pageCasts(groups, fetchPage, {
  minSupportingFavourites = 100,
  mainOnly = false,
  max = Infinity,
  maxPages = 12,
  onProgress,
} = {}) {
  const opts = { minSupportingFavourites, mainOnly, max };
  const ids = groups.flat();
  // id -> { genres, edges, hasNextPage, lastPageEdges, done }
  const state = new Map();

  const settle = (s) => {
    s.done = !s.hasNextPage || reachedCutoff(s.lastPageEdges, opts);
  };
  const report = () => {
    if (!onProgress) return;
    onProgress(groups.filter((g) => g.every((id) => state.get(id)?.done)).length);
  };

  // Page 1 of every member: the main cast and the best-known supporting, which
  // no smaller fetch can stand in for.
  await fetchPage(ids, 1, {
    onBatch: (batch) => {
      for (const [id, r] of batch) {
        const s = { genres: r.genres, edges: [...r.edges], hasNextPage: r.hasNextPage, lastPageEdges: r.edges };
        settle(s);
        state.set(id, s);
      }
      report();
    },
  });

  // Any id AniList didn't return (e.g. an invalid id) won't be in state yet —
  // record it as an empty, finished result so callers still get an entry.
  for (const id of ids) {
    if (!state.has(id)) state.set(id, { genres: [], edges: [], hasNextPage: false, lastPageEdges: [], done: true });
  }

  // Later pages, batched per page level across every franchise still open.
  for (let page = 2; ; page++) {
    const next = [];
    for (const group of groups) {
      const wanted = new Set(membersToPage(group, state, opts));
      for (const id of group) {
        const s = state.get(id);
        if (s.done) continue;
        if (wanted.has(id)) next.push(id);
        else s.done = true;
      }
    }
    report();
    if (next.length === 0 || page > maxPages) break;

    const pageData = await fetchPage(next, page, {});
    for (const id of next) {
      const r = pageData.get(id) ?? { edges: [], hasNextPage: false };
      const s = state.get(id);
      s.edges.push(...r.edges);
      s.hasNextPage = r.hasNextPage;
      s.lastPageEdges = r.edges;
      settle(s);
    }
  }

  const result = new Map();
  for (const [id, s] of state) result.set(id, { genres: s.genres, edges: s.edges });
  return result;
}
