// The pure half of the fact pack: what a fact IS, and how to look one up.
//
// A fact pack ships answers that no profile can derive. Every other game in this
// arcade computes its answer key on the device — `valueFor` reads a stored
// field, `trueOrder` sorts it, `scoreBoard` grades against it — but "who
// directed this" is not a function of anything a profile holds, so it has to
// arrive with the question. See shared/services/factPack.js for the loader and
// generateFacts.js for what writes one.
//
// Everything testable lives here rather than in the generator for the reason
// prefs.js and fame.js are separate files from the screens that read them: the
// vitest config only runs src/**/*.test.js, so logic in a root-level script is
// logic with no test.
// Explicit .js extensions, unlike the rest of the app: generateFacts.js imports
// this module under plain Node, which does not do Vite's extensionless
// resolution. franchise.js's own import of ./ranking.js carries one for the same
// reason. This is the price of the generator and the app sharing one definition
// of a key, and sharing it is the point.
import { franchiseTitleKey } from './franchise.js';
import { characterNameKey } from './character.js';

// A pack key is the SAME fold a saved profile keys on — franchiseTitleKey for
// shows and characterNameKey for characters, exactly what anirank/utils/deck.js
// computes when it collapses a profile into cards. That identity is the whole
// targeting design: "only shows this room imported" is a Set lookup at draw
// time and "any show at all" is skipping it, so no game has to be decided here
// and no data has to be regenerated to change the answer.
//
// They are re-exported through this module rather than imported directly by the
// generator so the two sides cannot drift on what a key is.
export const subjectKeyForShow = franchiseTitleKey;
export const subjectKeyForCharacter = characterNameKey;

// Fields that identify a subject rather than assert something about it. Never
// clue material, never validated as a fact, and `anilistId` in particular is
// PROVENANCE ONLY — identity in this repo is deliberately not id-based (the ids
// ListManager mints and AniList's own share no id space), so a lookup that went
// through it would miss every hand-entered entry.
export const META_FIELDS = new Set(['anilistId', 'title', 'name']);

// Widest plausible bounds for an anime air year. Deliberately constants rather
// than `new Date().getFullYear() + n`: a validator whose verdict depends on when
// it runs is a test that starts failing on a birthday.
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

const isFilledString = (v) => typeof v === 'string' && v.trim() !== '';
const isInt = (v) => typeof v === 'number' && Number.isInteger(v);

const str = () => isFilledString;
const strList = () => (v) => Array.isArray(v) && v.length > 0 && v.every(isFilledString);
const posInt = () => (v) => isInt(v) && v > 0;
const nonNegInt = () => (v) => isInt(v) && v >= 0;
const year = () => (v) => isInt(v) && v >= YEAR_MIN && v <= YEAR_MAX;
const oneOf = (allowed) => (v) => typeof v === 'string' && allowed.includes(v);
const percent = () => (v) => isInt(v) && v >= 1 && v <= 100;

export const THEME_TYPES = ['OP', 'ED'];
// A theme song is the one structured value in the pack: { type, song, artists? }.
// `artists` is optional because AnimeThemes has songs with no performer linked
// yet — such a song can still say which show it belongs to, it just cannot be
// asked about by who sings it.
const isTheme = (t) => Boolean(t) && typeof t === 'object'
  && THEME_TYPES.includes(t.type)
  && isFilledString(t.song)
  && (t.artists === undefined || strList()(t.artists));
const themeList = () => (v) => Array.isArray(v) && v.length > 0 && v.every(isTheme);

/**
 * The schema, and it is the schema the way DEFAULT_PREFS is one — not a
 * fallback. normalizePack drops any field that is not in here, so a source
 * adapter cannot introduce a field by typo and have it silently ship.
 *
 * `label` is how a future clue would name the dimension; nothing renders it
 * yet, and it lives here so the phrasing has one home when something does.
 */
