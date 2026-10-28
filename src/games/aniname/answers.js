// What counts as a right answer: the table's lists and the fact pack folded into
// one index, the categories it can answer for, and the judge that grades one
// typed name.
//
// Pure. Every device in a room builds the same index from the same room copies
// of the profiles plus its own pack, so the deal only has to carry a category
// (`{ kind, key, label }`), never its answers — a genre's answer set can run to
// hundreds of shows, which is not something to copy into every room.
//
// **Three verdicts, not two.** Our data is a slice of anime: a list holds the
// shows its player imported, a cast is the ~60 best-known characters, and the
// pack covers ~1000 popular shows. So a name is:
//   - 'right'   — the index says it belongs;
//   - 'wrong'   — the index KNOWS it and knows it does not belong (Kakashi is
//                 in our data and not in One Piece's cast; a show we know was
//                 animated by Bones is not a MAPPA show);
//   - 'pending' — the index has never heard of it, or cannot say. The table
//                 decides those after the clock (rules.js's review phase), so a
//                 real answer is never lost to a gap in the data.
// Tags are the one fact that never says 'wrong': the pack keeps a show's top
// few tags only, so a show without "Isekai" on file may still be an isekai.
import { characterNameKey } from '../../shared/utils/character';
import { franchiseTitleKey } from '../../shared/utils/franchise';
import { resolveShowKey } from '../../shared/utils/facts';

