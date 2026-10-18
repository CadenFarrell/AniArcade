// Turns the fact pack into clues: what a question says, what it accepts, and
// how hard it is. Pure — no React, no network — so the whole of "is this clue
// fair" is testable, and so the online host and local play deal from one copy.
//
// The answer ships WITH the question (see shared/utils/facts.js for why this
// game needs a pack at all), so a clue carries everything grading needs:
// `accept` is a list of folded answers, and rules.js grades by membership in it
// without ever touching the pack. That is what lets a room grade on any device,
// including one that never loaded the pack.
//
// Clues run BOTH ways, and the two directions grade differently on purpose:
//
//   forward  "Which studio animated Mob Psycho 100?"   — one fact, one answer
//   reverse  "Bones animated this 2016 TV series."     — a description, and
//            more than one show can fit it
//
// A reverse clue's `accept` is therefore every show in the WHOLE pack that
// satisfies the clue as stated — not just the one it was written from, and not
// just the shows in play. A player who names a different Bones show from 2016
// has answered the question that was asked; marking them wrong because the
// generator happened to be thinking of another one is the game lying. The
// intended show is still what the reveal leads with, and the rest are listed
// under it (`alsoAccepted`) so the table can see why a different answer scored.
import { subjectKeyForShow, subjectKeyForCharacter, resolveShowKey } from '../../shared/utils/facts';
import { shuffle } from '../../shared/utils/random';

export const ROWS = 5;
// Board rows, top to bottom. Row 0 is the easiest band of its column.
export const BOARD_VALUES = [200, 400, 600, 800, 1000];
// A quiz question is priced by its own difficulty rather than by a row, since a
// quiz has no rows — see quizValue.
export const QUIZ_VALUES = [100, 200, 300, 400, 500];
export const CHOICES = 4;
// A reverse clue whose description fits more shows than this is not a clue,
// it is a category. Dropped rather than shipped.
const MAX_ACCEPT = 12;

