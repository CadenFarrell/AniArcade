#!/usr/bin/env node
// The one fact source implemented today.
//
// The Wikidata-vs-Jikan choice is still deferred, and now for a measured
// reason. Once AniQuiz gave the pack real clues to aim at, the worst gaps
// (composer and series composition, each missing on about one show in five)
// turned out to be THIS adapter reading only the first page of staff, not
// AniList lacking the credit — see STAFF_QUERY. Wikidata, measured against the
// same 441 shows, had a composer for under half of them. So the outside source
// waits until the gaps left after paging are known. A second source is a second
// file in this directory exporting the same `collect`, and nothing in
// generateFacts.js changes.
//
// Why AniList is the first source rather than an odd one out: the import
// deliberately shipped only a "cheap tier" of per-show fields, because every
// byte in a profile is a byte in the one localStorage origin every game shares —
// which is why storage.setItem grew a read-back guard and a banner. Staff, voice
// actors, tags and producers are the SAME fact for every player who owns the
// show, so storing them once per profile is the worst available place for them.
// A shared pack is the right one, and this adapter is that move.
import { anilistRequest } from '../src/shared/services/anilistClient.js';
import {
  subjectKeyForShow, subjectKeyForCharacter, STAFF_CREDITS, pickCredit,
} from '../src/shared/utils/facts.js';
import { toListEntry, summarizeGroupStats } from '../src/shared/utils/anilistFormat.js';
import { groupIntoFranchises } from '../src/shared/utils/franchise.js';

// One media per request. The staff and characters connections are both nested,
// and AniList's complexity cap is per query — this is why there is no analogue
// of anilist.js's BATCH_SIZE = 15 aliasing here.
const MEDIA_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english }
    format
    source
    season
    seasonYear
    startDate { year month day }
    episodes
    duration
    popularity
    averageScore
    favourites
    coverImage { large }
    genres
    tags { name rank isGeneralSpoiler isMediaSpoiler isAdult }
    studios { edges { isMain node { name } } }
    relations { edges { relationType(version: 2) node { id type } } }
    staff(sort: RELEVANCE, perPage: 20) { edges { role node { name { full } } } }
    characters(sort: [ROLE, FAVOURITES_DESC], perPage: 25) {
      edges {
        role
        node { id name { full } gender favourites }
        voiceActors(language: JAPANESE, sort: RELEVANCE) { name { full } }
      }
    }
  }
}`;

// The cache file a MEDIA_QUERY response lives in. Versioned with the query: v4
// added relations (franchise grouping) and the stats fields, and a response
// cached under the old query lacks both — reusing it would silently ship a pack
// with every franchise ungrouped and no numbers. The staff pages below kept
// their query, so they keep their files.
const MEDIA_CACHE = (id) => `anilist-media-v4-${id}.json`;

// Later pages of one show's staff, fetched only while a credit in STAFF_CREDITS is
// still missing. MEDIA_QUERY's first page is 20 entries sorted by RELEVANCE, and
// on a big production that page is all directors and designers: Frieren's
// "Music: Evan Call" is entry 26. That one page was why Frieren, Demon Slayer
// and Spirited Away shipped with no composer at all.
//
// The page size MUST stay MEDIA_QUERY's 20. Pages are offsets of perPage, so
// page 2 at 25 would start at entry 26 and silently skip 21–25.
const STAFF_PAGE_SIZE = 20;
const STAFF_QUERY = `
query ($id: Int, $page: Int) {
  Media(id: $id, type: ANIME) {
    staff(sort: RELEVANCE, perPage: ${STAFF_PAGE_SIZE}, page: $page) {
      pageInfo { hasNextPage }
      edges { role node { name { full } } }
    }
  }
}`;

// A ceiling, not a target: 300 entries. A film has no "Series Composition" and
// a short has no composer, so the search for a credit that does not exist has
// to stop somewhere. Paging stops sooner the moment every credit is found, so
// only a long-runner ever goes deep — and those are exactly the shows the old
// ceiling of 5 failed: Naruto Shippuden, One Piece and Dragon Ball Z each spent
// all five pages on per-episode "Animation Director" credits and shipped with
// no composer.
const MAX_STAFF_PAGES = 15;

const POPULAR_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { id }
  }
}`;

