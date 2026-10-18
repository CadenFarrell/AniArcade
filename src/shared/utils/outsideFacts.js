// The pure half of the two outside fact sources (pack-v5): what an AnimeThemes
// or Wikidata response means, as a pack value. The fetching and caching live in
// factSources/animethemes.js and factSources/wikidata.js; this is the part that
// can be wrong in a way a test can catch, and a root-level script has no tests.
//
// Both sources only ADD — themes, and the source work's magazine and publisher —
// and run after AniList's adapter, so where they overlap with AniList (a
// Wikidata author against AniList's "Original Creator" credit, a Wikidata start
// year against the source work's AniList entry) the generator's first-write-wins
// keeps AniList's. Neither source decides what a
// show IS: each is looked up by the AniList ids collect() already grouped into a
// franchise, so a theme or a magazine lands on exactly the pack key a profile
// folds to.
//
// Explicit .js extensions throughout, for facts.js's reason: generateFacts.js
// imports this under plain Node.
import { THEME_TYPES } from './facts.js';

// Per franchise, across its seasons. One Piece alone has 26 openings, and a pack
// carrying every one of them would spend a few hundred KB on songs nobody at the
// table could tell apart. The first few of each kind, canonical season first, are
// the ones people actually know — the franchise-defining opening is almost
// always among them.
export const MAX_OPENINGS = 4;
export const MAX_ENDINGS = 2;
const CAP = { OP: MAX_OPENINGS, ED: MAX_ENDINGS };

const filled = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