// ── Folding ────────────────────────────────────────────────────────────────
//
// One fold per answer kind. Shows and characters reuse the folds a saved
// profile keys on, so a title picked from the typeahead and a title typed by
// hand grade identically. People and studios get a looser fold: punctuation
// goes, and word order stops mattering, because AniList itself is inconsistent
// about given-name-first and "Shinkai Makoto" is not a wrong answer.
const foldName = (s) => String(s ?? '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .split(' ')
  .filter(Boolean)
  .sort()
  .join(' ');

const foldNumber = (s) => {
  const digits = String(s ?? '').replace(/[^\d]/g, '');
  return digits ? String(Number(digits)) : '';
};

export const FOLDS = {
  show: (s) => subjectKeyForShow(String(s ?? '')),
  character: (s) => subjectKeyForCharacter(String(s ?? '')),
  name: foldName,
  number: foldNumber,
};

export function foldAnswer(kind, text) {
  const fold = FOLDS[kind] ?? foldName;
  return fold(text);
}

// ── Labels ─────────────────────────────────────────────────────────────────

// OTHER, and anything AniList adds later, is deliberately absent: a source the
// game cannot name is a source it cannot ask about.
export const SOURCE_LABELS = {
  MANGA: 'Manga',
  LIGHT_NOVEL: 'Light novel',
  ORIGINAL: 'Original (no source)',
  VISUAL_NOVEL: 'Visual novel',
  VIDEO_GAME: 'Video game',
};

export const SEASON_LABELS = { WINTER: 'Winter', SPRING: 'Spring', SUMMER: 'Summer', FALL: 'Fall' };

const FORMAT_NOUNS = {
  TV: 'TV series',
  TV_SHORT: 'short series',
  MOVIE: 'film',
  ONA: 'web series',
  OVA: 'OVA',
  SPECIAL: 'special',
};
const formatNoun = (f) => FORMAT_NOUNS[f] ?? 'show';

const quote = (title) => `“${title}”`;

// ── Theme songs ────────────────────────────────────────────────────────────
//
// A show's `themes` (pack-v5, from AnimeThemes) run openings first, canonical
// season first — see shared/utils/outsideFacts.js. Each clue shape picks ONE of
// them, so a show is never asked about twice in one column.
const themesOf = (s) => (Array.isArray(s.themes) ? s.themes : []);
const themeKind = (t) => (t.type === 'OP' ? 'an opening' : 'an ending');

// "LiSA", "FictionJunction & LiSA", "A, B & C" — the reveal's spelling. Grading
// never reads it: the accept list holds every performer's fold as well.
function artistList(artists) {
  if (artists.length <= 1) return artists[0] ?? '';
  return `${artists.slice(0, -1).join(', ')} & ${artists[artists.length - 1]}`;
}

// The theme a "name the show" clue quotes: the first opening, which is the
// famous one far more often than not.
const leadTheme = (s) => themesOf(s).find((t) => t.type === 'OP') ?? themesOf(s)[0] ?? null;

// The theme a "who performs it" clue asks about. A single performer first: a
// "FictionJunction & LiSA" option among three solo names is a tell in multiple
// choice, whichever one the player knows.
function soloTheme(s) {
  const credited = themesOf(s).filter((t) => t.artists?.length);
  return credited.find((t) => t.type === 'OP' && t.artists.length === 1)
    ?? credited.find((t) => t.artists.length === 1)
    ?? credited[0]
    ?? null;
}

// The theme an "X performed a theme for this show" clue names. Openings first.
const creditedTheme = (s) =>
  themesOf(s).find((t) => t.type === 'OP' && t.artists?.length) ?? themesOf(s).find((t) => t.artists?.length) ?? null;

// The source work's start year is only trusted when it is not AFTER the anime
// premiered — a later date means Wikidata's publication date is some reprint or
// translation, and a clue answered from it would be wrong.
const sourceYearOf = (s) => {
  if (!Number.isInteger(s.originalYear)) return null;
  const aired = Number.isInteger(s.startYear) ? s.startYear : s.seasonYear;
  return Number.isInteger(aired) && s.originalYear > aired ? null : s.originalYear;
};

// ── Difficulty ─────────────────────────────────────────────────────────────
//
// A clue's difficulty is two things blended: how obscure its subject is, and
// how hard its field is. Neither alone works. Field alone makes every studio
// clue cost the same, and "who animated Death Note" is not "who animated
// Kaiba". Obscurity alone makes the composer of the most popular show in the
// pack a 200-point clue, which nobody at the table will think it is.
//
// Obscurity is a percentile WITHIN THE POOL IN PLAY, not an absolute rank. A
// table playing its shared list of twelve shows still needs a spread from 200
// to 1000, and an absolute scale would put all twelve in the cheap rows.
const OBSCURITY_WEIGHT = 0.55;

// 0 = anyone who has seen the show knows it; 1 = credits trivia.
const FIELD_WEIGHT = {
  source: 0.05,
  appearsIn: 0.1,
  mainCast: 0.2,
  studio: 0.25,
  seasonYear: 0.25,
  // A franchise's own opening is the one piece of credits trivia most fans can
  // hum, so naming the show from it sits with the cast clues, not the staff.
  themeShow: 0.3,
  season: 0.45,
  originalCreator: 0.45,
  studioYear: 0.45,
  director: 0.55,
  creatorReverse: 0.55,
  magazine: 0.55,
  themeArtist: 0.55,
  episodes: 0.6,
  artistReverse: 0.6,
  magazineReverse: 0.6,
  directorReverse: 0.65,
  originalPublisher: 0.65,
  composer: 0.7,
  originalYear: 0.7,
  voiceActor: 0.7,
  voiceActorReverse: 0.75,
  composerReverse: 0.8,
  seriesComposition: 0.85,
};

const blend = (obscurity, field) =>
  Math.min(1, Math.max(0, OBSCURITY_WEIGHT * obscurity + (1 - OBSCURITY_WEIGHT) * FIELD_WEIGHT[field]));

// Rank → 0..1 within the list handed in, best-known first. Ties share a value.
// An entry with no measure sorts last: an unranked show is one that never made
// the popularity list, which is evidence of obscurity, not an absence of it.
function percentiles(keys, measure) {
  const sorted = [...keys].sort((a, b) => {
    const ma = measure(a);
    const mb = measure(b);
    if (ma == null && mb == null) return 0;
    if (ma == null) return 1;
    if (mb == null) return -1;
    return ma - mb;
  });
  const out = new Map();
  const last = Math.max(1, sorted.length - 1);
  sorted.forEach((k, i) => out.set(k, i / last));
  return out;
}

// ── Context ────────────────────────────────────────────────────────────────

/**
 * Everything a builder needs, computed once per deal.
 *
 * `showKeys` is the targeting decision, already made by the caller (see
 * utils/pool.js) — every subject a clue may be ABOUT. The whole pack is still
 * consulted for what a clue may ACCEPT and for distractors, because neither of
 * those is a statement about what the table has watched.
 */
export function buildContext(index, showKeys) {
  const packShows = index?.shows ?? new Map();
  const packChars = index?.characters ?? new Map();

  // Through the aliases: a profile whose title is a later season's ("Re:Zero
  // Season 2") still lands on the franchise the pack keys on.
  const inPlay = new Set();
  for (const raw of showKeys ?? []) {
    const key = resolveShowKey(index, raw);
    if (packShows.has(key)) inPlay.add(key);
  }
  const shows = [...inPlay].map((key) => ({ key, ...packShows.get(key) }));

  // A character is in play when any show they appear in is. Shared-list mode
  // therefore needs no character list at all — which matters, because a
  // profile's characters are a curated subset and nobody's list is the cast.
  const characters = [];
  for (const [key, entry] of packChars) {
    if (GENERIC_NAME.test(entry.name ?? '')) continue;
    // A lead's home is a show they lead; a supporting character's, any show
    // they are in. Leads first, so the voice clue names the show they front.
    const home = (entry.appearsIn ?? []).find((s) => inPlay.has(s))
      ?? (entry.supportingIn ?? []).find((s) => inPlay.has(s));
    if (home) characters.push({ key, home, ...entry });
  }

  const showObscurity = percentiles(inPlay, (k) => packShows.get(k)?.popularityRank ?? null);
  // Favourites run the other way — more is better-known — so negate.
  const charObscurity = percentiles(
    characters.map((c) => c.key),
    (k) => {
      const fav = packChars.get(k)?.favourites;
      return fav == null ? null : -fav;
    },
  );

  return {
    index, packShows, packChars, shows, characters, showObscurity, charObscurity,
    ...lookups(index),
    domains: new Map(),
  };
}

// AniList lists some casts with a role rather than a person in it. "Narrator"
// is not an answer anybody can be expected to give, nor a fair wrong option.
const GENERIC_NAME = /^(narrator|unknown|\?+)$/i;

// The reverse clues ask "which shows fit this description", once per subject.
// Scanning the pack for each one is quadratic — a whole-pack deal took twenty
// seconds that way — so the descriptions are bucketed once per pack instead.
// Memoized on the index object, which loadFactPack builds once per session.
const LOOKUPS = new WeakMap();

function lookups(index) {
  if (index && LOOKUPS.has(index)) return LOOKUPS.get(index);
  const shows = index?.shows ?? new Map();
  const chars = index?.characters ?? new Map();
  const bucket = (map, k, v) => {
    if (!k) return;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(v);
  };

  const byStudioYear = new Map();
  const byDirectorStudio = new Map();
  const byComposerYear = new Map();
  const byCreator = new Map();
  // Theme songs, by song (each row carrying the performers, which the clue
  // filters on) and by `type|performer` (one row per show however many themes
  // that performer sang for it).
  const byThemeSong = new Map();
  const byThemeArtist = new Map();
  const byMagazineYear = new Map();
  let maxYear = 0;
  for (const [key, s] of shows) {
    const row = { key, title: s.title };
    const studio = s.studio && foldName(s.studio);
    if (studio && Number.isInteger(s.seasonYear)) bucket(byStudioYear, `${studio}|${s.seasonYear}`, row);
    if (studio && s.director) bucket(byDirectorStudio, `${foldName(s.director)}|${studio}`, row);
    if (s.composer && Number.isInteger(s.seasonYear)) bucket(byComposerYear, `${foldName(s.composer)}|${s.seasonYear}`, row);
    if (s.originalCreator) bucket(byCreator, foldName(s.originalCreator), row);
    if (Number.isInteger(s.seasonYear)) maxYear = Math.max(maxYear, s.seasonYear);

    const sungFor = new Set();
    for (const t of themesOf(s)) {
      const artists = new Set((t.artists ?? []).map(foldName));
      bucket(byThemeSong, foldName(t.song), { ...row, type: t.type, artists });
      for (const a of artists) {
        const k = `${t.type}|${a}`;
        if (!sungFor.has(k)) { sungFor.add(k); bucket(byThemeArtist, k, row); }
      }
    }
    const sourceYear = sourceYearOf(s);
    if (s.source === 'MANGA' && s.serializedIn && sourceYear) {
      bucket(byMagazineYear, `${foldName(s.serializedIn)}|${sourceYear}`, row);
    }
  }

  const castByShow = new Map();
  for (const [key, c] of chars) {
    if (GENERIC_NAME.test(c.name ?? '')) continue;
    const row = { key, name: c.name, favourites: c.favourites ?? 0, va: c.voiceActorJp ? foldName(c.voiceActorJp) : '' };
    for (const showKey of c.appearsIn ?? []) bucket(castByShow, showKey, row);
  }

  const out = {
    byStudioYear, byDirectorStudio, byComposerYear, byCreator, byThemeSong, byThemeArtist, byMagazineYear,
    castByShow, maxYear,
  };
  if (index) LOOKUPS.set(index, out);
  return out;
}

/**
 * What the setup screens report: how much of the table's pool the pack covers.
 *
 * `topics` lists EVERY topic, each marked `enabled` per the table's switches,
 * because the settings card shows a count beside the switched-off ones too — a
 * player deciding whether to turn Theme Songs back on wants to know it has
 * clues. The totals (`playableTopics`, `clues`) count only enabled ones, since
 * they are what Start gates on.
 *
 * A topic's count is SUBJECTS, not candidates: a column takes one clue per
 * show, so a show that could be asked about three ways is still one row.
 */
export function poolSummary(index, showKeys, topicsOff = []) {
  const ctx = buildContext(index, showKeys);
  const on = new Set(enabledTopics(topicsOff).map((t) => t.id));
  const topics = TOPICS.map((t) => ({
    id: t.id,
    title: t.title,
    blurb: t.blurb,
    enabled: on.has(t.id),
    clues: new Set(candidatesFor(ctx, t).map((c) => c.subject)).size,
  }));
  const live = topics.filter((t) => t.enabled);
  return {
    requested: new Set(showKeys ?? []).size,
    shows: ctx.shows.length,
    characters: ctx.characters.length,
    topics,
    playableTopics: live.filter((t) => t.clues >= ROWS).length,
    clues: live.reduce((n, t) => n + t.clues, 0),
  };
}

// ── Domains ────────────────────────────────────────────────────────────────
//
// The set of plausible answers for a clue: where multiple-choice distractors
// come from and what the typed answer box suggests. Named by id on the clue
// rather than carried on it, because a typeahead over every studio in the pack
// is far too big to ride along in room state — every device rebuilds it from
// its own copy of the pack.

const STAFF_FIELDS = ['director', 'composer', 'originalCreator', 'seriesComposition'];

export function domainValues(index, domain) {
  const shows = index?.shows ?? new Map();
  const chars = index?.characters ?? new Map();
  const seen = new Map();
  const add = (v) => { if (typeof v === 'string' && v.trim() && !seen.has(foldName(v))) seen.set(foldName(v), v); };

  switch (domain) {
    case 'studio':
      for (const s of shows.values()) add(s.studio);
      break;
    case 'staff':
      for (const s of shows.values()) for (const f of STAFF_FIELDS) add(s[f]);
      break;
    case 'voiceActor':
      for (const c of chars.values()) add(c.voiceActorJp);
      break;
    case 'show':
      for (const s of shows.values()) add(s.title);
      break;
    case 'character':
      for (const c of chars.values()) add(c.name);
      break;
    case 'artist':
      for (const s of shows.values()) for (const t of themesOf(s)) for (const a of t.artists ?? []) add(a);
      break;
    case 'magazine':
      for (const s of shows.values()) add(s.serializedIn);
      break;
    // Two domains over one field, split by what the source IS: a manga's
    // publisher is a company (Shueisha) and a light novel's is an imprint
    // (Dengeki Bunko), and one mixed list would let a player rule out every
    // option of the wrong kind without knowing the answer.
    case 'publisher':
      for (const s of shows.values()) if (s.source === 'MANGA') add(s.originalPublisher);
      break;
    case 'imprint':
      for (const s of shows.values()) if (s.source === 'LIGHT_NOVEL') add(s.originalPublisher);
      break;
    case 'source':
      return Object.values(SOURCE_LABELS);
    case 'season':
      return Object.values(SEASON_LABELS);
    default:
      return [];
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

// ── Builders ───────────────────────────────────────────────────────────────
//
// One per clue shape. Each takes the context and one subject and returns a
// clue or null — null whenever the subject lacks what the clue needs, which is
// routine (a film has no series composition, an unranked show no rank)
// rather than an error.

// A reverse clue whose answer is a show. `matches` is every pack show that fits
// the description; the subject leads, the rest are "also accepted".
function showAnswer(ctx, subject, matches) {
  if (!matches.length || matches.length > MAX_ACCEPT) return null;
  const rest = matches.filter((m) => m.key !== subject.key);
  return {
    answer: subject.title,
    kind: 'show',
    accept: [subject.key, ...rest.map((m) => m.key)],
    alsoAccepted: rest.map((m) => m.title),
    domain: 'show',
  };
}

const fwdShowFact = (field, topic, prompt, domain = 'staff') => (ctx, s) => {
  const value = s[field];
  if (typeof value !== 'string' || !value.trim()) return null;
  return {
    id: `${field}:${s.key}`,
    topic,
    field,
    subject: s.key,
    prompt: prompt(s),
    answer: value,
    kind: 'name',
    accept: [foldName(value)],
    domain,
    difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, field),
  };
};

const BUILDERS = {
  studio: fwdShowFact('studio', 'studios', (s) => `Which studio animated ${quote(s.title)}?`, 'studio'),
  director: fwdShowFact('director', 'staff', (s) => `Who directed ${quote(s.title)}?`),
  seriesComposition: fwdShowFact(
    'seriesComposition', 'staff', (s) => `Who handled series composition on ${quote(s.title)}?`,
  ),
  composer: fwdShowFact('composer', 'music', (s) => `Who composed the music for ${quote(s.title)}?`),

  originalCreator: (ctx, s) => {
    const label = SOURCE_LABELS[s.source];
    if (!label || s.source === 'ORIGINAL') {
      return fwdShowFact('originalCreator', 'origins',
        (x) => `${quote(x.title)} is an original. Who is credited as its creator?`)(ctx, s);
    }
    return fwdShowFact('originalCreator', 'origins',
      (x) => `Who created the ${label.toLowerCase()} ${quote(x.title)} is adapted from?`)(ctx, s);
  },

  source: (ctx, s) => {
    const label = SOURCE_LABELS[s.source];
    if (!label) return null;
    return {
      id: `source:${s.key}`,
      topic: 'origins',
      field: 'source',
      subject: s.key,
      prompt: `What is ${quote(s.title)} adapted from?`,
      answer: label,
      kind: 'name',
      accept: [foldName(label)],
      domain: 'source',
      difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'source'),
    };
  },

  seasonYear: (ctx, s) => {
    if (!Number.isInteger(s.seasonYear)) return null;
    return {
      id: `seasonYear:${s.key}`,
      topic: 'calendar',
      field: 'seasonYear',
      subject: s.key,
      prompt: `What year did ${quote(s.title)} premiere?`,
      answer: String(s.seasonYear),
      kind: 'number',
      accept: [String(s.seasonYear)],
      domain: null,
      difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'seasonYear'),
    };
  },

  // The year is GIVEN, so this asks for the season alone. Asking for both at
  // once makes a near-miss ("Fall 2015" for "Fall 2016") worth exactly what a
  // wild guess is.
  season: (ctx, s) => {
    const label = SEASON_LABELS[s.season];
    if (!label || !Number.isInteger(s.seasonYear)) return null;
    return {
      id: `season:${s.key}`,
      topic: 'calendar',
      field: 'season',
      subject: s.key,
      prompt: `${quote(s.title)} premiered in ${s.seasonYear}. In which season?`,
      answer: label,
      kind: 'name',
      accept: [foldName(label)],
      domain: 'season',
      difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'season'),
    };
  },

  // TV only, and only past a single episode. A film's "episode count" is a
  // trick question, and the franchise fold means a long-runner's count is its
  // canonical season's — so the prompt names that season's title, never the
  // franchise's.
  episodes: (ctx, s) => {
    if (s.format !== 'TV' || !Number.isInteger(s.episodes) || s.episodes < 2) return null;
    return {
      id: `episodes:${s.key}`,
      topic: 'calendar',
      field: 'episodes',
      subject: s.key,
      prompt: `How many episodes did ${quote(s.title)} run for?`,
      answer: String(s.episodes),
      kind: 'number',
      accept: [String(s.episodes)],
      domain: null,
      difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'episodes'),
    };
  },

  // ── reverse: the answer is a show ──
  studioYear: (ctx, s) => {
    if (!s.studio || !Number.isInteger(s.seasonYear)) return null;
    const matches = ctx.byStudioYear.get(`${foldName(s.studio)}|${s.seasonYear}`) ?? [];
    const answer = showAnswer(ctx, s, matches);
    if (!answer) return null;
    return {
      id: `studioYear:${s.key}`,
      topic: 'studios',
      field: 'studioYear',
      subject: s.key,
      prompt: `${s.studio} animated this ${s.seasonYear} ${formatNoun(s.format)}. Name it.`,
      ...answer,
      difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'studioYear'),
    };
  },

  directorReverse: (ctx, s) => {
    if (!s.director || !s.studio) return null;
    const matches = ctx.byDirectorStudio.get(`${foldName(s.director)}|${foldName(s.studio)}`) ?? [];
    const answer = showAnswer(ctx, s, matches);
    if (!answer) return null;
    return {
      id: `directorReverse:${s.key}`,
      topic: 'staff',
      field: 'directorReverse',
      subject: s.key,
      prompt: `${s.director} directed this ${formatNoun(s.format)} at ${s.studio}. Name it.`,
      ...answer,
      difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'directorReverse'),
    };
  },

  composerReverse: (ctx, s) => {
    if (!s.composer || !Number.isInteger(s.seasonYear)) return null;
    const matches = ctx.byComposerYear.get(`${foldName(s.composer)}|${s.seasonYear}`) ?? [];
    const answer = showAnswer(ctx, s, matches);
    if (!answer) return null;
    return {
      id: `composerReverse:${s.key}`,
      topic: 'music',
      field: 'composerReverse',
      subject: s.key,
      prompt: `${s.composer} scored this ${s.seasonYear} ${formatNoun(s.format)}. Name it.`,
      ...answer,
      difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'composerReverse'),
    };
  },

  creatorReverse: (ctx, s) => {
    const label = SOURCE_LABELS[s.source];
    if (!s.originalCreator || !label || s.source === 'ORIGINAL') return null;
    const matches = ctx.byCreator.get(foldName(s.originalCreator)) ?? [];
    const answer = showAnswer(ctx, s, matches);
    if (!answer) return null;
    return {
      id: `creatorReverse:${s.key}`,
      topic: 'origins',
      field: 'creatorReverse',
      subject: s.key,
      prompt: `This ${formatNoun(s.format)} adapts a ${label.toLowerCase()} by ${s.originalCreator}. Name it.`,
      ...answer,
      difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'creatorReverse'),
    };
  },

  // ── the source work (pack-v5, from Wikidata) ──
  // Every one of these is gated on AniList's `source` as well as the field: the
  // generator only attaches a work of the kind AniList names, and the prompt
  // says that kind out loud.
  magazine: (ctx, s) => {
    if (s.source !== 'MANGA' || !s.serializedIn) return null;
    return {
      id: `magazine:${s.key}`,
      topic: 'origins',
      field: 'magazine',
      subject: s.key,
      // "Where", not "which magazine": a fair share of the answers are web
      // serializations — Shōnen Jump+, Magazine Pocket, Pixiv — and calling a
      // website a magazine makes the right answer look like a trick option.
      prompt: `Where was the manga behind ${quote(s.title)} serialized?`,
      answer: s.serializedIn,
      kind: 'name',
      accept: [foldName(s.serializedIn)],
      domain: 'magazine',
      difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'magazine'),
    };
  },

  originalPublisher: (ctx, s) => {
    if (!s.originalPublisher || (s.source !== 'MANGA' && s.source !== 'LIGHT_NOVEL')) return null;
    const manga = s.source === 'MANGA';
    return {
      id: `originalPublisher:${s.key}`,
      topic: 'origins',
      field: 'originalPublisher',
      subject: s.key,
      // "Imprint" for a light novel, because that is what the answer is —
      // Dengeki Bunko is a label of Kadokawa's, and calling it the publisher
      // would invite a player to type Kadokawa and be marked wrong.
      prompt: manga
        ? `Which publisher released the manga behind ${quote(s.title)}?`
        : `Which imprint published the light novel behind ${quote(s.title)}?`,
      answer: s.originalPublisher,
      kind: 'name',
      accept: [foldName(s.originalPublisher)],
      domain: manga ? 'publisher' : 'imprint',
      difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'originalPublisher'),
    };
  },

  originalYear: (ctx, s) => {
    const label = SOURCE_LABELS[s.source];
    const year = sourceYearOf(s);
    if (!year || (s.source !== 'MANGA' && s.source !== 'LIGHT_NOVEL')) return null;
    return {
      id: `originalYear:${s.key}`,
      topic: 'origins',
      field: 'originalYear',
      subject: s.key,
      prompt: `What year did the ${label.toLowerCase()} behind ${quote(s.title)} start?`,
      answer: String(year),
      kind: 'number',
      accept: [String(year)],
      domain: null,
      difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'originalYear'),
    };
  },

  magazineReverse: (ctx, s) => {
    const year = sourceYearOf(s);
    if (s.source !== 'MANGA' || !s.serializedIn || !year) return null;
    const matches = ctx.byMagazineYear.get(`${foldName(s.serializedIn)}|${year}`) ?? [];
    const answer = showAnswer(ctx, s, matches);
    if (!answer) return null;
    return {
      id: `magazineReverse:${s.key}`,
      topic: 'origins',
      field: 'magazineReverse',
      subject: s.key,
      prompt: `This ${formatNoun(s.format)} adapts a manga first serialized in ${s.serializedIn} in ${year}. Name it.`,
      ...answer,
      difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'magazineReverse'),
    };
  },

  // ── theme songs (pack-v5, from AnimeThemes) ──
  // Text only, deliberately: playing the song is AniTune's whole game.
  //
  // The answer is a show, and every pack show whose theme of the SAME kind has
  // this title counts — filtered to the same performer when the clue names one,
  // because "Believe" is more than one song. A matching theme with no performer
  // on record is accepted rather than ruled out: it may well be the same song,
  // and marking a right answer wrong is the one thing a reverse clue must not do.
  themeShow: (ctx, s) => {
    const t = leadTheme(s);
    if (!t) return null;
    const named = new Set((t.artists ?? []).map(foldName));
    const seen = new Set();
    const matches = (ctx.byThemeSong.get(foldName(t.song)) ?? []).filter((m) => {
      if (m.type !== t.type || seen.has(m.key)) return false;
      if (named.size && m.artists.size && ![...m.artists].some((a) => named.has(a))) return false;
      seen.add(m.key);
      return true;
    });
    const answer = showAnswer(ctx, s, matches);
    if (!answer) return null;
    const by = t.artists?.length ? ` by ${artistList(t.artists)}` : '';
    return {
      id: `themeShow:${s.key}`,
      topic: 'themes',
      field: 'themeShow',
      subject: s.key,
      prompt: `${quote(t.song)}${by} is ${themeKind(t)} theme of which show?`,
      ...answer,
      difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'themeShow'),
    };
  },

  // Any one of a song's performers is a right answer, and so is the full
  // credit as the reveal spells it.
  themeArtist: (ctx, s) => {
    const t = soloTheme(s);
    if (!t) return null;
    const answer = artistList(t.artists);
    return {
      id: `themeArtist:${s.key}`,
      topic: 'themes',
      field: 'themeArtist',
      subject: s.key,
      prompt: `Who performs ${quote(t.song)}, ${themeKind(t)} theme of ${quote(s.title)}?`,
      answer,
      kind: 'name',
      accept: [...new Set([foldName(answer), ...t.artists.map(foldName)])],
      domain: 'artist',
      difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'themeArtist'),
    };
  },

  artistReverse: (ctx, s) => {
    const t = creditedTheme(s);
    if (!t) return null;
    const artist = t.artists[0];
    const matches = ctx.byThemeArtist.get(`${t.type}|${foldName(artist)}`) ?? [];
    const answer = showAnswer(ctx, s, matches);
    if (!answer) return null;
    return {
      id: `artistReverse:${s.key}`,
      topic: 'themes',
      field: 'artistReverse',
      subject: s.key,
      prompt: `${artist} performed ${themeKind(t)} theme for this ${formatNoun(s.format)}. Name it.`,
      ...answer,
      difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'artistReverse'),
    };
  },
};