// Staff credits are matched by STAFF_CREDITS / pickCredit in facts.js, not
// here: a pattern is the kind of logic that fails silently, and a root-level
// script has no tests.
const CREDIT_FIELDS = Object.keys(STAFF_CREDITS);

// Tags below this are minority opinions on a public wiki, and a clue built on
// one is a clue whose answer the table can reasonably dispute.
const TAG_RANK_FLOOR = 60;
const MAX_TAGS = 6;

const filled = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function showRows(key, media, staffEdges) {
  const rows = [];
  const add = (field, value) => { if (value != null) rows.push({ kind: 'show', key, field, value }); };

  const studioEdges = media.studios?.edges ?? [];
  add('studio', filled(studioEdges.find((e) => e.isMain)?.node?.name));
  const producers = studioEdges.filter((e) => !e.isMain).map((e) => filled(e.node?.name)).filter(Boolean);
  if (producers.length) add('producers', producers);

  for (const field of CREDIT_FIELDS) {
    add(field, filled(pickCredit(staffEdges, field)?.node?.name?.full));
  }

  add('format', filled(media.format));
  add('source', filled(media.source));
  add('season', filled(media.season));
  add('seasonYear', media.seasonYear ?? null);
  add('episodes', media.episodes ?? null);
  add('duration', media.duration ?? null);

  const genres = (media.genres ?? []).map(filled).filter(Boolean);
  if (genres.length) add('genres', genres);

  // Spoiler tags are excluded rather than merely deprioritised: a clue is read
  // aloud to a table that includes people who have not seen the show.
  const tags = (media.tags ?? [])
    .filter((t) => (t?.rank ?? 0) >= TAG_RANK_FLOOR && !t.isGeneralSpoiler && !t.isMediaSpoiler && !t.isAdult)
    .slice(0, MAX_TAGS)
    .map((t) => filled(t.name))
    .filter(Boolean);
  if (tags.length) add('tags', tags);

  return rows;
}

// Main cast, plus the best-known few of the supporting cast. Both gates are
// load-bearing rather than niceties: voice actors are per character per show,
// so they are the one field that can turn a few hundred KB of pack into a few
// MB, and a supporting cast of thirty adds thirty rows nobody will ever be
// asked about. The floor keeps the ones a table could plausibly name (Kakashi,
// Erwin); the cap is per SHOW KEY, not per season, so a six-season franchise
// does not get six seasons' worth.
const SUPPORTING_MIN_FAVOURITES = 1000;
const SUPPORTING_PER_SHOW = 4;

function characterRows(media, showKey, meta, supportingCount) {
  const rows = [];
  for (const edge of media.characters?.edges ?? []) {
    const main = edge.role === 'MAIN';
    if (!main) {
      if (edge.role !== 'SUPPORTING' || (edge.node?.favourites ?? 0) < SUPPORTING_MIN_FAVOURITES) continue;
      if ((supportingCount.get(showKey) ?? 0) >= SUPPORTING_PER_SHOW) continue;
    }
    const name = filled(edge.node?.name?.full);
    const key = name && subjectKeyForCharacter(name);
    if (!key) continue;

    // A character in several shows keeps the first name casing seen and unions
    // their appearances, the same collapse a profile does. Main and supporting
    // are tracked apart, because the cast clues ask about MAIN — see
    // facts.js's `appearsIn`.
    let entry = meta.characters[key];
    const isNew = !entry;
    if (isNew) {
      entry = { anilistId: edge.node?.id ?? null, name, appearsIn: [], supportingIn: [] };
      meta.characters[key] = entry;
    }
    const list = main ? entry.appearsIn : entry.supportingIn;
    if (!list.includes(showKey)) {
      list.push(showKey);
      if (!main) supportingCount.set(showKey, (supportingCount.get(showKey) ?? 0) + 1);
    }
    if (!isNew) continue;

    rows.push({ kind: 'character', key, field: 'voiceActorJp', value: filled(edge.voiceActors?.[0]?.name?.full) });
    rows.push({ kind: 'character', key, field: 'gender', value: filled(edge.node?.gender) });
    rows.push({ kind: 'character', key, field: 'favourites', value: edge.node?.favourites ?? null });
  }
  return rows;
}

