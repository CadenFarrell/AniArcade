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
import { FORMAT_NOUNS, SEASON_LABELS, SOURCE_LABELS } from '../../shared/utils/mediaLabels';
import { FAMOUS_LINES } from './famousLines';

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

// A finished line keeps its word order — "you can't win" and "win, you can't"
// are not the same ending — so it gets foldName's cleaning without the sort.
// Only ever compared against an option the player tapped (a line ending is
// multiple choice only), so this just has to be the same fold both ways.
const foldLine = (s) => String(s ?? '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

export const FOLDS = {
  show: (s) => subjectKeyForShow(String(s ?? '')),
  character: (s) => subjectKeyForCharacter(String(s ?? '')),
  name: foldName,
  number: foldNumber,
  line: foldLine,
};

export function foldAnswer(kind, text) {
  const fold = FOLDS[kind] ?? foldName;
  return fold(text);
}

// ── Labels ─────────────────────────────────────────────────────────────────

// Shared with AniPeek's hint cards (shared/utils/mediaLabels.js), and still
// exported from here for this game's own callers. OTHER, and anything AniList
// adds later, is deliberately absent: a source the game cannot name is a source
// it cannot ask about.
export { SOURCE_LABELS, SEASON_LABELS };

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

// A song named after its own show answers the "name the show" clue in the
// asking: "“Date A Live” by sweet ARMS", "Mezase Pokémon Master", "takt" for
// takt op.Destiny. 36 themes in pack-v5 do it, 20 of them the one quoted.
// Whole words in order either way round, so "Blue" names Blue Spring Ride but
// "Believe" does not name a show that merely contains "be".
const words = (s) => ` ${String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
function namesShow(t, s) {
  const song = words(t.song);
  const title = words(s.title);
  return song.trim() !== '' && (song.includes(title) || title.includes(song));
}

// The theme a "name the show" clue quotes: the first opening, which is the
// famous one far more often than not — passing over one that names the show.
function leadTheme(s) {
  const usable = themesOf(s).filter((t) => !namesShow(t, s));
  return usable.find((t) => t.type === 'OP') ?? usable[0] ?? null;
}

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
//
// The casual topics (The Squad, Name That Character, Which Came First?, Fan
// Favourites) sit at the easy end on purpose: they ask what a viewer knows
// from WATCHING — faces, names, roughly when it aired, whether it was a hit —
// where the credits topics ask what a viewer would only know from reading the
// end roll. Obscurity still prices them, so an obscure show's squad is a 600.
const FIELD_WEIGHT = {
  portraitShow: 0.05,
  squad: 0.05,
  source: 0.05,
  portraitName: 0.15,
  lastAired: 0.3,
  firstAired: 0.3,
  mostPopular: 0.35,
  topScore: 0.4,
  appearsIn: 0.1,
  mainCast: 0.2,
  studio: 0.25,
  seasonYear: 0.25,
  // A franchise's own opening is the one piece of credits trivia most fans can
  // hum, so naming the show from it sits with the cast clues, not the staff.
  themeShow: 0.3,
  // Famous Lines: a line is something a viewer HEARD, so all three sit with the
  // casual topics. Where it comes from is the easiest ask, then who says it;
  // finishing it means recalling the words themselves. The line's own fame
  // carries half of the obscurity side (see lineDifficulty).
  lineShow: 0.1,
  lineSpeaker: 0.2,
  lineFinish: 0.25,
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
export function buildContext(index, showKeys, { portraits = null, lines = FAMOUS_LINES } = {}) {
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

  // Famous Lines in play: a line counts when its show — or any show it is also
  // from, the same scene in a remake — is in play, and spends that show.
  const playLines = [];
  for (const l of preparedLines(lines, index)) {
    const home = [l.key, ...l.also].find((k) => inPlay.has(k));
    if (home) playLines.push({ ...l, home });
  }

  return {
    index, packShows, packChars, shows, characters, showObscurity, charObscurity,
    lines: playLines,
    lineById: new Map(playLines.map((l) => [l.subject, l])),
    ...lookups(index),
    domains: new Map(),
    // Character key → portrait URL, from the players' own lists (see
    // utils/portraits.js). Empty for a table with no lists.
    portraits: portraits instanceof Map ? portraits : new Map(),
    // Every wrong option this deal has already shown, by domain, so the next
    // clue's options prefer names the table has not just ruled out. A context
    // lives for one deal, so this is "earlier in this game" and nothing more.
    shownOptions: new Map(),
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
 *
 * `usable` is enabled AND dealable in this answer style: a choice-only topic
 * switched on under typed answers is reported (`typedOut`) but not totalled,
 * because the deal will leave it out. `portraits` is utils/portraits.js's map,
 * without which Name That Character counts nothing.
 */
export function poolSummary(index, showKeys, topicsOff = [], { choices = true, portraits = null, lines } = {}) {
  const ctx = buildContext(index, showKeys, { portraits, lines });
  const on = new Set(enabledTopics(topicsOff).map((t) => t.id));
  const topics = TOPICS.map((t) => ({
    id: t.id,
    title: t.title,
    blurb: t.blurb,
    hard: Boolean(t.hard),
    choiceOnly: Boolean(t.choiceOnly),
    enabled: on.has(t.id),
    typedOut: Boolean(t.choiceOnly) && !choices,
    usable: on.has(t.id) && (choices || !t.choiceOnly),
    clues: new Set(candidatesFor(ctx, t, { choices }).map((c) => c.subject)).size,
  }));
  const live = topics.filter((t) => t.usable);
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

// ── casual: what a viewer knows from watching ──

// "A, B and C" — the squad's spelling.
function andList(names) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// A name that shares a word with the title answers the squad clue in the
// asking: "Naruto Uzumaki" for NARUTO, "Haruhi Suzumiya" for The Melancholy of
// Haruhi Suzumiya, "Frieren" for Frieren: Beyond Journey's End. Whole words of
// three letters or more, so "Ai" or "Rin" cannot rule a name out by accident.
function nameInTitle(name, title) {
  const t = new Set(words(title).trim().split(' '));
  return words(name).trim().split(' ').some((w) => w.length >= 3 && t.has(w));
}

// The best-known leads a squad clue names. Three is a fair handful: one name
// can be a guess, three are a cast.
const SQUAD_SIZE = 3;

// The comparison clues: four shows, one of which is clearly the most of
// something. "Clearly" is the margin — every wrong option must lose by at
// least this much, or the clue is a coin toss between two near-ties, and the
// ORDER of shows sharing a premiere year is not something anybody watched.
//
//   by      the show field compared
//   want    'min' (the smallest wins) or 'max'
//   margin  how far every other option must trail — years, score points, or a
//           ratio for popularity (a member count, where 10% of a hit is a lot)
//   show    how the reveal prints each option's value
export const COMPARE = {
  firstAired: { by: 'seasonYear', want: 'min', margin: 1, show: (v) => String(v) },
  lastAired: { by: 'seasonYear', want: 'max', margin: 1, show: (v) => String(v) },
  topScore: { by: 'averageScore', want: 'max', margin: 3, show: (v) => `${v}%` },
  mostPopular: { by: 'popularity', want: 'max', ratio: 1.25, show: (v) => `${Number(v).toLocaleString('en-US')} members` },
};

const compareValue = (s, field) => {
  const v = s?.[COMPARE[field].by];
  return Number.isFinite(v) && v > 0 ? v : null;
};

/** Whether `other` loses to `answer` on this comparison, by a clear margin. */
export function trails(field, answer, other) {
  const spec = COMPARE[field];
  const a = compareValue(answer, field);
  const o = compareValue(other, field);
  if (a == null || o == null) return false;
  if (spec.ratio) return spec.want === 'max' ? a >= o * spec.ratio : o >= a * spec.ratio;
  return spec.want === 'max' ? a - o >= spec.margin : o - a >= spec.margin;
}

const COMPARE_PROMPTS = {
  firstAired: 'Which of these premiered first?',
  lastAired: 'Which of these premiered most recently?',
  topScore: 'Which of these has the highest AniList score?',
  mostPopular: 'Which of these is the most popular on AniList?',
};

// The options ARE the clue here, so these are choice-only (their topic says
// `choiceOnly`) and their wrong options are drawn by compareDistractors, never
// the generic domain sampler. A subject with too few shows it beats in the
// whole pack cannot be asked, and is not.
const compareShow = (field, topic) => (ctx, s) => {
  if (compareValue(s, field) == null) return null;
  let beaten = 0;
  for (const o of ctx.packShows.values()) {
    if (trails(field, s, o) && ++beaten >= CHOICES - 1) break;
  }
  if (beaten < CHOICES - 1) return null;
  return {
    id: `${field}:${s.key}`,
    topic,
    field,
    subject: s.key,
    prompt: COMPARE_PROMPTS[field],
    answer: s.title,
    kind: 'show',
    accept: [s.key],
    domain: 'show',
    compare: field,
    difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, field),
  };
};

const CASUAL_SHOW_BUILDERS = {
  // Named from its best-known leads, accepting every pack show they all lead —
  // a sequel season keyed apart, or a shared-universe spin-off.
  squad: (ctx, s) => {
    const cast = (ctx.castByShow.get(s.key) ?? []).filter((c) => !nameInTitle(c.name, s.title));
    if (cast.length < 2) return null;
    const named = [...cast].sort((a, b) => b.favourites - a.favourites).slice(0, SQUAD_SIZE);
    const leads = named.map((c) => new Set(ctx.packChars.get(c.key)?.appearsIn ?? []));
    const matches = [...leads[0]]
      .filter((k) => ctx.packShows.has(k) && leads.every((set) => set.has(k)))
      .map((k) => ({ key: k, title: ctx.packShows.get(k).title }));
    if (!matches.some((m) => m.key === s.key)) return null;
    const answer = showAnswer(ctx, s, matches);
    if (!answer) return null;
    return {
      id: `squad:${s.key}`,
      topic: 'squad',
      field: 'squad',
      subject: s.key,
      prompt: `${andList(named.map((c) => c.name))} are main characters in which show?`,
      ...answer,
      difficulty: blend(ctx.showObscurity.get(s.key) ?? 1, 'squad'),
    };
  },
  firstAired: compareShow('firstAired', 'firsts'),
  lastAired: compareShow('lastAired', 'firsts'),
  topScore: compareShow('topScore', 'favourites'),
  mostPopular: compareShow('mostPopular', 'favourites'),
};

// Portraits come from the PLAYERS' imported lists (ctx.portraits, built by
// utils/portraits.js), not the pack, which carries no images. So the topic is
// as wide as the table's lists: a character nobody's list pictured cannot be
// asked about this way, and a table with no lists has no such clues at all.
// The prompt never names the character, and neither does the image's alt text
// (ClueCard) — either would answer the clue.
const PORTRAIT_BUILDERS = {
  portraitName: (ctx, c) => {
    const image = ctx.portraits.get(c.key);
    if (!image) return null;
    return {
      id: `portraitName:${c.key}`,
      topic: 'portraits',
      field: 'portraitName',
      subject: c.key,
      show: c.home,
      prompt: 'Who is this character?',
      image,
      answer: c.name,
      kind: 'character',
      accept: [c.key],
      domain: 'character',
      difficulty: blend(ctx.charObscurity.get(c.key) ?? 1, 'portraitName'),
    };
  },

  // "From", so it accepts every show they are in, lead or supporting — the
  // appearsIn clue's weaker wording, for its reason.
  portraitShow: (ctx, c) => {
    const image = ctx.portraits.get(c.key);
    if (!image) return null;
    const homes = [...new Set([...(c.appearsIn ?? []), ...(c.supportingIn ?? [])])].filter((k) => ctx.packShows.has(k));
    if (!homes.includes(c.home)) return null;
    const rest = homes.filter((k) => k !== c.home);
    return {
      id: `portraitShow:${c.key}`,
      topic: 'portraits',
      field: 'portraitShow',
      subject: c.key,
      show: c.home,
      prompt: 'Which show is this character from?',
      image,
      answer: ctx.packShows.get(c.home).title,
      kind: 'show',
      accept: [c.home, ...rest],
      alsoAccepted: rest.map((k) => ctx.packShows.get(k).title),
      domain: 'show',
      difficulty: blend(ctx.charObscurity.get(c.key) ?? 1, 'portraitShow'),
    };
  },
};

// ── character clues ──
const CHARACTER_BUILDERS = {
  ...PORTRAIT_BUILDERS,
  voiceActor: (ctx, c) => {
    if (!c.voiceActorJp) return null;
    const show = ctx.packShows.get(c.home);
    return {
      id: `voiceActor:${c.key}`,
      topic: 'voices',
      field: 'voiceActor',
      subject: c.key,
      show: c.home,
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
      show: c.home,
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
      // The show this clue spends is the one its answer names.
      show: lead,
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

// ── Famous Lines ───────────────────────────────────────────────────────────
//
// The one topic not drawn from the pack: famousLines.js is a hand-curated list
// (no source the arcade uses has quotes), keyed to pack shows by title. Each
// line makes up to three clues — finish it, who says it, which show — and all
// three share one SUBJECT, the line, so dedupeBySubject keeps one of them per
// line and a column never asks the same quote twice. The show it spends is the
// one in play (`home`), for the spread.
//
// Finishing a line is multiple choice only (`choiceOnly` on the clue, not the
// topic): sub and dub wordings differ ("the honored one" / "the strongest"), so
// a typed ending would mark people who know the line wrong. A typed deal still
// gets the other two shapes, which grade like any character or show clue.

const BLANK = /\[([^\]]+)\]/;

// Words that a title and a line share by accident rather than as a tell.
const COMMON_WORDS = new Set(['that', 'this', 'with', 'from', 'your', 'what', 'when', 'will', 'have', 'there', 'they', 'them', 'just', 'only', 'more', 'than', 'into', 'over', 'ever', 'never', 'love', 'life', 'world']);

const wordSet = (s, min) => new Set(words(s).trim().split(' ').filter((w) => w.length >= min && !COMMON_WORDS.has(w)));
const shares = (line, names, min) => {
  const inLine = wordSet(line, min);
  return names.some((n) => [...wordSet(n, min)].some((w) => inLine.has(w)));
};

// "Satoru Gojou" → also "Gojou Satoru": AniList itself is inconsistent about
// order ("Luffy Monkey"), so a typed speaker is accepted either way round.
function bothOrders(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? [parts.join(' '), [...parts].reverse().join(' ')] : parts;
}

// The list, resolved against one pack: its keys through the pack's aliases,
// its blanks split out. Memoized per (list, index), like `lookups`, because
// every deal and every pool report would otherwise redo it.
const PREPARED_LINES = new WeakMap();

function preparedLines(list, index) {
  if (!Array.isArray(list) || !index) return [];
  if (!PREPARED_LINES.has(list)) PREPARED_LINES.set(list, new WeakMap());
  const byIndex = PREPARED_LINES.get(list);
  if (byIndex.has(index)) return byIndex.get(index);
  const shows = index.shows ?? new Map();
  const resolve = (title) => resolveShowKey(index, subjectKeyForShow(String(title ?? '')));
  const out = [];
  for (const raw of list) {
    const m = BLANK.exec(raw?.line ?? '');
    const key = resolve(raw?.show);
    if (!m || !shows.has(key)) continue;
    const ending = m[1];
    const full = raw.line.replace(BLANK, ending);
    // Stable across builds, so recent.js can recognise a line it dealt: the
    // show and the line's own opening words.
    const id = `${key}|${words(full).trim().split(' ').slice(0, 8).join(' ')}`;
    out.push({
      subject: `line:${id}`,
      key,
      also: (raw.also ?? []).map(resolve).filter((k) => k !== key && shows.has(k)),
      by: raw.by ?? null,
      pack: raw.pack ?? null,
      aka: Array.isArray(raw.aka) ? raw.aka : [],
      full,
      stem: raw.line.replace(BLANK, '___'),
      ending,
      decoys: Array.isArray(raw.decoys) ? raw.decoys : [],
      fame: [1, 2, 3].includes(raw.fame) ? raw.fame : 2,
      noShow: Boolean(raw.noShow),
    });
  }
  byIndex.set(index, out);
  return out;
}

// Half the show's obscurity in this pool, half the line's own fame: "I'm gonna
// be King of the Pirates" is a 200 even on a table where One Piece is the
// least-watched show, and a deep cut from the most-watched show is not.
const lineDifficulty = (ctx, l, field) =>
  blend(0.5 * (ctx.showObscurity.get(l.home) ?? 1) + 0.5 * ((l.fame - 1) / 2), field);

const speakerNames = (l) => [l.by, l.pack, ...l.aka].filter(Boolean);

const curly = (s) => `“${s}”`;

const LINE_BUILDERS = {
  lineFinish: (ctx, l) => {
    if (l.decoys.length < CHOICES - 1) return null;
    const title = ctx.packShows.get(l.key)?.title ?? l.key;
    const whose = l.by ? `${l.by}’s line` : 'this line';
    return {
      id: `lineFinish:${l.subject}`,
      topic: 'lines',
      field: 'lineFinish',
      subject: l.subject,
      show: l.home,
      prompt: `Finish ${whose} from ${quote(title)}: ${curly(l.stem)}`,
      answer: l.ending,
      kind: 'line',
      accept: [foldLine(l.ending)],
      domain: null,
      choiceOnly: true,
      // The whole line, on the reveal: the ending alone reads as a fragment.
      detail: l.by ? `${curly(l.full)} — ${l.by}` : curly(l.full),
      difficulty: lineDifficulty(ctx, l, 'lineFinish'),
    };
  },

  // The prompt names the show, and the options are that show's own cast, so
  // this asks who says it — not which show it is from, which is lineShow.
  lineSpeaker: (ctx, l) => {
    if (!l.by) return null;
    // "It was me, Dio!" answers itself.
    if (shares(l.full, speakerNames(l), 3)) return null;
    const title = ctx.packShows.get(l.key)?.title ?? l.key;
    const accept = [...new Set(speakerNames(l).flatMap(bothOrders).map(FOLDS.character))];
    return {
      id: `lineSpeaker:${l.subject}`,
      topic: 'lines',
      field: 'lineSpeaker',
      subject: l.subject,
      show: l.home,
      prompt: `${curly(l.full)} Who says this in ${quote(title)}?`,
      answer: l.by,
      kind: 'character',
      accept,
      domain: 'character',
      difficulty: lineDifficulty(ctx, l, 'lineSpeaker'),
    };
  },

  // Never when the line gives its show away: a word of the title, the
  // speaker's name, or a tell the list marks by hand (`noShow` — "Pikachu, I
  // choose you!"). A line from a remade scene accepts every show it is from.
  lineShow: (ctx, l) => {
    if (l.noShow) return null;
    const keys = [l.key, ...l.also];
    const titles = keys.map((k) => ctx.packShows.get(k)?.title ?? k);
    if (shares(l.full, titles, 4) || shares(l.full, speakerNames(l), 3)) return null;
    return {
      id: `lineShow:${l.subject}`,
      topic: 'lines',
      field: 'lineShow',
      subject: l.subject,
      show: l.home,
      prompt: `Which show is this line from? ${curly(l.full)}`,
      answer: titles[0],
      kind: 'show',
      accept: keys,
      alsoAccepted: titles.slice(1),
      domain: 'show',
      detail: l.by ? `— ${l.by}` : null,
      difficulty: lineDifficulty(ctx, l, 'lineShow'),
    };
  },
};

// A "who says this?" clue's wrong options: three of the show's own cast, never
// the speaker under any of their names. Fewer than three and the clue has no
// honest options — a name from another show would be the odd one out, which
// answers it — so it is not dealt as multiple choice.
function speakerDistractors(ctx, clue, rng) {
  const l = ctx.lineById.get(clue.subject);
  if (!l) return [];
  const homes = new Set([l.key, ...l.also]);
  const seen = new Set(clue.accept);
  const cast = [];
  for (const c of ctx.packChars.values()) {
    if (GENERIC_NAME.test(c.name ?? '')) continue;
    if (![...(c.appearsIn ?? []), ...(c.supportingIn ?? [])].some((k) => homes.has(k))) continue;
    if (bothOrders(c.name).some((n) => seen.has(FOLDS.character(n)))) continue;
    cast.push(c.name);
  }
  return sample([cast], CHOICES - 1, [new Set(seen)], FOLDS.character, rng);
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
//
// Listed roughly easiest first, which is the order the settings card shows.
// A topic names its clue shapes by what they are built from: `show` (one per
// show in play), `character` (one per character in play), or `line` (one per
// Famous Lines entry in play, from famousLines.js rather than the pack).
// Two flags:
//
//   choiceOnly  the options ARE the question ("which of these came first?"),
//               so a typed deal leaves the topic out (buildDeal) and the card
//               says why
//   hard        credits trivia most casual fans never read. Switched OFF in
//               DEFAULT_PREFS.topicsOff — a table that never opened the card
//               plays the watchable topics — and badged "Harder" on the card
export const TOPICS = [
  { id: 'squad', title: 'The Squad', blurb: 'Name the show from its main characters', show: ['squad'] },
  {
    id: 'portraits',
    title: 'Name That Character',
    blurb: 'Character portraits from your imported lists',
    character: ['portraitName', 'portraitShow'],
  },
  { id: 'cast', title: 'Who’s Who', blurb: 'Main characters and their shows', show: ['mainCast'], character: ['appearsIn'] },
  {
    id: 'lines',
    title: 'Famous Lines',
    blurb: 'Finish a famous line, or say who said it and in which show',
    line: ['lineFinish', 'lineSpeaker', 'lineShow'],
  },
  {
    id: 'firsts',
    title: 'Which Came First?',
    blurb: 'Pick the oldest or newest of four shows',
    show: ['firstAired', 'lastAired'],
    choiceOnly: true,
  },
  {
    id: 'favourites',
    title: 'Fan Favourites',
    blurb: 'Pick the best-rated or most popular of four shows',
    show: ['topScore', 'mostPopular'],
    choiceOnly: true,
  },
  {
    id: 'themes',
    title: 'Theme Songs',
    blurb: 'Openings, endings and who sings them',
    show: ['themeShow', 'themeArtist', 'artistReverse'],
  },
  { id: 'calendar', title: 'Air Dates', blurb: 'Premiere years, seasons and episode counts', show: ['seasonYear', 'season', 'episodes'] },
  { id: 'studios', title: 'Studio Credits', blurb: 'Which studio animated it', show: ['studio', 'studioYear'] },
  { id: 'voices', title: 'Voice Cast', blurb: 'Japanese voice actors', character: ['voiceActor', 'voiceActorReverse'] },
  {
    id: 'staff',
    title: 'The Director’s Chair',
    blurb: 'Directors and series writers',
    show: ['director', 'seriesComposition', 'directorReverse'],
    hard: true,
  },
  { id: 'music', title: 'Who Scored It?', blurb: 'Soundtrack composers', show: ['composer', 'composerReverse'], hard: true },
  {
    id: 'origins',
    title: 'Source Material',
    blurb: 'Original creators, magazines and publishers',
    show: ['source', 'originalCreator', 'creatorReverse', 'magazine', 'originalPublisher', 'originalYear', 'magazineReverse'],
    hard: true,
  },
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

/**
 * The topics a deal may use: the ones switched on, less the choice-only ones
 * when answers are typed — "which of these came first?" with no "these" is
 * not a question.
 */
export function dealableTopics(topicsOff, { choices = true } = {}) {
  return enabledTopics(topicsOff).filter((t) => choices || !t.choiceOnly);
}

const SHOW_BUILDERS = { ...BUILDERS, ...CASUAL_SHOW_BUILDERS, mainCast };

/**
 * Every clue a topic can make from the pool in play. Unordered, undeduped by
 * subject. `choices: false` (typed answers) leaves out the clues that are
 * multiple choice only — a Famous Lines ending — BEFORE the dedupe, so a line
 * that could have been asked "who says this?" is never lost to its own
 * unaskable "finish it".
 */
export function candidatesFor(ctx, topic, { choices = true } = {}) {
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
  for (const name of topic.line ?? []) {
    for (const l of ctx.lines ?? []) {
      const clue = LINE_BUILDERS[name](ctx, l);
      if (clue && (choices || !clue.choiceOnly)) out.push(clue);
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

// Up to `want` values from `groups` (a list of value lists), at random, skipping
// anything whose fold is in any of `skip` (and adding what it takes to every
// set in `skip`). A group is picked first, then a value in it: grouped by show,
// that is what stops one big cast supplying most of the names — JoJo has 35
// characters in pack-v5 against a median show's 4, so a flat draw over every
// character in play was mostly JoJo. Samples by index rather than shuffling,
// because a group can be every voice actor in the pack and this runs once per
// clue dealt.
function sample(groups, want, skip, fold, rng) {
  const out = [];
  const live = groups.filter((g) => g.length);
  if (!live.length) return out;
  for (let tries = 0; out.length < want && tries < want * 25; tries++) {
    const g = live[Math.floor(rng() * live.length)];
    const v = g[Math.floor(rng() * g.length)];
    if (typeof v !== 'string' || !v.trim()) continue;
    const k = fold(v);
    if (!k || skip.some((s) => s.has(k))) continue;
    for (const s of skip) s.add(k);
    out.push(v);
  }
  return out;
}

// The shows in play's own values for a domain, grouped by show where one show
// can hold many (its cast, its cast's voices); one flat group otherwise, since
// a show has one studio, one magazine, a handful of staff.
function localGroups(ctx, domain) {
  const byHome = (pick) => {
    const groups = new Map();
    for (const c of ctx.characters) {
      if (!groups.has(c.home)) groups.set(c.home, []);
      groups.get(c.home).push(pick(c));
    }
    return [...groups.values()];
  };
  if (domain === 'character') return byHome((c) => c.name);
  if (domain === 'voiceActor') return byHome((c) => c.voiceActorJp);
  const flat = [];
  if (domain === 'show') flat.push(...ctx.shows.map((s) => s.title));
  if (domain === 'studio') flat.push(...ctx.shows.map((s) => s.studio));
  if (domain === 'staff') for (const s of ctx.shows) for (const f of STAFF_FIELDS) flat.push(s[f]);
  if (domain === 'artist') for (const s of ctx.shows) for (const t of themesOf(s)) flat.push(...(t.artists ?? []));
  if (domain === 'magazine') flat.push(...ctx.shows.map((s) => s.serializedIn));
  if (domain === 'publisher') flat.push(...ctx.shows.filter((s) => s.source === 'MANGA').map((s) => s.originalPublisher));
  if (domain === 'imprint') flat.push(...ctx.shows.filter((s) => s.source === 'LIGHT_NOVEL').map((s) => s.originalPublisher));
  return [flat];
}

function domainFor(ctx, domain) {
  if (!ctx.domains.has(domain)) ctx.domains.set(domain, domainValues(ctx.index, domain));
  return ctx.domains.get(domain);
}

// Distractors come from the shows in play first, then the pack: a wrong option
// the table recognises is a real choice, while four strangers is a coin toss
// between names. Anything the clue would ACCEPT is excluded, or a "wrong"
// option could be marked right.
//
// Within that, a name already shown as a wrong option earlier in this game is
// a last resort: on a small shared pool the same dozen titles were coming back
// on clue after clue, and a player who has ruled a name out twice has learned
// the options, not the answer. So the order is the table's unshown names, the
// pack's unshown names, then repeats (the table's first). A small pool will
// therefore reach into the pack before it repeats itself — deliberately.
function domainDistractors(ctx, clue, rng) {
  const fold = FOLDS[clue.kind] ?? foldName;
  const seen = new Set(clue.accept);
  seen.add(fold(clue.answer));
  // The closed sets are small enough to use whole, and four seasons or a few
  // source kinds cannot be spread anyway.
  if (clue.domain === 'source' || clue.domain === 'season') {
    return shuffle(domainFor(ctx, clue.domain).filter((v) => !seen.has(fold(v))), rng).slice(0, CHOICES - 1);
  }

  const local = localGroups(ctx, clue.domain);
  const pack = [domainFor(ctx, clue.domain)];
  // A copy: the "unshown" passes add their picks to it, and the deal's own
  // record is written by withChoices only once the clue is actually used.
  const avoid = new Set(ctx.shownOptions.get(clue.domain) ?? []);
  const picked = [];
  const pass = (groups, skip) => picked.push(...sample(groups, CHOICES - 1 - picked.length, skip, fold, rng));
  pass(local, [seen, avoid]);
  pass(pack, [seen, avoid]);
  pass(local, [seen]);
  pass(pack, [seen]);
  return picked;
}

// A comparison clue's wrong options: shows that clearly trail the answer
// (`trails`), drawn in domainDistractors' order — the table's shows, then the
// pack's, unshown names before repeats. Returned as show records, because the
// reveal prints each one's value beside it.
function compareDistractors(ctx, clue, rng) {
  const answer = ctx.packShows.get(clue.subject);
  if (!answer) return [];
  const fold = FOLDS.show;
  const seen = new Set(clue.accept);
  const avoid = new Set(ctx.shownOptions.get('show') ?? []);
  const byTitle = new Map();
  const titles = (shows) => shows.filter((s) => trails(clue.compare, answer, s)).map((s) => {
    byTitle.set(s.title, s);
    return s.title;
  });
  const local = [titles(ctx.shows)];
  const pack = [titles([...ctx.packShows.values()])];
  const picked = [];
  const pass = (groups, skip) => picked.push(...sample(groups, CHOICES - 1 - picked.length, skip, fold, rng));
  pass(local, [seen, avoid]);
  pass(pack, [seen, avoid]);
  pass(local, [seen]);
  pass(pack, [seen]);
  return picked.map((t) => byTitle.get(t));
}

// "Steins;Gate 2011 · Fullmetal Alchemist: Brotherhood 2009 · …", best first:
// the reveal's proof, since "which came first" is only convincing with the
// years beside the names.
function compareDetail(field, shows) {
  const spec = COMPARE[field];
  const sorted = [...shows].sort((a, b) => (spec.want === 'max' ? 1 : -1) * (compareValue(b, field) - compareValue(a, field)));
  return sorted.map((s) => `${s.title} ${spec.show(compareValue(s, field))}`).join(' · ');
}

/**
 * The clue with `options` attached, or null when four honest options cannot be
 * made. Records the wrong options on the context, so later clues in the same
 * deal prefer others (see domainDistractors).
 */
export function withChoices(ctx, clue, rng = Math.random) {
  // A line's ending: the list's own three decoys, written to be wrong in the
  // character's voice. Nothing else could stand in — another line's ending is
  // a different sentence, and an obvious one.
  if (clue.field === 'lineFinish') {
    const decoys = ctx.lineById?.get(clue.subject)?.decoys ?? [];
    const wrong = decoys.filter((d) => foldLine(d) && !clue.accept.includes(foldLine(d))).slice(0, CHOICES - 1);
    if (wrong.length < CHOICES - 1) return null;
    return { ...clue, options: shuffle([clue.answer, ...wrong], rng) };
  }
  if (clue.field === 'lineSpeaker') {
    const wrong = speakerDistractors(ctx, clue, rng);
    if (wrong.length < CHOICES - 1) return null;
    return { ...clue, options: shuffle([clue.answer, ...wrong], rng) };
  }
  if (clue.compare) {
    const rivals = compareDistractors(ctx, clue, rng);
    if (rivals.length < CHOICES - 1) return null;
    if (!ctx.shownOptions.has('show')) ctx.shownOptions.set('show', new Set());
    for (const r of rivals) ctx.shownOptions.get('show').add(FOLDS.show(r.title));
    const answer = ctx.packShows.get(clue.subject);
    return {
      ...clue,
      options: shuffle([clue.answer, ...rivals.map((r) => r.title)], rng),
      detail: compareDetail(clue.compare, [answer, ...rivals]),
    };
  }
  const wrong = clue.kind === 'number' ? numberDistractors(ctx, clue, rng) : domainDistractors(ctx, clue, rng);
  if (wrong.length < CHOICES - 1) return null;
  if (clue.kind !== 'number' && ctx.shownOptions) {
    const fold = FOLDS[clue.kind] ?? foldName;
    if (!ctx.shownOptions.has(clue.domain)) ctx.shownOptions.set(clue.domain, new Set());
    const shown = ctx.shownOptions.get(clue.domain);
    for (const w of wrong) shown.add(fold(w));
  }
  return { ...clue, options: shuffle([clue.answer, ...wrong], rng) };
}

// ── Dealing ────────────────────────────────────────────────────────────────
//
// Options are attached only to clues actually dealt, at the moment they are
// dealt. Building them for every candidate first — ten thousand of them over
// the whole pack — is what made the first version take twenty seconds to deal
// thirty clues.

// One clue per subject per topic: two "Air Dates" clues about the same show in
// one column is a column about that show. The one kept is a clue this device
// has not dealt lately when the subject has one (recent.js) — dropped here, an
// unseen way to ask about a show would never reach the tiers that prefer it.
function dedupeBySubject(clues, rng, recentIds = new Set()) {
  const seen = new Set();
  const out = [];
  const mixed = shuffle(clues, rng);
  const ordered = [...mixed.filter((c) => !recentIds.has(c.id)), ...mixed.filter((c) => recentIds.has(c.id))];
  for (const c of ordered) {
    if (seen.has(c.subject)) continue;
    seen.add(c.subject);
    out.push(c);
  }
  return out;
}

// ── Spread ──
//
// A clue SPENDS a show: its subject when it is about a show, the character's
// show when it is about a character. Counting character clues by character
// (their subject) let one big cast fill a board — JoJo has 35 characters in
// pack-v5, the median show 4, and a deal over a 25-show shared list asked about
// JoJo nearly twice as often as the average show (measured 2026-11-03).
export const showOf = (clue) => clue?.show ?? clue?.subject ?? '';

// What a deal tries to avoid, and what it has already spent. `recent` comes
// from recent.js (the dealing device's last few games): `ids` are clues asked
// recently, `shows` the shows the last game featured.
function spreadState(recent) {
  return {
    usedShows: new Set(),
    usedSubjects: new Set(),
    recentIds: recent?.ids instanceof Set ? recent.ids : new Set(),
    recentShows: recent?.shows instanceof Set ? recent.shows : new Set(),
  };
}

function spend(st, clue) {
  st.usedShows.add(showOf(clue));
  st.usedSubjects.add(clue.subject);
}

// Preferences, strongest first; a draw takes the first tier that yields a clue.
// Every one is SOFT — the last tier is what the deal did before any of this, so
// a pool that dealt then deals now; it is only drawn from in a better order.
// A show unused this game outranks a clue unseen in recent games: the same show
// three times in one sitting is the louder repeat.
function tiers(st, { allowRepeatSubject = true } = {}) {
  const newShow = (c) => !st.usedShows.has(showOf(c));
  const unseen = (c) => !st.recentIds.has(c.id);
  const newSubject = (c) => !st.usedSubjects.has(c.subject);
  const out = [
    (c) => newShow(c) && unseen(c) && !st.recentShows.has(showOf(c)),
    (c) => newShow(c) && unseen(c),
    newShow,
    (c) => newSubject(c) && unseen(c),
    newSubject,
  ];
  if (allowRepeatSubject) out.push(() => true);
  return out;
}

// A random member of `pool` that survives `finish`, or null — drawn show first,
// then a clue of that show, so a show's chance does not grow with its cast.
// Rejects are dropped so a retry cannot pick them again.
function drawByShow(pool, finish, rng) {
  const groups = new Map();
  for (const c of pool) {
    const s = showOf(c);
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s).push(c);
  }
  const shows = [...groups.keys()];
  while (shows.length) {
    const si = Math.floor(rng() * shows.length);
    const group = groups.get(shows[si]);
    const ci = Math.floor(rng() * group.length);
    const done = finish(group[ci]);
    if (done) return { source: group[ci], clue: done };
    group.splice(ci, 1);
    if (!group.length) shows.splice(si, 1);
  }
  return null;
}

function drawTiered(pool, st, finish, rng) {
  for (const ok of tiers(st)) {
    const hit = drawByShow(pool.filter(ok), finish, rng);
    if (hit) return hit;
  }
  return null;
}

// Five clues, one from each fifth of the difficulty range, easiest first. A
// board column is a ladder, and a random draw is not one. Works on a copy of
// the spread state, committed only if the whole column fills, so a column that
// fails does not leave its shows marked spent.
function ladder(candidates, st, finish, rng) {
  const sorted = [...candidates].sort((a, b) => a.difficulty - b.difficulty);
  const local = { ...st, usedShows: new Set(st.usedShows), usedSubjects: new Set(st.usedSubjects) };
  const picks = [];
  const taken = new Set();
  for (let r = 0; r < ROWS; r++) {
    const lo = Math.floor((r * sorted.length) / ROWS);
    const hi = Math.floor(((r + 1) * sorted.length) / ROWS);
    const band = sorted.slice(lo, Math.max(hi, lo + 1)).filter((c) => !taken.has(c));
    const hit = drawTiered(band, local, finish, rng);
    if (!hit) return null;
    taken.add(hit.source);
    // Spent per pick, not per column, so one column cannot take two of a
    // show's characters while other shows are left.
    spend(local, hit.clue);
    picks.push(hit.clue);
  }
  st.usedShows = local.usedShows;
  st.usedSubjects = local.usedSubjects;
  return { picks, taken };
}

// A topic's clues in an order that visits every show before any show twice:
// grouped by show, groups shuffled, then dealt round-robin. The quiz takes its
// queues in order, so this is its version of drawByShow.
function spreadByShow(clues, rng) {
  const groups = new Map();
  for (const c of shuffle(clues, rng)) {
    const s = showOf(c);
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s).push(c);
  }
  const lists = shuffle([...groups.values()], rng);
  const out = [];
  for (let i = 0; out.length < clues.length; i++) {
    for (const l of lists) if (i < l.length) out.push(l[i]);
  }
  return out;
}

// A comparison clue has no typed form; dealableTopics keeps its topics out of a
// typed deal, and this refuses one that arrives anyway rather than ship a
// "which of these" with nothing to choose from. The same for a line's ending
// (`choiceOnly` on the clue), which candidatesFor already leaves out.
const finisher = (ctx, choices, rng) => (clue) => {
  if (choices) return withChoices(ctx, clue, rng);
  return clue.compare || clue.choiceOnly ? null : clue;
};

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
 *
 * `recent` ({ ids, shows } Sets, from recent.js) is what this device dealt
 * lately; every draw prefers around it and the shows already on the board
 * (see `tiers`), never strictly.
 */
export function dealBoard(index, showKeys, {
  categories = 5, choices = true, dailyDouble = true, finalRound = true, topics = TOPICS, rng = Math.random,
  recent = null, portraits = null, lines,
} = {}) {
  const ctx = buildContext(index, showKeys, { portraits, lines });
  const finish = finisher(ctx, choices, rng);
  const st = spreadState(recent);
  const columns = [];
  const leftovers = [];

  // `topics` is the table's switched-on set (enabledTopics). Fewer of them than
  // `categories` simply deals a narrower board; the final draws from them too,
  // so a switched-off topic cannot sneak back in as the last question.
  for (const topic of shuffle(topics, rng)) {
    const pool = dedupeBySubject(candidatesFor(ctx, topic, { choices }), rng, st.recentIds);
    if (columns.length >= categories || pool.length < ROWS) {
      leftovers.push(...pool);
      continue;
    }
    const hit = ladder(pool, st, finish, rng);
    if (!hit) { leftovers.push(...pool); continue; }
    columns.push({
      id: topic.id,
      title: topic.title,
      clues: hit.picks.map((c, r) => ({ ...c, value: BOARD_VALUES[r] })),
    });
    leftovers.push(...pool.filter((c) => !hit.taken.has(c)));
  }

  if (columns.length < 2) return { error: 'not-enough' };

  // The final is a hard clue about a show the board did not already use —
  // otherwise the last question of the night is a re-run. "Hard" is the top
  // fifth of whatever is fresh, so a show the board spent is never the reason a
  // fresh one is passed over.
  let final = null;
  if (finalRound) {
    const freshShow = leftovers.filter((c) => !st.usedShows.has(showOf(c)));
    const freshSubject = leftovers.filter((c) => !st.usedSubjects.has(c.subject));
    const base = freshShow.length ? freshShow : freshSubject.length ? freshSubject : leftovers;
    const hard = [...base].sort((a, b) => b.difficulty - a.difficulty);
    const hit = drawTiered(hard.slice(0, Math.max(1, Math.ceil(hard.length / 5))), st, finish, rng)
      ?? drawTiered(hard, st, finish, rng);
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
  count = 10, choices = true, topics = TOPICS, rng = Math.random, recent = null, portraits = null, lines,
} = {}) {
  const ctx = buildContext(index, showKeys, { portraits, lines });
  const finish = finisher(ctx, choices, rng);
  const st = spreadState(recent);
  const queues = shuffle(topics, rng)
    .map((t) => spreadByShow(dedupeBySubject(candidatesFor(ctx, t, { choices }), rng, st.recentIds), rng))
    .filter((q) => q.length);
  // A quiz never asks about one subject twice, however small the pool — it is
  // short enough that a repeat would be noticed — so its tiers stop there.
  const prefs = tiers(st, { allowRepeatSubject: false });
  // The first clue in `q` the strongest possible tier accepts. A clue `finish`
  // rejects is dropped for good (it cannot make four options), and so is one
  // whose subject is spent, since no tier will take it again.
  const next = (q) => {
    for (const ok of prefs) {
      for (let i = 0; i < q.length;) {
        const c = q[i];
        if (st.usedSubjects.has(c.subject)) { q.splice(i, 1); continue; }
        if (!ok(c)) { i++; continue; }
        q.splice(i, 1);
        const done = finish(c);
        if (done) return done;
      }
    }
    return null;
  };
  const picks = [];
  while (picks.length < count && queues.some((q) => q.length)) {
    for (const q of queues) {
      if (picks.length >= count) break;
      const done = next(q);
      if (!done) continue;
      spend(st, done);
      picks.push(done);
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
    // Name That Character's portrait, and a comparison clue's values for the
    // reveal. Null on every other clue.
    image: typeof raw.image === 'string' && raw.image ? raw.image : null,
    detail: typeof raw.detail === 'string' && raw.detail ? raw.detail : null,
  };
}

export { asArray };