export const FACT_FIELDS = {
  // ── shows ──────────────────────────────────────────────────────────────
  studio: { subject: 'show', label: 'Animation studio', validate: str() },
  producers: { subject: 'show', label: 'Producers', validate: strList() },
  director: { subject: 'show', label: 'Director', validate: str() },
  seriesComposition: { subject: 'show', label: 'Series composition', validate: str() },
  originalCreator: { subject: 'show', label: 'Original creator', validate: str() },
  composer: { subject: 'show', label: 'Composer', validate: str() },
  source: { subject: 'show', label: 'Source material', validate: str() },
  format: { subject: 'show', label: 'Format', validate: str() },
  season: { subject: 'show', label: 'Season', validate: oneOf(SEASONS) },
  seasonYear: { subject: 'show', label: 'Year', validate: year() },
  episodes: { subject: 'show', label: 'Episodes', validate: posInt() },
  duration: { subject: 'show', label: 'Episode length', validate: posInt() },
  genres: { subject: 'show', label: 'Genres', validate: strList() },
  tags: { subject: 'show', label: 'Tags', validate: strList() },
  // 1 = AniList's most popular anime, from the discovery list's own order. Not
  // clue material — AniQuiz reads it to price a clue, because "who animated
  // Death Note" and "who animated Kaiba" are not the same question. A catalog
  // show that sits outside the top N has no rank at all, and a reader must
  // treat that as "obscure", never as "unknown and therefore easy".
  popularityRank: { subject: 'show', label: 'Popularity rank', validate: posInt() },
  // The numbers a profile import also stores (see profileMerge.js STAT_KEYS),
  // carried here so a profile saved before those stats existed can be repaired
  // without a re-import — see packStats.js. Each is folded by the SAME rule
  // summarizeGroupStats uses at import time (popularity, score and favourites
  // from the canonical season; the year from the earliest), so a backfilled
  // value and an imported one mean the same thing. `episodes` above is NOT one
  // of them and is never backfilled: it is clue material for the canonical
  // season, while a profile's is summed across every season.
  popularity: { subject: 'show', label: 'AniList members', validate: nonNegInt() },
  averageScore: { subject: 'show', label: 'AniList score', validate: percent() },
  startYear: { subject: 'show', label: 'First aired', validate: year() },
  // Not `favourites`: FACT_FIELDS is keyed by field name across both subjects,
  // and that name already belongs to characters.
  showFavourites: { subject: 'show', label: 'AniList favourites', validate: nonNegInt() },

  // ── shows, from outside AniList (pack-v5) ──────────────────────────────
  // Openings and endings from AnimeThemes, across the franchise's seasons —
  // see outsideFacts.js for which ones and how many.
  themes: { subject: 'show', label: 'Theme songs', validate: themeList() },
  // The source work's facts, only ever for a work of the same KIND AniList calls
  // the source (a manga for MANGA, a light novel for LIGHT_NOVEL), so a clue
  // never says "the manga" about a novel. `serializedIn` is a manga's magazine
  // and `originalPublisher` that magazine's publisher, or a light novel's
  // imprint (Dengeki Bunko) — both from Wikidata, since AniList has neither.
  // `originalYear` is when the source began, from the source work's own AniList
  // entry (Wikidata's year is only a fallback; see factSources/wikidata.js). It
  // is often years before the anime, and a different question from `startYear`.
  serializedIn: { subject: 'show', label: 'Serialized in', validate: str() },
  originalPublisher: { subject: 'show', label: 'Original publisher', validate: str() },
  originalYear: { subject: 'show', label: 'Source began', validate: year() },

  // ── characters ─────────────────────────────────────────────────────────
  voiceActorJp: { subject: 'character', label: 'Japanese voice actor', validate: str() },
  gender: { subject: 'character', label: 'Gender', validate: str() },
  favourites: { subject: 'character', label: 'AniList favourites', validate: nonNegInt() },
  // Show subject keys, so a character row joins back to `shows` by the same
  // fold everything else uses.
  //
  // `appearsIn` means MAIN in, and has since v1 — both cast clues ask "which
  // show is X a main character in" and "name a main character from Y", so
  // widening it would make each of them state something false. A supporting
  // appearance is a separate field rather than a role flag on the character,
  // because the same person is main in one show and supporting in another
  // (a spin-off's lead is often a side character in the original).
  appearsIn: { subject: 'character', label: 'Main character in', validate: strList() },
  supportingIn: { subject: 'character', label: 'Supporting character in', validate: strList() },
};

