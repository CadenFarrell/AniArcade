// The pure half of importing a list from a site other than AniList: reading
// what each site says you watched, as ids AniList can look up. Pure — no fetch,
// no DOM — so every site's quirks are pinned by a .test.js. The network half is
// shared/services/listSources.js.
//
// THE DESIGN IN ONE LINE: another site only ever says WHICH shows you watched.
// Everything about a show (title, characters, stats, its id) is then looked up
// on AniList, anonymously, by the same query an AniList list uses. A MAL
// player's profile is therefore exactly the shape of an AniList player's, and
// that is the whole reason a mixed room works: shows match across players by
// franchiseTitleKey and characters by characterNameKey, and both fold AniList's
// spellings. MAL's own data would not line up — its English titles differ, its
// character names run "Last, First", and its score is out of 10.

// The two statuses an import reads, in AniList's own enum, because that is the
// vocabulary the import screen's "include what I'm watching" toggle and
// fetchUserAnimeList's statusIn already speak. Plan-to-watch, on-hold and
// dropped are excluded on every site, as they are on AniList: a show you never
// finished is a show you cannot be asked about.
export const COMPLETED = 'COMPLETED';
export const CURRENT = 'CURRENT';

// Per site, its status vocabulary → ours. Anything unlisted is dropped.
export const STATUS_MAP = {
  // MAL's export writes words; some third-party exporters write MAL's numeric
  // codes instead (1 watching, 2 completed), so both forms are read.
  malExport: { completed: COMPLETED, watching: CURRENT, 2: COMPLETED, 1: CURRENT },
  // MAL's API (through the proxy) and Kitsu's library both use lower-case words.
  mal: { completed: COMPLETED, watching: CURRENT },
  kitsu: { completed: COMPLETED, current: CURRENT },
};

const statusFrom = (site, raw) => STATUS_MAP[site][String(raw ?? '').trim().toLowerCase()] ?? null;

const positiveInt = (v) => {
  const n = Number(String(v ?? '').trim());
  return Number.isInteger(n) && n > 0 ? n : null;
};

// The text of one tag inside an <anime> block, CDATA unwrapped. A regex over a
// machine-written export rather than DOMParser: the format is flat and fixed,
// and this keeps the parser testable under node, where there is no DOM.
function tagText(block, tag) {
  const m = block.match(new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`));
  return m ? (m[1] ?? m[2] ?? '').trim() : '';
}

/**
 * A MyAnimeList-format XML export → { entries: [{ malId, status }], unmatched }.
 *
 * MAL writes this from its export page, and so do several other trackers
 * (Kitsu, Simkl and others offer a "MAL export"), which is why a file upload
 * covers sites that have no usable API. `series_animedb_id` is a MAL id
 * whichever site wrote the file. An exporter that could not match a show to MAL
 * writes 0 there; those are counted rather than dropped silently, so the screen
 * can say how many shows it could not place.
 *
 * Throws on something that is not an export at all, because "imported zero
 * shows" is the wrong thing to tell someone who uploaded the wrong file.
 */
export function parseMalExport(xml, { statusIn = [COMPLETED] } = {}) {
  const text = String(xml ?? '');
  if (!/<myanimelist[\s>]/i.test(text)) {
    throw new Error('That file is not a MyAnimeList export (it has no <myanimelist> list in it).');
  }
  const want = new Set(statusIn);
  const entries = [];
  let unmatched = 0;
  for (const [, block] of text.matchAll(/<anime>([\s\S]*?)<\/anime>/g)) {
    const status = statusFrom('malExport', tagText(block, 'my_status'));
    if (!status || !want.has(status)) continue;
    const malId = positiveInt(tagText(block, 'series_animedb_id'));
    if (malId == null) { unmatched++; continue; }
    entries.push({ malId, status });
  }
  return { entries, unmatched };
}

/**
 * The MAL proxy's response → { entries: [{ malId, status }] }. The proxy
 * already strips MAL's payload to these two fields (see workers/mal-proxy); this
 * re-checks them, since a deploy of an older worker is a real possibility.
 */
export function mapMalProxy(json, { statusIn = [COMPLETED] } = {}) {
  const want = new Set(statusIn);
  const entries = [];
  for (const row of json?.entries ?? []) {
    const malId = positiveInt(row?.malId);
    const status = statusFrom('mal', row?.status);
    if (malId != null && status && want.has(status)) entries.push({ malId, status });
  }
  return { entries };
}

// Kitsu names the sites it maps to in `externalSite`. AniList first: an AniList
// id is the id we want, while a MAL id costs a second lookup and AniList's
// `idMal` is occasionally missing.
const KITSU_ANILIST = 'anilist/anime';
const KITSU_MAL = 'myanimelist/anime';

/**
 * One page of Kitsu's `library-entries?include=anime.mappings` (JSON:API) →
 * { entries: [{ anilistId?, malId?, status }], unmatched }.
 *
 * JSON:API puts the related records in a flat `included` array, so the anime
 * and its mappings are joined back by type and id here. An entry whose anime
 * carries neither mapping is unmatched — Kitsu has shows AniList does not.
 */
export function mapKitsuLibrary(json, { statusIn = [COMPLETED] } = {}) {
  const want = new Set(statusIn);
  const included = new Map();
  for (const rec of json?.included ?? []) included.set(`${rec?.type}:${rec?.id}`, rec);

  const entries = [];
  let unmatched = 0;
  for (const entry of json?.data ?? []) {
    const status = statusFrom('kitsu', entry?.attributes?.status);
    if (!status || !want.has(status)) continue;
    const animeRef = entry?.relationships?.anime?.data;
    const anime = animeRef ? included.get(`anime:${animeRef.id}`) : null;
    const ids = {};
    for (const ref of anime?.relationships?.mappings?.data ?? []) {
      const mapping = included.get(`mappings:${ref.id}`)?.attributes;
      const id = positiveInt(mapping?.externalId);
      if (id == null) continue;
      if (mapping.externalSite === KITSU_ANILIST && ids.anilistId == null) ids.anilistId = id;
      if (mapping.externalSite === KITSU_MAL && ids.malId == null) ids.malId = id;
    }
    if (ids.anilistId == null && ids.malId == null) { unmatched++; continue; }
    entries.push({ ...ids, status });
  }
  return { entries, unmatched };
}

/**
 * What someone typed into the Kitsu box → the slug to look up. Accepts a bare
 * slug or name, or a pasted profile URL (kitsu.app or the older kitsu.io),
 * because the URL is what people actually have to hand.
 */
export function kitsuSlugFrom(input) {
  const raw = String(input ?? '').trim();
  const m = raw.match(/kitsu\.(?:app|io)\/users\/([^/?#\s]+)/i);
  return (m ? decodeURIComponent(m[1]) : raw).replace(/^@/, '');
}

// ── which site a profile imports from ─────────────────────────────────────

export const LIST_SITE_IDS = ['anilist', 'mal', 'kitsu', 'file'];

/**
 * Where a profile's list comes from: { site, username }.
 *
 * `listSource` is new; `anilistUsername` is what every profile imported before
 * it carries, and it is read as an AniList source rather than migrated — the
 * aniguess_profiles rule: a stored key gets read for ever, never renamed.
 * Defaults to AniList with no username, which is what the screen showed before
 * there was a choice.
 */
export function listSourceOf(profile) {
  const saved = profile?.listSource;
  if (saved && LIST_SITE_IDS.includes(saved.site)) {
    return { site: saved.site, username: typeof saved.username === 'string' ? saved.username : '' };
  }
  return { site: 'anilist', username: profile?.anilistUsername ?? '' };
}