// ── character clues ──
const CHARACTER_BUILDERS = {
  voiceActor: (ctx, c) => {
    if (!c.voiceActorJp) return null;
    const show = ctx.packShows.get(c.home);
    return {
      id: `voiceActor:${c.key}`,
      topic: 'voices',
      field: 'voiceActor',
      subject: c.key,
      prompt: `Who voices ${c.name} from ${quote(show?.title ?? c.home)} in Japanese?`,
      answer: c.voiceActorJp,
      kind: 'name',
      accept: [foldName(c.voiceActorJp)],
      domain: 'voiceActor',
      difficulty: blend(ctx.charObscurity.get(c.key) ?? 1, 'voiceActor'),
    };
  },

  // The answer is a character, and any main character of that show voiced by
  // that actor counts — one actor voicing two leads in one show happens.
  voiceActorReverse: (ctx, c) => {
    if (!c.voiceActorJp) return null;
    // The prompt says "which main character", and castByShow holds only leads,
    // so a supporting character can be neither the answer nor fairly asked.
    if (!(c.appearsIn ?? []).includes(c.home)) return null;
    const show = ctx.packShows.get(c.home);
    const va = foldName(c.voiceActorJp);
    const matches = (ctx.castByShow.get(c.home) ?? []).filter((x) => x.va === va);
    if (!matches.length) return null;
    const rest = matches.filter((m) => m.key !== c.key);
    return {
      id: `voiceActorReverse:${c.key}`,
      topic: 'voices',
      field: 'voiceActorReverse',
      subject: c.key,
      prompt: `${c.voiceActorJp} voices which main character in ${quote(show?.title ?? c.home)}?`,
      answer: c.name,
      kind: 'character',
      accept: [c.key, ...rest.map((m) => m.key)],
      alsoAccepted: rest.map((m) => m.name),
      domain: 'character',
      difficulty: blend(ctx.charObscurity.get(c.key) ?? 1, 'voiceActorReverse'),
    };
  },

  // Asked two ways, because the pack holds two kinds of cast (see facts.js's
  // `appearsIn`). A lead gets "a main character in", accepting only the shows
  // they lead. Someone who is supporting everywhere gets the weaker "from",
  // which accepts every show they are in at all — asking Levi which show he is
  // "a main character in" would state something false, and the true version of
  // the question is still a fair one.
  appearsIn: (ctx, c) => {
    const known = (keys) => (keys ?? []).filter((k) => ctx.packShows.has(k));
    const mainHomes = known(c.appearsIn);
    const homes = mainHomes.length ? mainHomes : known(c.supportingIn);
    if (!homes.length) return null;
    const lead = homes.includes(c.home) ? c.home : homes[0];
    const rest = homes.filter((k) => k !== lead);
    return {
      id: `appearsIn:${c.key}`,
      topic: 'cast',
      field: 'appearsIn',
      subject: c.key,
      prompt: mainHomes.length
        ? `Which show is ${c.name} a main character in?`
        : `Which show is ${c.name} from?`,
      answer: ctx.packShows.get(lead).title,
      kind: 'show',
      accept: [lead, ...rest],
      alsoAccepted: rest.map((k) => ctx.packShows.get(k).title),
      domain: 'show',
      difficulty: blend(ctx.charObscurity.get(c.key) ?? 1, 'appearsIn'),
    };
  },
};