const staffMissing = (edges, have) =>
  CREDIT_FIELDS.filter((field) => !have.has(field) && !pickCredit(edges, field));

/**
 * One show's staff, paged until every STAFF_CREDITS credit is found or the list
 * runs out. Page 1 is the MEDIA_QUERY response already in hand; later pages are
 * cached one file each, so a regeneration over a warm cache stays offline.
 *
 * `have` is the credits this subject key already holds from an earlier season:
 * a sequel does not page through its whole crew hunting for a composer that
 * first-write-wins will shadow anyway.
 *
 * Order is preserved — page 1 first — so "first match wins" still means "most
 * relevant credit wins".
 */
async function allStaffEdges(media, have, { cache, log }) {
  const edges = [...(media.staff?.edges ?? [])];
  // A short first page is the whole list. (The cached MEDIA_QUERY responses
  // predate asking for pageInfo, so a full page is the only signal they carry.)
  let more = edges.length === STAFF_PAGE_SIZE;
  for (let page = 2; more && page <= MAX_STAFF_PAGES && staffMissing(edges, have).length; page++) {
    const file = `anilist-staff-${media.id}-p${page}.json`;
    let data = cache.read(file);
    if (!data) {
      try {
        data = await anilistRequest(STAFF_QUERY, { id: media.id, page });
      } catch (err) {
        // Keep what is already in hand. A failed page costs this show a credit,
        // never the show.
        log(`      staff page ${page} failed: ${err.message}`);
        break;
      }
      cache.write(file, data);
    }
    const staff = data?.Media?.staff;
    edges.push(...(staff?.edges ?? []));
    more = Boolean(staff?.pageInfo?.hasNextPage);
  }
  return edges;
}

/** The top `limit` anime by popularity, as AniList ids. */
export async function popularIds(limit, { cache, log }) {
  const PER_PAGE = 50;
  const ids = [];
  for (let page = 1; ids.length < limit; page++) {
    // Versioned for MEDIA_CACHE's reason plus one of its own: popularity order
    // drifts, and v3's pages were a 2026-09-08 snapshot. A new suffix is what
    // forces a fresh ranking instead of re-serving the old one forever.
    const file = `anilist-popular-v4-p${page}.json`;
    const cached = cache.read(file);
    const data = cached ?? await anilistRequest(POPULAR_QUERY, { page, perPage: PER_PAGE });
    if (!cached) cache.write(file, data);
    const media = data?.Page?.media ?? [];
    ids.push(...media.map((m) => m.id));
    log(`  popularity page ${page} → ${ids.length} ids`);
    if (!data?.Page?.pageInfo?.hasNextPage || media.length === 0) break;
  }
  return ids.slice(0, limit);
}

async function fetchMedia(anilistIds, { cache, log }) {
  const out = [];
  let done = 0;
  for (const id of anilistIds) {
    done++;
    const file = MEDIA_CACHE(id);
    let data = cache.read(file);
    if (!data) {
      try {
        data = await anilistRequest(MEDIA_QUERY, { id });
      } catch (err) {
        log(`  [${done}/${anilistIds.length}] ${id} — SKIPPED: ${err.message}`);
        continue;
      }
      cache.write(file, data);
      log(`  [${done}/${anilistIds.length}] fetched ${id}`);
    }
    if (data?.Media) out.push(data.Media);
  }
  return out;
}

// Sortable number for an AniList FuzzyDate; missing parts sort last.
const airDateKey = (d) => (d?.year ?? 9999) * 10000 + (d?.month ?? 99) * 100 + (d?.day ?? 99);