// ── Staff credits ──────────────────────────────────────────────────────────
//
// AniList's staff `role` is free text, so a credit is found by matching, and
// the patterns live here rather than in the source adapter because a pattern is
// exactly the kind of logic that breaks silently: `/^director$/` shipped One
// Piece, Naruto Shippuden and Dragon Ball Z with no director at all, because a
// long-runner credits "Director (eps 1-199)".
//
// Each field is an ORDERED list, best first. pickCredit takes the first edge
// matching the best pattern any edge matches — so a plain "Director" still
// beats an earlier-listed "Director (eps 200-291)", and a qualified credit is
// only used when nothing unqualified exists. Within one pattern the edge order
// (AniList's RELEVANCE sort) decides, which is what "the director" means.
//
// Anchored on purpose. "Animation Director", "ADR Director", "Sound Director",
// "Episode Director" and "Director of Photography" are all real credits on the
// same list and none of them is the show's director.
export const STAFF_CREDITS = {
  director: [/^director$/i, /^director\s*\(.*\)$/i, /^chief\s+director$/i],
  seriesComposition: [/series\s*composition/i],
  originalCreator: [/original\s*(creator|story)/i],
  composer: [/^music$/i, /^music\s*\(.*\)$/i],
};

// Trimmed, because some roles arrive with trailing whitespace — Chainsaw Man
// credits its composer as "Music ", which an anchored pattern never matched.
const roleOf = (edge) => (typeof edge?.role === 'string' ? edge.role.trim() : '');

/**
 * The staff edge holding `field`'s credit, or null. `edges` are AniList staff
 * edges ({ role, node }) in the order they arrived.
 */
export function pickCredit(edges, field) {
  const patterns = STAFF_CREDITS[field];
  if (!patterns || !Array.isArray(edges)) return null;
  for (const pattern of patterns) {
    const hit = edges.find((e) => pattern.test(roleOf(e)));
    if (hit) return hit;
  }
  return null;
}

// 'show' -> the pack section it lives in, so callers never hardcode either.
export const SECTION_FOR = { show: 'shows', character: 'characters' };

/**
 * Checks one generated row before it is allowed into a pack.
 *
 * Returns { ok: true } or { ok: false, reason } — a reason rather than a bare
 * false because the generator writes rejects to a file for a human to read, and
 * "dropped 400 rows" with no reason is indistinguishable from a broken adapter.
 *
 * A row is { kind: 'show'|'character', key, field, value }.
 */
export function validateFact(row) {
  if (!row || typeof row !== 'object') return { ok: false, reason: 'not an object' };
  const { kind, key, field, value } = row;
  if (!SECTION_FOR[kind]) return { ok: false, reason: `unknown kind "${kind}"` };
  if (!isFilledString(key)) return { ok: false, reason: 'empty subject key' };

  const spec = FACT_FIELDS[field];
  if (!spec) return { ok: false, reason: `unknown field "${field}"` };
  if (spec.subject !== kind) {
    return { ok: false, reason: `field "${field}" belongs to ${spec.subject}, not ${kind}` };
  }
  if (value == null) return { ok: false, reason: `null value for "${field}"` };
  if (!spec.validate(value)) return { ok: false, reason: `invalid value for "${field}"` };
  return { ok: true };
}

function normalizeEntry(kind, key, raw) {
  if (!raw || typeof raw !== 'object') return null;
  const entry = {};
  for (const metaKey of META_FIELDS) {
    if (raw[metaKey] != null) entry[metaKey] = raw[metaKey];
  }
  let facts = 0;
  for (const [field, value] of Object.entries(raw)) {
    if (META_FIELDS.has(field)) continue;
    if (!validateFact({ kind, key, field, value }).ok) continue;
    entry[field] = value;
    facts++;
  }
  // An entry carrying nothing but its own name is not a subject anything can
  // ask a question about.
  return facts > 0 ? entry : null;
}