// Built per show rather than per character: "name a main character" is a
// question about the show, so its subject — and its obscurity — is the show.
function mainCast(ctx, s) {
  const cast = [...(ctx.castByShow.get(s.key) ?? [])];
  if (!cast.length) return null;
  // The best-known lead is the one the reveal names; every other main
  // character scores just as well.
  cast.sort((a, b) => b.favourites - a.favourites);
  const [lead, ...rest] = cast;
  return {
    id: `mainCast:${s.key}`,
    topic: 'cast',
    field: 'mainCast',
    subject: s.key,
    prompt: `Name a main character from ${quote(s.title)}.`,
    answer: lead.name,
    kind: 'character',
    accept: cast.map((c) => c.key),
    alsoAccepted: rest.map((c) => c.name),
    domain: 'character',
    difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'mainCast'),
  };
}

// ── Topics ─────────────────────────────────────────────────────────────────
//
// A topic is a board column. Most mix two or three clue shapes, which is where
// "field" earns its half of the difficulty: inside one column the cheap rows
// fill with the easy shape on famous shows and the expensive ones with the hard
// shape on obscure ones.
//
// `blurb` is what the settings card's on/off list says a topic covers, since
// a title like "The Director's Chair" is a board heading, not a description.
export const TOPICS = [
  { id: 'studios', title: 'Studio Credits', blurb: 'Which studio animated it', show: ['studio', 'studioYear'] },
  {
    id: 'staff',
    title: 'The Director’s Chair',
    blurb: 'Directors and series writers',
    show: ['director', 'seriesComposition', 'directorReverse'],
  },
  { id: 'music', title: 'Who Scored It?', blurb: 'Soundtrack composers', show: ['composer', 'composerReverse'] },
  {
    id: 'origins',
    title: 'Source Material',
    blurb: 'Original creators, magazines and publishers',
    show: ['source', 'originalCreator', 'creatorReverse', 'magazine', 'originalPublisher', 'originalYear', 'magazineReverse'],
  },
  {
    id: 'themes',
    title: 'Theme Songs',
    blurb: 'Openings, endings and who sings them',
    show: ['themeShow', 'themeArtist', 'artistReverse'],
  },
  { id: 'calendar', title: 'Air Dates', blurb: 'Premiere years, seasons and episode counts', show: ['seasonYear', 'season', 'episodes'] },
  { id: 'voices', title: 'Voice Cast', blurb: 'Japanese voice actors', character: ['voiceActor', 'voiceActorReverse'] },
  { id: 'cast', title: 'Who’s Who', blurb: 'Main characters and their shows', show: ['mainCast'], character: ['appearsIn'] },
];

