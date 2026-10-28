// What a clue-giver may say and what a guess means: the banned list, the
// one-word check, and the guess judge.
//
// Pure. Every device builds the same cast index from the same profiles (the
// room's copies online) plus its own fact pack, so the dealing device can ship
// the banned list in the secret and the judging device can grade a guess
// without anything else travelling.
import { characterNameKey } from '../../shared/utils/character';
import { franchiseTitleKey } from '../../shared/utils/franchise';
import { resolveShowKey } from '../../shared/utils/facts';
import { fold, uniqueByWords, words } from '../../shared/utils/nameMatch';

/** A word is at most this long: no clue word is longer, and a pasted sentence is not one. */
export const MAX_WORD = 20;

// Words that sit inside titles and names but say nothing: banning "the" because
// the show is "The Promised Neverland" would leave the givers tongue-tied for
// no gain. Folded. Words of two letters or fewer are skipped as well ("no",
// "wa", "ga", "of" — the particles and joins of romanised titles).
const STOP = new Set([
  'the', 'and', 'for', 'from', 'with', 'into', 'are', 'was', 'not', 'you', 'your', 'our', 'his', 'her',
  'season', 'part', 'movie', 'film', 'final', 'new', 'two', 'three', 'second', 'third',
]);
const usable = (w) => w.length > 2 && !STOP.has(w);
// A typed word's letters and digits only, for comparing: "Naruto's" is "narutos".
const bare = (s) => fold(s).replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Every character and show the table's lists and the pack know, as far as a
 * cast goes:
 *
 *   shows:      showKey → { key, title, cast: Set<characterKey> }
 *   characters: characterKey → { key, name, shows: Set<showKey> }
 *
 * Narrower than AniName's buildIndex (no studios, years or genres), which is
 * why it is its own few lines rather than an import across games. List shows
 * go through resolveShowKey, so "Re:Zero Season 2" joins the pack's franchise.
 */
export function castIndex(players, pack = null) {
  const shows = new Map();
  const characters = new Map();
  const showOf = (key, title) => {
    if (!shows.has(key)) shows.set(key, { key, title: title || key, cast: new Set() });
    return shows.get(key);
  };
  const link = (showKey, title, name) => {
    const ck = characterNameKey(name);
    if (!ck) return;
    if (!characters.has(ck)) characters.set(ck, { key: ck, name, shows: new Set() });
    characters.get(ck).shows.add(showKey);
    showOf(showKey, title).cast.add(ck);
  };
  for (const p of players ?? []) {
    for (const a of p.animeList ?? []) {
      const key = resolveShowKey(pack, franchiseTitleKey(a.title));
      if (!key) continue;
      showOf(key, a.title);
      for (const c of a.characters ?? []) link(key, a.title, c?.name);
    }
  }
  for (const [key, row] of pack?.characters ?? []) {
    for (const sk of [...(row.appearsIn ?? []), ...(row.supportingIn ?? [])]) {
      link(sk, pack.shows?.get(sk)?.title, row.name ?? key);
    }
  }
  return { shows, characters, pack };
}

/** The show a character entry (characterPool's `series`) belongs to, as an index key. */
export const showKeyOf = (index, series) => resolveShowKey(index?.pack, franchiseTitleKey(series ?? ''));

/**
 * The words the givers may not say, as `[{ word, from }]` sorted for the card:
 * `from` is 'name' (the character's own), 'show' (the title — the list's and
 * the pack's spellings both) or 'cast' (anyone else in that show). One entry
 * per word, the first reason winning: a word in the name AND the title is
 * "name".
 */
export function bannedWords(index, character) {
  const out = new Map();
  const add = (text, from) => {
    for (const w of words(text)) if (usable(w) && !out.has(w)) out.set(w, from);
  };
  add(character?.name, 'name');
  const showKey = showKeyOf(index, character?.series);
  const show = index?.shows?.get(showKey);
  add(character?.series, 'show');
  add(show?.title, 'show');
  add(index?.pack?.shows?.get(showKey)?.title, 'show');
  // The franchise key itself is the title folded: it catches the season-less
  // spelling a list's "Season 3" entry hides.
  add(showKey, 'show');
  const self = characterNameKey(character?.name);
  for (const ck of show?.cast ?? []) {
    if (ck !== self) add(index.characters.get(ck)?.name, 'cast');
  }
  const order = { name: 0, show: 1, cast: 2 };
  return [...out].map(([word, from]) => ({ word, from }))
    .sort((a, b) => order[a.from] - order[b.from] || a.word.localeCompare(b.word));
}

const WHY = {
  name: 'is part of the name',
  show: 'is in the show’s title',
  cast: 'is a name from the same show',
};

/**
 * Whether `text` may go on the chain: `{ ok, word, reason }`. One word —
 * letters and digits, with a hyphen or apostrophe inside ("half-elf",
 * "it's") — and none of its parts banned. A part is banned when it IS a
 * banned word, or starts with one of four letters or more, so "Narutos" and
 * "Titans" are caught while a three-letter word does not ban every word it
 * begins.
 */
export function validWord(text, banned = []) {
  const word = String(text ?? '').trim();
  if (!word) return { ok: false, word, reason: 'Type a word.' };
  if (/\s/.test(word)) return { ok: false, word, reason: 'One word at a time.' };
  if (word.length > MAX_WORD) return { ok: false, word, reason: `At most ${MAX_WORD} letters.` };
  if (!/^[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*$/u.test(word)) {
    return { ok: false, word, reason: 'Letters and numbers only.' };
  }
  const parts = [bare(word), ...word.split(/['’-]/).map(bare)].filter(Boolean);
  for (const { word: b, from } of banned) {
    const hit = parts.some((p) => p === b || (b.length >= 4 && p.startsWith(b)));
    if (hit) return { ok: false, word, reason: `“${word}” ${WHY[from] ?? 'is off limits'}.` };
  }
  return { ok: true, word, reason: null };
}

/**
 * Whether a typed guess names `character`. Its full name in any order, or any
 * words of it that name exactly one character the table knows — "Kakashi" is
 * Kakashi Hatake, but "Uchiha" at a table that knows three Uchihas is not
 * anyone (shared/utils/nameMatch.js).
 */
export function isRightGuess(index, character, text) {
  const target = characterNameKey(character?.name);
  if (!target || !fold(text)) return false;
  if (characterNameKey(text) === target) return true;
  const typed = words(text);
  const entries = new Map([...(index?.characters ?? new Map())].map(([k, c]) => [k, c.name]));
  if (!entries.has(target)) entries.set(target, character.name);
  return uniqueByWords(typed, entries)?.key === target;
}