/**
 * Repairs a fetched pack at the single point it enters the app, the way every
 * room hook normalizes RTDB state before handing it to rules.js. A pack is a
 * static file that may have been generated by an older script, so unknown
 * fields, invalid values and missing sections are expected rather than
 * exceptional.
 */
export function normalizePack(raw) {
  const out = { version: Number(raw?.version) || 0, shows: {}, characters: {}, aliases: {} };

  for (const [section, kind] of [['shows', 'show'], ['characters', 'character']]) {
    const source = raw?.[section];
    if (!source || typeof source !== 'object') continue;
    for (const [rawKey, rawEntry] of Object.entries(source)) {
      const key = typeof rawKey === 'string' ? rawKey.trim() : '';
      if (!key) continue;
      const entry = normalizeEntry(kind, key, rawEntry);
      if (entry) out[section][key] = entry;
    }
  }

  // Aliases are validated LAST, against the shows that survived: an alias to a
  // show normalizePack just dropped would resolve a lookup to nothing, which is
  // worse than not resolving it — the caller would believe it had found the
  // canonical key. A key that is itself a show never aliases away from it.
  const aliases = raw?.aliases;
  if (aliases && typeof aliases === 'object') {
    for (const [rawFrom, to] of Object.entries(aliases)) {
      const from = rawFrom.trim();
      if (!from || typeof to !== 'string' || from === to) continue;
      if (out.shows[from] || !out.shows[to]) continue;
      out.aliases[from] = to;
    }
  }
  return out;
}

/** Maps for lookup. Built once per load, not per draw. */
export function indexPack(pack) {
  const normalized = normalizePack(pack);
  return {
    version: normalized.version,
    shows: new Map(Object.entries(normalized.shows)),
    characters: new Map(Object.entries(normalized.characters)),
    aliases: new Map(Object.entries(normalized.aliases)),
  };
}

/**
 * The pack key a folded show title actually lives under.
 *
 * The pack groups a franchise by AniList relations, the way an import does, and
 * keys it on its canonical season's title. A profile's title is usually that
 * same fold — but not always: a hand-entered "Re:Zero Season 2", or a player who
 * only owns the second season, folds to a member title instead. `aliases` maps
 * every member title's fold to the canonical key, so this is one Map lookup, and
 * a miss hands the key straight back (most of what a player imports is not in
 * the pack at all, and that is not an error).
 */
export function resolveShowKey(index, key) {
  if (typeof key !== 'string' || !key) return key;
  if (index?.shows?.has(key)) return key;
  return index?.aliases?.get(key) ?? key;
}

/**
 * The whole targeting story, in one function.
 *
 * Pass the subject keys a room's shared lists fold to and a clue can only be
 * about a show somebody imported; pass every key in the pack and it is global.
 * Neither is decided here, and neither needs a different pack.
 *
 * An EMPTY key list returns nothing, deliberately. Falling open to "all
 * subjects" is the bug that would silently turn shared-list mode into global
 * mode for exactly the rooms whose lists failed to load.
 */
export function factsFor(index, subjectKeys, kind = 'show') {
  const map = index?.[SECTION_FOR[kind]];
  if (!map || !subjectKeys) return [];
  const out = [];
  const seen = new Set();
  for (const key of subjectKeys) {
    if (typeof key !== 'string' || seen.has(key)) continue;
    seen.add(key);
    const entry = map.get(key);
    if (entry) out.push({ key, ...entry });
  }
  return out;
}

/** Every subject key the pack knows about — the global end of the filter. */
export function allSubjectKeys(index, kind = 'show') {
  const map = index?.[SECTION_FOR[kind]];
  return map ? [...map.keys()] : [];
}

/** How many real facts an entry carries, ignoring its identifying fields. */
export function factCount(entry) {
  if (!entry) return 0;
  return Object.keys(entry).filter((k) => !META_FIELDS.has(k) && k !== 'key').length;
}