const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));
export const topicTitle = (id) => TOPIC_BY_ID.get(id)?.title ?? 'Trivia';

/**
 * The topics a table has left switched on, from the ids it switched OFF.
 *
 * Stored as the off list (prefs' `topicsOff`) rather than the on list, so a
 * topic added in a later build is on for everybody — including every player
 * whose saved prefs predate it — instead of silently missing from every board
 * until someone thinks to open the settings. An unknown id is ignored, so a
 * topic later renamed or removed cannot wedge anything.
 */
export function enabledTopics(topicsOff) {
  const off = new Set(Array.isArray(topicsOff) ? topicsOff : []);
  return TOPICS.filter((t) => !off.has(t.id));
}

const SHOW_BUILDERS = { ...BUILDERS, mainCast };

/** Every clue a topic can make from the pool in play. Unordered, undeduped by subject. */
export function candidatesFor(ctx, topic) {
  const out = [];
  for (const name of topic.show ?? []) {
    for (const s of ctx.shows) {
      const clue = SHOW_BUILDERS[name](ctx, s);
      if (clue) out.push(clue);
    }
  }
  for (const name of topic.character ?? []) {
    for (const c of ctx.characters) {
      const clue = CHARACTER_BUILDERS[name](ctx, c);
      if (clue) out.push(clue);
    }
  }
  return out;
}