// Loose enough that "Gurenge" and "gurenge " are one song, and that Wikidata's
// "Weekly Shōnen Jump" and "Weekly Shonen Jump" — two labels the same query can
// return for one magazine — count as one value rather than a disagreement.
const fold = (s) => String(s ?? '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

// AnimeThemes numbers themes with `sequence`, and leaves it null when a show has
// only one of that kind (Demon Slayer's lone "OP1"). Null sorts LAST, so a lone
// theme is still first and an unnumbered stray beside numbered ones can never
// displace OP1–OP4.
const seqOf = (t) => (Number.isInteger(t?.sequence) ? t.sequence : Infinity);

// AnimeThemes files alternate versions of a show's themes as a theme `group`,
// numbered from 1 again, and the groups are two different things (measured over
// every group in the catalog):
//
//  - a DUB — "English Version", "English Version - 4Kids", "Korean Version".
//    Not the show's themes in any sense a table means: read as ordinary ones,
//    they put the 4Kids "One Piece Theme" among One Piece's openings and
//    "Gotta Catch 'em All" among Pokémon's. Dropped.
//  - a Japanese broadcast variant — "BD Version", "TV Version", "Repeat Show",
//    "NoitaminA Broadcast", "Yorinuki Gintama-san". Real songs of that show
//    (Soul Eater's rerun opening, Gintama's compilation-broadcast ones), so they
//    are kept — but ranked after the group-less themes, so they only fill the
//    cap when the main sequence runs short.
const DUB_GROUP = /\b(english|korean|chinese|mandarin|cantonese|spanish|french|german|italian|portuguese|dub)\b/i;
const groupRank = (t) => (t?.group ? 1 : 0);
const isDub = (t) => DUB_GROUP.test(t?.group ?? '');

/**
 * A franchise's theme songs, from the AnimeThemes anime records of its seasons.
 *
 * `perMember` is one array of AnimeThemes `anime` records per franchise member,
 * in collect()'s order (canonical season first, then by air date) — each record
 * as returned with `include=animethemes.group,animethemes.song.artists`, with a
 * theme's `group` reduced to its name (null for the show's own). Returns the pack's
 * `themes` value, or null when nothing usable was found.
 *
 * Within a season, openings and endings each run in sequence order; across
 * seasons the canonical one fills first. A song used twice (a franchise that
 * reuses its opening in a sequel) is kept once. Insert songs (`IN`) are not
 * themes in the sense a table means.
 */
export function themesFromAnimeThemes(perMember) {
  const out = [];
  const count = { OP: 0, ED: 0 };
  const seen = new Set();
  for (const records of perMember ?? []) {
    for (const anime of records ?? []) {
      const themes = (anime?.animethemes ?? [])
        .filter((t) => THEME_TYPES.includes(t?.type) && !isDub(t))
        .sort((a, b) => THEME_TYPES.indexOf(a.type) - THEME_TYPES.indexOf(b.type)
          || groupRank(a) - groupRank(b)
          || seqOf(a) - seqOf(b));
      for (const t of themes) {
        if (count[t.type] >= CAP[t.type]) continue;
        const song = filled(t.song?.title);
        if (!song) continue;
        const id = `${t.type}|${fold(song)}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const artists = [];
        for (const a of t.song?.artists ?? []) {
          const name = filled(a?.name);
          if (name && !artists.some((x) => fold(x) === fold(name))) artists.push(name);
        }
        out.push(artists.length ? { type: t.type, song, artists } : { type: t.type, song });
        count[t.type]++;
      }
    }
  }
  return out.length ? out : null;
}

// Which Wikidata work types count as which AniList source. Matched on the
// English label of the work's `instance of` (P31), because the same thing is
// typed half a dozen ways on Wikidata ("manga series", "manga", "light novel
// series"…) and a label match covers them all without a list of item ids to
// keep current.
const KIND_FOR_SOURCE = {
  MANGA: /\bmanga\b/i,
  LIGHT_NOVEL: /\blight novel\b/i,
};

const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

// The single value a list agrees on, or null. "Agrees" is by fold, so two
// spellings of one magazine are one value; two genuinely different values
// (Fullmetal Alchemist's magazine publisher is listed as both Enix and Square Enix)
// are a disagreement, and a clue whose answer the source cannot settle is not a
// clue worth asking.
function agreed(values) {
  const distinct = new Map();
  for (const v of values ?? []) {
    const name = filled(v);
    if (name && !distinct.has(fold(name))) distinct.set(fold(name), name);
  }
  return distinct.size === 1 ? [...distinct.values()][0] : null;
}

/**
 * The source work's facts for ONE anime, from the Wikidata rows found for it.
 *
 * `rows` are the works the anime (or the series it belongs to) is based on, one
 * per work: `{ types, magazines, magazinePublishers, publishers, authors, start }`
 * where every list is the English labels Wikidata returned and `publishers` has
 * already been limited to Japanese ones (the work's other publishers are its
 * licensees — Viz, Yen Press — and are not "who published it"). `source` is
 * AniList's source for the show.
 *
 * Returns `{ serializedIn?, originalPublisher?, originalYear?, author? }`, empty
 * when nothing matches. Only works of the KIND AniList names count: an anime
 * AniList calls a manga adaptation never gets a novel's publisher, so a clue
 * that says "the manga" is about a manga.
 */
export function originFromWikidata(rows, source) {
  const kind = KIND_FOR_SOURCE[source];
  if (!kind) return {};
  const works = (rows ?? []).filter((r) => (r?.types ?? []).some((t) => kind.test(t)));
  if (!works.length) return {};

  // Several matching works (a manga and its sequel manga, say) keep only what
  // they all agree on, by agreed()'s rule.
  const out = {};
  if (source === 'MANGA') {
    const magazine = agreed(works.flatMap((w) => w.magazines ?? []));
    if (magazine) {
      out.serializedIn = magazine;
      // A manga's publisher is its magazine's — the work's own publisher list
      // is every country's licensee plus the tankōbon imprint ("Jump Comics").
      const publisher = agreed(works.flatMap((w) => w.magazinePublishers ?? []));
      if (publisher) out.originalPublisher = publisher;
    }
  } else {
    const publisher = agreed(works.flatMap((w) => w.publishers ?? []));
    if (publisher) out.originalPublisher = publisher;
  }

  const years = works
    .map((w) => Number(String(w.start ?? '').slice(0, 4)))
    .filter((y) => Number.isInteger(y) && y >= YEAR_MIN && y <= YEAR_MAX);
  if (years.length) out.originalYear = Math.min(...years);

  const author = agreed(works.flatMap((w) => w.authors ?? []));
  if (author) out.author = author;
  return out;
}
