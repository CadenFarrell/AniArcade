// Matching a typed name to one on record. Lifted out of AniName's answers.js
// when AniChain needed the same "Kakashi is Kakashi Hatake, Uchiha is nobody"
// rule for its guesses — two copies of a name matcher would grade the same
// guess two ways.
//
// Pure.
import { characterNameKey } from './character';

/** A name folded the way every identity in the arcade is (characterNameKey). */
export const fold = (s) => characterNameKey(String(s ?? ''));

// Punctuation splits words rather than joining them: "Frieren:" is "frieren",
// "Journey's" is "journey s", so a typed word meets a title's word as itself.
export const words = (s) => fold(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(' ').filter(Boolean);

/**
 * The one entry in `entries` (key → label) whose words include every typed
 * word, or null when none or several do: "Kakashi" is Kakashi Hatake in
 * Naruto's cast, but "Uchiha" is three people and nothing guesses which.
 * Words of one letter are ignored, so an initial never narrows anything.
 * `typed` is already split (`words(text)`).
 */
export function uniqueByWords(typed, entries) {
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