const filled = (s) => typeof s === 'string' && s.trim() !== '';
const fold = (s) => characterNameKey(String(s ?? ''));
// Punctuation splits words rather than joining them: "Frieren:" is "frieren",
// "Journey's" is "journey s", so a typed word meets a title's word as itself.
const words = (s) => fold(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(' ').filter(Boolean);
const titleCase = (key) => key.replace(/\b\w/g, (c) => c.toUpperCase());

// AniList tags that describe a show's cast make-up or rating rather than what
// it is about ("Name 5 anime tagged “Heterosexual”"). Folded names.
const TAG_SKIP = new Set([
  'heterosexual', 'primarily teen cast', 'primarily adult cast', 'primarily child cast',
  'primarily female cast', 'primarily male cast', 'episodic', 'nudity', 'cgi', 'full cgi',
]);

/**
 * The index: every show and character the table's lists and the pack know.
 *
 *   shows:      key → { key, title, studio, studioKey, year, genres: Map, tags: Map | null, owners: Set }
 *   characters: key → { key, name, cast: Set<showKey>, mains: Set<showKey> }
 *
 * List entries are keyed through resolveShowKey, so a player's "Re:Zero Season
 * 2" joins the pack's canonical franchise. `owners` is who at the table holds
 * the show, which the deal leans on.
 */
export function buildIndex(players, pack = null) {
  const shows = new Map();
  const characters = new Map();
  const showOf = (key, title) => {
    if (!shows.has(key)) {
      shows.set(key, { key, title: title || titleCase(key), studio: null, studioKey: null, year: null, genres: new Map(), tags: null, owners: new Set() });
    }
    return shows.get(key);
  };
  const charOf = (key, name) => {
    if (!characters.has(key)) characters.set(key, { key, name: name || titleCase(key), cast: new Set(), mains: new Set() });
    return characters.get(key);
  };
  const setStudio = (s, studio) => {
    if (s.studioKey == null && filled(studio)) { s.studio = studio.trim(); s.studioKey = fold(studio); }
  };
  const setYear = (s, year) => {
    if (s.year == null && Number.isInteger(Number(year)) && Number(year) > 0) s.year = Number(year);
  };
  const addGenres = (s, list) => {
    for (const g of list ?? []) if (filled(g) && !s.genres.has(fold(g))) s.genres.set(fold(g), g.trim());
  };

  // The lists first: they are the shows the table actually holds, and their
  // titles are the ones the table knows them by.
  for (const p of players ?? []) {
    for (const a of p.animeList ?? []) {
      const key = resolveShowKey(pack, franchiseTitleKey(a.title));
      if (!key) continue;
      const s = showOf(key, a.title);
      s.owners.add(p.id);
      setStudio(s, a.studio);
      // The debut year, the import's fold (earliest season).
      setYear(s, a.seasonYear ?? a.startDate?.year);
      for (const c of a.characters ?? []) {
        const ck = characterNameKey(c?.name);
        if (!ck) continue;
        const ch = charOf(ck, c.name);
        ch.cast.add(key);
        if (/main/i.test(c.role ?? '')) ch.mains.add(key);
        // Genres are the show's, copied onto each character at import.
        addGenres(s, c.genres ?? (c.genre ? [c.genre] : []));
      }
    }
  }

  // Then the pack, filling what the lists lack and adding the shows nobody
  // imported — those can still be named.
  for (const [key, row] of pack?.shows ?? []) {
    const s = showOf(key, row.title);
    setStudio(s, row.studio);
    setYear(s, row.startYear ?? row.seasonYear);
    addGenres(s, row.genres);
    if (row.tags?.length) {
      s.tags = new Map(row.tags.filter((t) => filled(t) && !TAG_SKIP.has(fold(t))).map((t) => [fold(t), t.trim()]));
    }
  }
  for (const [key, row] of pack?.characters ?? []) {
    const ch = charOf(key, row.name);
    for (const sk of row.appearsIn ?? []) { ch.cast.add(sk); ch.mains.add(sk); }
    for (const sk of row.supportingIn ?? []) ch.cast.add(sk);
  }
  return { shows, characters, pack };
}

// ── Categories ────────────────────────────────────────────────────────────

/**
 * The kinds. `of` says whether answers are characters or shows; `sentence` is
 * the category as "Name 6 ___" ends; `min` is the fewest known answers a
 * category needs before it is dealt, so a bid has room above it.
 */
export const KINDS = {
  cast: { of: 'characters', min: 6, weight: 3, sentence: (l) => `characters from ${l}` },
  mains: { of: 'characters', min: 4, weight: 1, sentence: (l) => `main characters from ${l}` },
  studio: { of: 'shows', min: 5, weight: 2, sentence: (l) => `anime animated by ${l}` },
  year: { of: 'shows', min: 6, weight: 2, sentence: (l) => `anime that first aired in ${l}` },
  genre: { of: 'shows', min: 8, weight: 1, sentence: (l) => `${l} anime` },
  tag: { of: 'shows', min: 5, weight: 1, sentence: (l) => `anime tagged “${l}”` },
};

/** The answers a category has on record, as key → label. */
export function answersFor(index, cat) {
  const out = new Map();
  if (!index || !cat) return out;
  if (cat.kind === 'cast' || cat.kind === 'mains') {
    const field = cat.kind === 'cast' ? 'cast' : 'mains';
    for (const ch of index.characters.values()) if (ch[field].has(cat.key)) out.set(ch.key, ch.name);
    return out;
  }
  for (const s of index.shows.values()) {
    if (cat.kind === 'studio' ? s.studioKey === cat.key
      : cat.kind === 'year' ? String(s.year) === cat.key
        : cat.kind === 'genre' ? s.genres.has(cat.key)
          : cat.kind === 'tag' ? Boolean(s.tags?.has(cat.key)) : false) {
      out.set(s.key, s.title);
    }
  }
  return out;
}

/**
 * Every category the table's own lists suggest, with how many answers each has
 * on record and how many players hold a show behind it. Only categories rooted
 * in shows somebody here imported: "anime animated by Shaft" is a fair ask of a
 * table that watched one, and a stranger's studio is not.
 */
export function categoriesFor(index) {
  const out = new Map(); // `${kind}:${key}` → cat
  const add = (kind, key, label, owners) => {
    const id = `${kind}:${key}`;
    const cat = out.get(id) ?? { kind, key, label, owners: new Set() };
    for (const o of owners) cat.owners.add(o);
    out.set(id, cat);
  };
  for (const s of index.shows.values()) {
    if (!s.owners.size) continue;
    add('cast', s.key, s.title, s.owners);
    add('mains', s.key, s.title, s.owners);
    if (s.studioKey) add('studio', s.studioKey, s.studio, s.owners);
    if (s.year) add('year', String(s.year), String(s.year), s.owners);
    for (const [g, label] of s.genres) add('genre', g, label, s.owners);
    for (const [t, label] of s.tags ?? []) add('tag', t, label, s.owners);
  }
  return [...out.values()]
    .map((cat) => ({ ...cat, owners: cat.owners.size, known: answersFor(index, cat).size }))
    .filter((cat) => cat.known >= KINDS[cat.kind].min);
}

/** "characters from Naruto" — what follows "Name 6". */
export const categoryText = (cat) => (cat && KINDS[cat.kind] ? KINDS[cat.kind].sentence(cat.label) : '');

// ── The judge ─────────────────────────────────────────────────────────────

// The one entry in `entries` (key → label) whose words include every typed
// word, or null when none or several do: "Kakashi" is Kakashi Hatake in
// Naruto's cast, but "Uchiha" is three people and the judge will not guess.
// Words of one letter are ignored, so an initial never narrows anything.
function uniqueByWords(typed, entries) {
  const want = typed.filter((w) => w.length > 1);
  if (!want.length) return null;
  let hit = null;
  for (const [key, label] of entries) {
    const have = new Set(words(label));
    if (want.every((w) => have.has(w))) {
      if (hit) return null;
      hit = { key, label };
    }
  }
  return hit;
}

/**
 * Grades one typed answer against a category. Returns
 * `{ verdict: 'right' | 'wrong' | 'pending', key, label, why? }`, where `key`
 * is what two answers are the same answer by (the duplicate check in rules.js)
 * and `label` is how the answer list shows it — the name on record when the
 * judge recognised it, the typed text when it did not.
 */
export function judgeName(index, cat, text) {
  const typed = String(text ?? '').trim();
  const answers = answersFor(index, cat);
  const pending = { verdict: 'pending', key: `?${fold(typed)}`, label: typed };
  if (!fold(typed)) return { ...pending, verdict: 'wrong', why: 'blank' };

  if (KINDS[cat.kind]?.of === 'characters') {
    const key = characterNameKey(typed);
    if (answers.has(key)) return { verdict: 'right', key, label: answers.get(key) };
    const hit = uniqueByWords(words(typed), answers);
    if (hit) return { verdict: 'right', ...hit };
    // Wrong only on a FULL name we know: a character on record elsewhere.
    // A first name alone that matches someone outside the show stays pending —
    // casts are partial, and the table knows who was meant.
    const known = index.characters.get(key);
    if (known) {
      const why = cat.kind === 'mains' && known.cast.has(cat.key) ? 'not a main character' : 'not in this show';
      return { verdict: 'wrong', key, label: known.name, why };
    }
    return pending;
  }

  const key = resolveShowKey(index.pack, franchiseTitleKey(typed));
  if (answers.has(key)) return { verdict: 'right', key, label: answers.get(key) };
  // A title is often typed short ("Frieren" for "Frieren: Beyond Journey's
  // End"); every typed word in exactly one answer's title is that answer.
  const hit = uniqueByWords(words(typed), answers);
  if (hit) return { verdict: 'right', ...hit };
  // Not an answer by any spelling: which show was meant? The exact key, else a
  // short title that names exactly one show we know ("Frieren" is "Frieren:
  // Beyond Journey's End") — judged on that show's facts below.
  let show = index.shows.get(key);
  if (!show && fold(typed).replace(/\s/g, '').length >= 4) {
    const guess = uniqueByWords(words(typed), [...index.shows.values()].map((s) => [s.key, s.title]));
    show = guess ? index.shows.get(guess.key) : null;
  }
  if (!show) return pending;
  // A show we know, judged on the one fact the category is about — and only
  // when that fact is on record. Tags never say no (see the header).
  const wrong = { verdict: 'wrong', key: show.key, label: show.title };
  if (cat.kind === 'studio' && show.studioKey) return { ...wrong, why: `animated by ${show.studio}` };
  if (cat.kind === 'year' && show.year) return { ...wrong, why: `first aired in ${show.year}` };
  if (cat.kind === 'genre' && show.genres.size) return { ...wrong, why: 'not listed in that genre' };
  return { ...pending, key: show.key, label: show.title };
}
