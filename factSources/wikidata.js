#!/usr/bin/env node
// The source work's facts, from Wikidata (CC0): which magazine a manga ran in,
// and who published it (or, for a light novel, under which imprint) — pack-v5's
// `serializedIn` and `originalPublisher`, which AniList has no field for at all.
//
// It also emits `originalYear` and `originalCreator`, but only as FALLBACKS:
// both arrive after AniList's rows and first-write-wins shadows them wherever
// AniList had a value. The year in particular was measured: against the start
// year of the source work's own AniList entry (factSources/anilist.js), Wikidata
// disagreed by more than a year on 14 of 434 shows, and AniList was the right
// one in every case checked (Akira 1982 not 1988, Mob Psycho 100 2012 not 2018).
//
// Chosen over Jikan, which covers more but is a MyAnimeList scrape with no
// licence to republish; a fact pack is a published file.
//
// Looked up by AniList id (Wikidata property P8729), so a work lands on exactly
// the franchise collect() grouped. Two shapes of Wikidata had to be handled, both
// measured:
//
//  - A season item ("Attack on Titan, season 1") carries the AniList id but not
//    the "based on" link — its parent series does. The query climbs "part of
//    the series" / "part of" from the season before looking.
//  - A manga's own publisher list is every licensee in every country (Viz,
//    Carlsen, Panini…). Its MAGAZINE's publisher is the one answer, so that is
//    what is read; for a light novel, which has no magazine, the work's
//    publishers are limited to Japanese ones, which gives the imprint.
//
// What the rows MEAN is originFromWikidata in src/shared/utils/outsideFacts.js,
// where it has tests. This file is the query, the network and the cache.
import { originFromWikidata } from '../src/shared/utils/outsideFacts.js';

const ENDPOINT = 'https://query.wikidata.org/sparql';
// Wikidata's query service requires an identifying User-Agent and blocks
// generic ones.
const USER_AGENT = 'AniArcade-facts/1.0 (+https://aniguess-a08f7.web.app)';
// Small batches: the property path that climbs from a season to its series is
// the expensive part of the query, and the service kills anything past 60s.
const BATCH = 40;
const MIN_INTERVAL_MS = 1500;

// One file per AniList id: the works found for it (often none — an original
// has nothing to be based on).
const CACHE = (id) => `wikidata-origin-v1-${id}.json`;

const QUERY = (ids) => `
SELECT ?al ?work
  (GROUP_CONCAT(DISTINCT ?typeL; separator="\\u001f") AS ?types)
  (GROUP_CONCAT(DISTINCT ?magL; separator="\\u001f") AS ?magazines)
  (GROUP_CONCAT(DISTINCT ?magPubL; separator="\\u001f") AS ?magazinePublishers)
  (GROUP_CONCAT(DISTINCT ?pubL; separator="\\u001f") AS ?publishers)
  (GROUP_CONCAT(DISTINCT ?authorL; separator="\\u001f") AS ?authors)
  (MIN(?when) AS ?start)
WHERE {
  VALUES ?al { ${ids.map((id) => `"${id}"`).join(' ')} }
  ?anime wdt:P8729 ?al .
  ?anime (wdt:P179|wdt:P361)* ?series .
  { ?series wdt:P144 ?work } UNION { ?work wdt:P4969 ?series }
  OPTIONAL { ?work wdt:P31 ?type . ?type rdfs:label ?typeL . FILTER(LANG(?typeL) = "en") }
  OPTIONAL { ?work wdt:P1433 ?mag . ?mag rdfs:label ?magL . FILTER(LANG(?magL) = "en")
    OPTIONAL { ?mag wdt:P123 ?magPub . ?magPub rdfs:label ?magPubL . FILTER(LANG(?magPubL) = "en") } }
  OPTIONAL { ?work wdt:P123 ?pub . ?pub wdt:P17 wd:Q17 . ?pub rdfs:label ?pubL . FILTER(LANG(?pubL) = "en") }
  OPTIONAL { ?work wdt:P50 ?author . ?author rdfs:label ?authorL . FILTER(LANG(?authorL) = "en") }
  OPTIONAL { { ?work wdt:P580 ?when } UNION { ?work wdt:P577 ?when } }
}
GROUP BY ?al ?work`;

const SEP = '\u001f';
const list = (binding) => (binding?.value ? binding.value.split(SEP).filter(Boolean) : []);

let lastAt = 0;
async function runQuery(ids, log) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    let res;
    try {
      // POST: forty ids and the query around them is past what some proxies
      // accept in a URL.
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ query: QUERY(ids) }),
      });
    } catch (err) {
      log(`    Wikidata request failed (${err.message}), retrying`);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      const after = Number(res.headers.get('Retry-After'));
      await new Promise((r) => setTimeout(r, Number.isFinite(after) ? after * 1000 : 5000 * attempt));
      continue;
    }
    if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
    return res.json();
  }
  throw new Error('Wikidata query failed after retries');
}

async function fetchBatch(ids, log) {
  const byId = new Map(ids.map((id) => [id, []]));
  const json = await runQuery(ids, log);
  for (const b of json?.results?.bindings ?? []) {
    const id = Number(b.al?.value);
    if (!byId.has(id)) continue;
    byId.get(id).push({
      types: list(b.types),
      magazines: list(b.magazines),
      magazinePublishers: list(b.magazinePublishers),
      publishers: list(b.publishers),
      authors: list(b.authors),
      start: b.start?.value ?? '',
    });
  }
  return byId;
}

/**
 * Source-work rows for every franchise in `groups` (collect()'s meta.groups).
 * Each franchise takes its facts from the first member, canonical season first,
 * that Wikidata knows anything about — a sequel season usually links to the
 * same work, so this is the canonical one's answer whenever it has one.
 */
export async function collectOrigins(groups, { cache, log }) {
  const ids = [...new Set(groups.filter((g) => g.source).flatMap((g) => g.memberIds))];
  const works = new Map();
  const missing = [];
  for (const id of ids) {
    const hit = cache.read(CACHE(id));
    if (hit) works.set(id, hit);
    else missing.push(id);
  }
  log(`  Wikidata: ${ids.length - missing.length} cached, ${missing.length} to fetch`);
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    try {
      for (const [id, found] of await fetchBatch(batch, log)) {
        cache.write(CACHE(id), found);
        works.set(id, found);
      }
      log(`    ${Math.min(i + BATCH, missing.length)}/${missing.length}`);
    } catch (err) {
      log(`    batch at ${i} SKIPPED: ${err.message}`);
    }
  }

  const rows = [];
  for (const group of groups) {
    let origin = {};
    for (const id of group.memberIds) {
      origin = originFromWikidata(works.get(id), group.source);
      if (Object.keys(origin).length) break;
    }
    const add = (field, value) => { if (value != null) rows.push({ kind: 'show', key: group.key, field, value }); };
    add('serializedIn', origin.serializedIn);
    add('originalPublisher', origin.originalPublisher);
    add('originalYear', origin.originalYear);
    // A fallback only: AniList's own credit was emitted first, and the
    // generator's first-write-wins shadows this wherever that credit exists.
    add('originalCreator', origin.author);
  }
  return rows;
}
