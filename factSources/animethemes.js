#!/usr/bin/env node
// Theme songs, from AnimeThemes (api.animethemes.moe) — the same public API
// AniTune plays openings from. pack-v5's `themes` field.
//
// Looked up by AniList id, which AnimeThemes stores as an external "resource"
// beside MAL and Kitsu, so a theme lands on exactly the franchise collect()
// grouped — no title matching, which is the thing that went wrong every time
// this repo has tried it. Fifty ids to a request: the whole catalog is a few
// dozen requests, against a limit of 90 a minute.
//
// What a response MEANS (which themes, how many, in what order) is
// themesFromAnimeThemes in src/shared/utils/outsideFacts.js, where it has
// tests. This file is the network and the cache.
//
// Not animethemesClient.js, for one reason that file states itself: the API
// bot-filters on User-Agent, Node's fetch sends none, and the browser client
// cannot set one (it is a forbidden header there). A Node caller has to.
import { themesFromAnimeThemes } from '../src/shared/utils/outsideFacts.js';

const ENDPOINT = 'https://api.animethemes.moe/anime';
const USER_AGENT = 'AniArcade-facts/1.0 (+https://aniarcade.web.app)';
const BATCH = 50;
// 90 requests a minute, measured from x-ratelimit-limit; 700ms stays under it.
const MIN_INTERVAL_MS = 700;

// One file per AniList id, holding the AnimeThemes records attached to it
// (usually one, sometimes none). Per id rather than per batch so a re-run with a
// different catalog reuses everything it already has. v2 added each theme's
// `group`: without it a dub's themes ("English Version - 4Kids") read as the
// show's own, which put the 4Kids "One Piece Theme" among One Piece's openings.
const CACHE = (id) => `animethemes-v2-${id}.json`;

let lastAt = 0;
async function getJson(url, log) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    } catch (err) {
      log(`    AnimeThemes request failed (${err.message}), retrying`);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      const after = Number(res.headers.get('Retry-After'));
      await new Promise((r) => setTimeout(r, Number.isFinite(after) ? after * 1000 : 2000 * attempt));
      continue;
    }
    if (!res.ok) throw new Error(`AnimeThemes HTTP ${res.status}`);
    return res.json();
  }
  throw new Error('AnimeThemes request failed after retries');
}

// Only what themesFromAnimeThemes reads, so the cache stays small.
const slim = (anime) => ({
  name: anime?.name ?? null,
  animethemes: (anime?.animethemes ?? []).map((t) => ({
    type: t?.type ?? null,
    sequence: t?.sequence ?? null,
    group: t?.group?.name ?? null,
    song: t?.song ? { title: t.song.title ?? null, artists: (t.song.artists ?? []).map((a) => ({ name: a?.name ?? null })) } : null,
  })),
});

async function fetchBatch(ids, log) {
  const byId = new Map(ids.map((id) => [id, []]));
  const url = new URL(ENDPOINT);
  url.searchParams.set('filter[has]', 'resources');
  url.searchParams.set('filter[site]', 'AniList');
  url.searchParams.set('filter[external_id]', ids.join(','));
  url.searchParams.set('include', 'resources,animethemes.group,animethemes.song.artists');
  url.searchParams.set('page[size]', '100');
  let next = url.toString();
  while (next) {
    const json = await getJson(next, log);
    for (const anime of json?.anime ?? []) {
      // A record can carry several AniList resources (a split cour); it belongs
      // to every requested id among them.
      for (const r of anime?.resources ?? []) {
        if (r?.site !== 'AniList') continue;
        const id = Number(r.external_id);
        if (byId.has(id)) byId.get(id).push(slim(anime));
      }
    }
    next = json?.links?.next ?? null;
  }
  return byId;
}

/**
 * `themes` rows for every franchise in `groups` (collect()'s meta.groups). A
 * failed batch costs those shows their themes and nothing else.
 */
export async function collectThemes(groups, { cache, log }) {
  const ids = [...new Set(groups.flatMap((g) => g.memberIds))];
  const records = new Map();
  const missing = [];
  for (const id of ids) {
    const hit = cache.read(CACHE(id));
    if (hit) records.set(id, hit);
    else missing.push(id);
  }
  log(`  AnimeThemes: ${ids.length - missing.length} cached, ${missing.length} to fetch`);
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    try {
      for (const [id, found] of await fetchBatch(batch, log)) {
        cache.write(CACHE(id), found);
        records.set(id, found);
      }
      log(`    ${Math.min(i + BATCH, missing.length)}/${missing.length}`);
    } catch (err) {
      log(`    batch at ${i} SKIPPED: ${err.message}`);
    }
  }

  const rows = [];
  for (const group of groups) {
    const themes = themesFromAnimeThemes(group.memberIds.map((id) => records.get(id) ?? []));
    if (themes) rows.push({ kind: 'show', key: group.key, field: 'themes', value: themes });
  }
  return rows;
}