/**
 * Fetches every subject and returns the rows and the identifying fields.
 *
 * Returns { rows, meta } where meta carries the display casing, the AniList id
 * and the title aliases. The id is provenance only, never identity: the pack is
 * keyed on the same fold a saved profile keys on, so a hand-entered entry with
 * no AniList id still finds its row.
 *
 * FRANCHISES ARE GROUPED BY RELATIONS, the way an import groups them — every
 * media goes through toListEntry and groupIntoFranchises, the exact functions
 * the list import runs, and the group is keyed on its canonical season's title.
 * v3 folded by title alone, and titles do not fold reliably: a trailing hyphen
 * split Re:Zero, a curly apostrophe split Komi, and Food Wars arrived as six
 * subjects. That let a sequel speak for a franchise and let a quiz offer the
 * answer's own sequel as a wrong option. Grouping the way the import does means
 * the pack and a player's profile agree on what a show IS by construction, and
 * `aliases` catches the profiles whose title is a member's rather than the
 * canonical one's.
 *
 * Within a group the canonical member emits first, then the rest by air date,
 * so the generator's first-write-wins reads "the canonical season, backfilled
 * by later ones". Groups emit best-ranked first, so when two unrelated
 * franchises fold to one title (the 1999 and 2011 Hunter x Hunter are an
 * ALTERNATIVE relation, not a season) the better-known one holds the key.
 *
 * `ranks` maps AniList id → 1-based popularity rank (see popularIds). A group
 * takes its best member's rank.
 */
export async function collect(anilistIds, { cache, log, ranks = new Map() }) {
  const rows = [];
  const meta = { shows: {}, characters: {}, aliases: {} };

  const media = await fetchMedia(anilistIds, { cache, log });
  const byId = new Map(media.map((m) => [m.id, m]));
  const rankOf = (group) => Math.min(...group.memberIds.map((id) => ranks.get(id) ?? Infinity));
  const groups = groupIntoFranchises(media.map((m) => toListEntry(m)))
    .map((group) => ({ ...group, rank: rankOf(group) }))
    .sort((a, b) => a.rank - b.rank || a.key - b.key);

  // Staff credits each subject key already holds, so a later season only pages
  // for what the canonical one lacked. See allStaffEdges.
  const credited = new Map();
  const supportingCount = new Map();
  let done = 0;

  for (const group of groups) {
    done++;
    const key = subjectKeyForShow(group.title);
    if (!key) continue;
    if (!meta.shows[key]) meta.shows[key] = { anilistId: group.key, title: group.title };

    const ordered = [...group.members].sort((a, b) =>
      (a.id === group.key ? -1 : b.id === group.key ? 1 : airDateKey(a.startDate) - airDateKey(b.startDate)));
    for (const member of ordered) {
      const alias = subjectKeyForShow(member.title);
      if (alias && alias !== key && !meta.aliases[alias]) meta.aliases[alias] = key;
    }

    const before = rows.length;
    // The stats an import would store for this franchise, by the import's own
    // fold — see facts.js on why the two must mean the same thing.
    const stats = summarizeGroupStats(group);
    const canonical = byId.get(group.key);
    const add = (field, value) => { if (value != null) rows.push({ kind: 'show', key, field, value }); };
    add('popularity', stats.popularity);
    add('averageScore', stats.averageScore);
    add('startYear', stats.startDate?.year);
    add('showFavourites', canonical?.favourites);
    if (Number.isFinite(group.rank)) add('popularityRank', group.rank);

    const have = credited.get(key) ?? new Set();
    for (const member of ordered) {
      const m = byId.get(member.id);
      const staffEdges = await allStaffEdges(m, have, { cache, log });
      const showRowsForMedia = showRows(key, m, staffEdges);
      for (const row of showRowsForMedia) {
        if (CREDIT_FIELDS.includes(row.field)) have.add(row.field);
      }
      rows.push(...showRowsForMedia);
      rows.push(...characterRows(m, key, meta, supportingCount));
    }
    credited.set(key, have);
    log(`  [${done}/${groups.length}] ${group.title} (${group.members.length} media) → ${rows.length - before} rows`);
  }

  // appearsIn / supportingIn are assembled across shows, so they can only be
  // emitted once every subject has been seen. A show a character is main in
  // never also lists them as supporting: one season's side role does not
  // demote a lead, the rule mergeCharacterEdges applies to a profile.
  for (const [key, entry] of Object.entries(meta.characters)) {
    const supporting = entry.supportingIn.filter((k) => !entry.appearsIn.includes(k));
    if (entry.appearsIn.length) rows.push({ kind: 'character', key, field: 'appearsIn', value: entry.appearsIn });
    if (supporting.length) rows.push({ kind: 'character', key, field: 'supportingIn', value: supporting });
    delete entry.appearsIn;
    delete entry.supportingIn;
  }

  return { rows, meta };
}