// ── Multiple choice ────────────────────────────────────────────────────────

// Never past the newest show in the pack: offering 2028 for a 2025 show is
// an option nobody would pick, which makes it three options, not four.
function numberDistractors(ctx, clue, rng) {
  const n = Number(clue.answer);
  const near = clue.field === 'episodes'
    ? [n - 12, n - 2, n - 1, n + 1, n + 2, n + 12, 12, 13, 24, 25, 26, 50]
    : [n - 4, n - 3, n - 2, n - 1, n + 1, n + 2, n + 3, n + 4];
  const ceiling = (clue.field === 'seasonYear' || clue.field === 'originalYear') && ctx.maxYear ? ctx.maxYear : Infinity;
  const pool = [...new Set(near)]
    .filter((x) => Number.isInteger(x) && x > 1 && x !== n && x <= ceiling)
    .sort((a, b) => Math.abs(a - n) - Math.abs(b - n))
    .slice(0, 6);
  return shuffle(pool, rng).slice(0, CHOICES - 1).map(String);
}

// Up to `want` values from `values`, at random, skipping anything whose fold is
// in `seen` (and adding what it takes). Samples by index rather than shuffling,
// because `values` can be every voice actor in the pack and this runs once per
// clue dealt.
function sample(values, want, seen, fold, rng) {
  const out = [];
  if (!values.length) return out;
  for (let tries = 0; out.length < want && tries < want * 25; tries++) {
    const v = values[Math.floor(rng() * values.length)];
    if (typeof v !== 'string' || !v.trim()) continue;
    const k = fold(v);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function domainFor(ctx, domain) {
  if (!ctx.domains.has(domain)) ctx.domains.set(domain, domainValues(ctx.index, domain));
  return ctx.domains.get(domain);
}

// Distractors come from the shows in play first, then the pack: a wrong option
// the table recognises is a real choice, while four strangers is a coin toss
// between names. Anything the clue would ACCEPT is excluded, or a "wrong"
// option could be marked right.
function domainDistractors(ctx, clue, rng) {
  const fold = FOLDS[clue.kind] ?? foldName;
  const seen = new Set(clue.accept);
  seen.add(fold(clue.answer));
  // The closed sets are small enough to use whole.
  if (clue.domain === 'source' || clue.domain === 'season') {
    return shuffle(domainFor(ctx, clue.domain).filter((v) => !seen.has(fold(v))), rng).slice(0, CHOICES - 1);
  }

  const local = [];
  if (clue.domain === 'show') local.push(...ctx.shows.map((s) => s.title));
  if (clue.domain === 'character') local.push(...ctx.characters.map((c) => c.name));
  if (clue.domain === 'studio') local.push(...ctx.shows.map((s) => s.studio));
  if (clue.domain === 'staff') for (const s of ctx.shows) for (const f of STAFF_FIELDS) local.push(s[f]);
  if (clue.domain === 'voiceActor') local.push(...ctx.characters.map((c) => c.voiceActorJp));
  if (clue.domain === 'artist') for (const s of ctx.shows) for (const t of themesOf(s)) local.push(...(t.artists ?? []));
  if (clue.domain === 'magazine') local.push(...ctx.shows.map((s) => s.serializedIn));
  if (clue.domain === 'publisher') local.push(...ctx.shows.filter((s) => s.source === 'MANGA').map((s) => s.originalPublisher));
  if (clue.domain === 'imprint') local.push(...ctx.shows.filter((s) => s.source === 'LIGHT_NOVEL').map((s) => s.originalPublisher));

  const picked = sample(local, CHOICES - 1, seen, fold, rng);
  picked.push(...sample(domainFor(ctx, clue.domain), CHOICES - 1 - picked.length, seen, fold, rng));
  return picked;
}

/** The clue with `options` attached, or null when four honest options cannot be made. */
export function withChoices(ctx, clue, rng = Math.random) {
  const wrong = clue.kind === 'number' ? numberDistractors(ctx, clue, rng) : domainDistractors(ctx, clue, rng);
  if (wrong.length < CHOICES - 1) return null;
  return { ...clue, options: shuffle([clue.answer, ...wrong], rng) };
}

// ── Dealing ────────────────────────────────────────────────────────────────
//
// Options are attached only to clues actually dealt, at the moment they are
// dealt. Building them for every candidate first — ten thousand of them over
// the whole pack — is what made the first version take twenty seconds to deal
// thirty clues.

// One clue per subject per topic: two "Air Dates" clues about the same show in
// one column is a column about that show.
function dedupeBySubject(clues, rng) {
  const seen = new Set();
  const out = [];
  for (const c of shuffle(clues, rng)) {
    if (seen.has(c.subject)) continue;
    seen.add(c.subject);
    out.push(c);
  }
  return out;
}

// A random member of `pool` that survives `finish`, or null. Rejects are
// dropped from the pool so a retry cannot pick them again.
function draw(pool, finish, rng) {
  const left = [...pool];
  while (left.length) {
    const i = Math.floor(rng() * left.length);
    const done = finish(left[i]);
    if (done) return { source: left[i], clue: done };
    left.splice(i, 1);
  }
  return null;
}

// Five clues, one from each fifth of the difficulty range, easiest first. A
// board column is a ladder, and a random draw is not one.
function ladder(candidates, usedSubjects, finish, rng) {
  const sorted = [...candidates].sort((a, b) => a.difficulty - b.difficulty);
  const picks = [];
  const taken = new Set();
  for (let r = 0; r < ROWS; r++) {
    const lo = Math.floor((r * sorted.length) / ROWS);
    const hi = Math.floor(((r + 1) * sorted.length) / ROWS);
    const band = sorted.slice(lo, Math.max(hi, lo + 1)).filter((c) => !taken.has(c));
    const fresh = band.filter((c) => !usedSubjects.has(c.subject));
    const hit = draw(fresh, finish, rng) ?? draw(band, finish, rng);
    if (!hit) return null;
    taken.add(hit.source);
    picks.push(hit.clue);
  }
  for (const p of picks) usedSubjects.add(p.subject);
  return { picks, taken };
}

const finisher = (ctx, choices, rng) => (clue) => (choices ? withChoices(ctx, clue, rng) : clue);

/**
 * A board: `categories` columns of five, a Daily Double and a final clue.
 *
 * Returns { categories: [{ id, title, clues }], dailyDouble, final } or
 * { error } when the pool cannot fill two columns — the floor below which a
 * board is not a board.
 *
 * The Daily Double never sits in the top row. A wager on a 200-point clue is a
 * wager on the easiest question on the board, which turns the one high-stakes
 * moment in the game into free money.
 */
export function dealBoard(index, showKeys, {
  categories = 5, choices = true, dailyDouble = true, finalRound = true, topics = TOPICS, rng = Math.random,
} = {}) {
  const ctx = buildContext(index, showKeys);
  const finish = finisher(ctx, choices, rng);
  const usedSubjects = new Set();
  const columns = [];
  const leftovers = [];

  // `topics` is the table's switched-on set (enabledTopics). Fewer of them than
  // `categories` simply deals a narrower board; the final draws from them too,
  // so a switched-off topic cannot sneak back in as the last question.
  for (const topic of shuffle(topics, rng)) {
    const pool = dedupeBySubject(candidatesFor(ctx, topic), rng);
    if (columns.length >= categories || pool.length < ROWS) {
      leftovers.push(...pool);
      continue;
    }
    const hit = ladder(pool, usedSubjects, finish, rng);
    if (!hit) { leftovers.push(...pool); continue; }
    columns.push({
      id: topic.id,
      title: topic.title,
      clues: hit.picks.map((c, r) => ({ ...c, value: BOARD_VALUES[r] })),
    });
    leftovers.push(...pool.filter((c) => !hit.taken.has(c)));
  }

  if (columns.length < 2) return { error: 'not-enough' };

  // The final is a hard clue about a subject the board did not already use —
  // otherwise the last question of the night is a re-run.
  let final = null;
  if (finalRound) {
    const fresh = leftovers.filter((c) => !usedSubjects.has(c.subject));
    const hard = [...(fresh.length ? fresh : leftovers)].sort((a, b) => b.difficulty - a.difficulty);
    const hit = draw(hard.slice(0, Math.max(1, Math.ceil(hard.length / 5))), finish, rng)
      ?? draw(hard, finish, rng);
    if (hit) final = { ...hit.clue, value: 0, categoryTitle: topicTitle(hit.clue.topic) };
  }

  let dd = null;
  if (dailyDouble) {
    const c = Math.floor(rng() * columns.length);
    const r = 1 + Math.floor(rng() * (ROWS - 1));
    dd = cellKey(c, r);
  }

  return { categories: columns, dailyDouble: dd, final };
}

export const cellKey = (col, row) => `${col}-${row}`;

export function parseCell(key) {
  const [c, r] = String(key ?? '').split('-').map(Number);
  return Number.isInteger(c) && Number.isInteger(r) ? { col: c, row: r } : null;
}

export function quizValue(difficulty) {
  const band = Math.min(QUIZ_VALUES.length - 1, Math.max(0, Math.floor(difficulty * QUIZ_VALUES.length)));
  return QUIZ_VALUES[band];
}

/**
 * A quiz: `count` clues, spread across topics, easiest first, each priced by
 * its own difficulty. Returns { questions } or { error }.
 *
 * Round-robin over the topics rather than a draw from one big pile, because the
 * pile is lopsided — the voice topic alone has a quarter of every candidate —
 * and a straight draw would be a voice-acting quiz.
 */
export function dealQuiz(index, showKeys, {
  count = 10, choices = true, topics = TOPICS, rng = Math.random,
} = {}) {
  const ctx = buildContext(index, showKeys);
  const finish = finisher(ctx, choices, rng);
  const queues = shuffle(topics, rng)
    .map((t) => dedupeBySubject(candidatesFor(ctx, t), rng))
    .filter((q) => q.length);
  const usedSubjects = new Set();
  const picks = [];
  while (picks.length < count && queues.some((q) => q.length)) {
    for (const q of queues) {
      if (picks.length >= count) break;
      while (q.length) {
        const c = q.shift();
        if (usedSubjects.has(c.subject)) continue;
        const done = finish(c);
        if (!done) continue;
        usedSubjects.add(c.subject);
        picks.push(done);
        break;
      }
    }
  }
  if (!picks.length) return { error: 'not-enough' };
  const questions = picks
    .sort((a, b) => a.difficulty - b.difficulty)
    .map((c) => ({ ...c, value: quizValue(c.difficulty), categoryTitle: topicTitle(c.topic) }));
  return { questions };
}

// ── Grading ────────────────────────────────────────────────────────────────

/** Is `text` an answer this clue accepts? Pure membership; the pack is not consulted. */
export function isCorrect(clue, text) {
  if (!clue || typeof text !== 'string' || !text.trim()) return false;
  const folded = foldAnswer(clue.kind, text);
  return Boolean(folded) && (clue.accept ?? []).includes(folded);
}

// RTDB drops empty arrays and turns nothing into null, so every clue that comes
// back out of a room passes through here before anything reads `.includes`.
const asArray = (v) => {
  if (Array.isArray(v)) return v.filter((x) => x != null);
  if (v && typeof v === 'object') {
    return Object.keys(v).sort((a, b) => Number(a) - Number(b)).map((k) => v[k]).filter((x) => x != null);
  }
  return [];
};

export function normalizeClue(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: raw.id ?? '',
    topic: raw.topic ?? '',
    field: raw.field ?? '',
    subject: raw.subject ?? '',
    prompt: raw.prompt ?? '',
    answer: raw.answer ?? '',
    kind: raw.kind ?? 'name',
    accept: asArray(raw.accept),
    alsoAccepted: asArray(raw.alsoAccepted),
    domain: raw.domain ?? null,
    difficulty: Number(raw.difficulty) || 0,
    value: Number(raw.value) || 0,
    options: raw.options == null ? null : asArray(raw.options),
    categoryTitle: raw.categoryTitle ?? null,
  };
}

export { asArray };
