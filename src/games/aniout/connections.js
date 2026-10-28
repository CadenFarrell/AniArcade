// What a round can be built on: the kinds of connection five characters can
// share and a sixth can lack, and how each one reads on screen.
//
// Every kind reads a card's `vals[kind]` (built once by utils/pool.js): an
// array of `{ key, label }` — `key` folded for comparison, `label` for the
// screen — or `null` when nothing on record says. Null is "unknown", never
// "none": a show whose studio nobody's list or the pack carries is not a show
// with no studio, and deal.js treats every unknown conservatively (see its
// header).
//
// Two tiers:
//   - `rule` kinds can be what a round is ABOUT;
//   - every kind, rule or not, is CHECKED, so a round is never dealt where a
//     second card is also out on something — gender most of all, which every
//     portrait gives away at a glance.
import { SOURCE_LABELS } from '../../shared/utils/mediaLabels';

// Phrased as what the five have in common, because that is the question the
// reason picker asks ("why are the other five together?"). Every one starts
// "All", which is also how the playtest bot tells a reason from a character.
const SOURCE_SENTENCES = {
  MANGA: 'All adapted from manga',
  LIGHT_NOVEL: 'All adapted from light novels',
  ORIGINAL: 'All original anime, with no source material',
  VISUAL_NOVEL: 'All adapted from visual novels',
  VIDEO_GAME: 'All adapted from video games',
};

const GENDER_SENTENCES = {
  female: 'All female characters',
  male: 'All male characters',
  'non-binary': 'All non-binary characters',
};

/**
 * The kinds, in a fixed order (tests and the deal iterate it).
 *
 * - `multi`: a card can hold several values at once (a show has many genres),
 *   so "shared" means the intersection rather than equality.
 * - `show`: a fact about the SHOW, not the character, so it is the same on
 *   every card from one show — which is why a show-level rule draws its five
 *   from five different shows, and why a same-show round ignores the others.
 * - `weight`: how often the deal reaches for it. Source has five values and
 *   most anime are manga, so "all manga" would come up every game; the show
 *   round is the easy one and is capped separately.
 * - `sentence(label)`: the reason as the picker and the reveal say it.
 */
export const KINDS = [
  { id: 'show', rule: true, show: true, weight: 1, sentence: (l) => `All from ${l}` },
  { id: 'studio', rule: true, show: true, weight: 3, sentence: (l) => `All animated by ${l}` },
  { id: 'year', rule: true, show: true, weight: 3, sentence: (l) => `All from shows that first aired in ${l}` },
  {
    id: 'source', rule: true, show: true, weight: 1,
    sentence: (l, key) => SOURCE_SENTENCES[key] ?? `All adapted from ${l.toLowerCase()}`,
  },
  { id: 'genre', rule: true, show: true, multi: true, weight: 2, sentence: (l) => `All from ${l} shows` },
  { id: 'tag', rule: true, show: true, multi: true, weight: 2, sentence: (l) => `All from shows tagged “${l}”` },
  { id: 'va', rule: true, weight: 3, sentence: (l) => `All voiced by ${l} in Japanese` },
  // Check-only. Gender is the one a table SEES, so a round where the odd one is
  // also the only man is a round with two answers — the deal refuses it.
  { id: 'gender', decoy: true, sentence: (l, key) => GENDER_SENTENCES[key] ?? `All ${l}` },
  { id: 'role', sentence: (l) => `All ${l.toLowerCase()} characters` },
  { id: 'format', show: true, sentence: (l) => `All ${l}` },
];

export const KIND = Object.fromEntries(KINDS.map((k) => [k.id, k]));
export const RULE_KINDS = KINDS.filter((k) => k.rule);

/** The reason sentence for one value of one kind. */
export const sentenceFor = (kindId, value) => KIND[kindId].sentence(value.label, value.key);

/** Folded for comparison: case, accents and stray whitespace never split a value. */
export const fold = (s) => String(s ?? '')
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

/** The source's word on a card ("Manga"); its sentence is SOURCE_SENTENCES'. */
export const sourceLabel = (key) => SOURCE_LABELS[key] ?? null;
