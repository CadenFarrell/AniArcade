#!/usr/bin/env node
// Writes the cast pack: AniList character pages for the most popular shows,
// served from public/casts/ so a list import takes most of its cast from this
// site instead of AniList's 30-requests-a-minute API. The reader is
// src/shared/services/castPack.js; the file shape is
// src/shared/utils/castPackFormat.js.
//
//   npm run generate:casts                 # top 1000 by popularity
//   npm run generate:casts -- --limit 1500
//
// No cache directory, unlike generateFacts.js: the whole run is ~100 batched
// requests, a few minutes, and a cache would only serve stale favourites.
//
// What it fetches is exactly what an import would. The query and the live
// fetch are anilist.js's own (fetchCharacterPagesLive), and the depth is
// utils/castPaging.js's own decision, run per show at the LOOSEST settings an
// import offers — every supporting character counts (threshold 0), not
// main-only, 60 kept. A franchise only ever needs less than its deepest member
// alone (its floor is at least as high), and a higher threshold or main-only
// stops sooner, so this depth serves every setting; any page it lacks is
// fetched live by the import anyway.
//
// Shows still airing (or not yet aired) are left out: their casts are still
// growing, and a pack frozen mid-season would hide the newest characters until
// the next regeneration. They import live.
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { anilistRequest } from './src/shared/services/anilistClient.js';
import { fetchCharacterPagesLive, fetchMediaByIds } from './src/shared/services/anilist.js';
import { pageCasts } from './src/shared/utils/castPaging.js';
import { encodeCastFile } from './src/shared/utils/castPackFormat.js';
import { groupIntoFranchises } from './src/shared/utils/franchise.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'public', 'casts');

const limitFlag = process.argv.indexOf('--limit');
const LIMIT = limitFlag >= 0 ? Number(process.argv[limitFlag + 1]) : 1000;
if (!Number.isInteger(LIMIT) || LIMIT < 1) throw new Error('--limit takes a whole number');

// The settings the pack is deep enough for — see the header.
const PACK_DEPTH = { minSupportingFavourites: 0, mainOnly: false, max: 60, maxPages: 12 };
const SETTLED = new Set(['FINISHED', 'CANCELLED', 'HIATUS']);

const POPULAR_QUERY = `
query ($page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { id status }
  }
}`;

const log = (...args) => console.log(...args);
let requests = 0;

async function popular(limit) {
  const media = [];
  for (let page = 1; media.length < limit; page++) {
    requests++;
    const data = await anilistRequest(POPULAR_QUERY, { page });
    media.push(...(data?.Page?.media ?? []));
    if (!data?.Page?.pageInfo?.hasNextPage) break;
  }
  return media.slice(0, limit);
}

function nextVersion() {
  try {
    const current = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8')).current;
    const n = Number(/^v(\d+)$/.exec(current)?.[1]);
    return `v${Number.isInteger(n) ? n + 1 : 1}`;
  } catch {
    return 'v1';
  }
}

async function main() {
  const started = Date.now();
  log(`Top ${LIMIT} shows by popularity…`);
  const top = await popular(LIMIT);
  const ids = top.filter((m) => SETTLED.has(m.status)).map((m) => m.id);
  log(`  ${top.length} shows, ${ids.length} finished (the rest are still airing and import live)`);

  // Grouped into franchises only to choose files: one file per franchise lets
  // a main cast that recurs every season be stored once.
  requests += Math.ceil(ids.length / 50);
  const { byAnilistId } = await fetchMediaByIds({ anilistIds: ids });
  const entries = ids.map((id) => byAnilistId.get(id)).filter(Boolean);
  const groups = groupIntoFranchises(entries);
  log(`  ${groups.length} franchises`);

  const pages = new Map();
  const fetchPage = async (pageIds, page, { onBatch } = {}) => {
    requests += Math.ceil(pageIds.length / 27);
    const got = await fetchCharacterPagesLive(pageIds, page, { onBatch });
    for (const [id, result] of got) {
      if (!pages.has(id)) pages.set(id, []);
      pages.get(id)[page - 1] = result;
    }
    log(`  page ${page}: ${pageIds.length} shows`);
    return got;
  };
  // Every show its own group: the depth each needs alone. See the header.
  await pageCasts(entries.map((e) => [e.id]), fetchPage, PACK_DEPTH);

  const version = nextVersion();
  const dir = path.join(OUT, version);
  fs.mkdirSync(dir, { recursive: true });
  const media = {};
  let bytes = 0;
  let gzipped = 0;
  let files = 0;
  for (const group of groups) {
    const members = group.memberIds.filter((id) => pages.get(id)?.length);
    if (!members.length) continue;
    const file = `${group.key}.json`;
    const body = JSON.stringify(encodeCastFile(new Map(members.map((id) => [id, pages.get(id)]))));
    fs.writeFileSync(path.join(dir, file), body);
    files++;
    bytes += body.length;
    gzipped += zlib.gzipSync(body).length;
    for (const id of members) media[id] = file;
  }

  const manifest = {
    current: version,
    generatedAt: new Date().toISOString().slice(0, 10),
    shows: Object.keys(media).length,
    media,
  };
  fs.writeFileSync(path.join(OUT, 'index.json'), `${JSON.stringify(manifest)}\n`);

  // Older versions are deleted, as old fact packs are: the manifest is the only
  // thing that names a version, and it now names this one.
  for (const old of fs.readdirSync(OUT)) {
    if (old !== version && /^v\d+$/.test(old)) fs.rmSync(path.join(OUT, old), { recursive: true, force: true });
  }

  const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  log(`\nWrote public/casts/${version}/: ${manifest.shows} shows in ${files} files, `
    + `${mb(bytes)} (${mb(gzipped)} gzipped), ~${requests} requests in ${Math.round((Date.now() - started) / 1000)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
