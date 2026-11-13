// The drawer's offer and the guess judge. Both run on the drawer's device only
// — locally the one device, online the drawer's phone (useSketchRoom) — so no
// guesser's device ever holds the character before the reveal.
//
// Pure, with an injectable rng, so a seed is a replay.
import { characterOwners, hasPortrait } from '../../shared/utils/characterPool';
import { characterNameKey } from '../../shared/utils/character';
import { fold, uniqueByWords, words } from '../../shared/utils/nameMatch';
import { shuffle } from '../../shared/utils/random';

/**
 * Every character the table could be offered, as characterPool's
 * `[{ entry, owners }]`: pictured ones only, because the reveal is the
 * portrait — "was that really her?" is answered by seeing her.
 */
export const sketchPool = (players) => characterOwners(players).filter((c) => hasPortrait(c.entry.imageUrl));

/**
 * The drawer's `count` choices, as `[{ key, name, series, imageUrl }]`, or
 * fewer when the lists are spent (never the same character twice a game:
 * `used` is every key already offered).
 *
 * Tiers, each shuffled, filled in order — a lean, never a filter:
 *   1. on the drawer's list AND someone else's (with `sharedFirst`): the
 *      drawer can draw them and somebody can name them;
 *   2. the rest of the drawer's list;
 *   3. anyone's (a drawer whose own list is spent, or who imported none, still
 *      gets a turn — they see the portrait before they draw).
 * Within a tier, characters this device dealt lately (`recent`) go last.
 */
export function offerChoices(players, drawerId, { count = 3, used = [], sharedFirst = true, recent = null } = {}, rng = Math.random) {
  const spent = new Set(used);
  const left = sketchPool(players).filter((c) => !spent.has(c.entry.id));
  const mine = left.filter((c) => c.owners.has(drawerId));
  const known = (c) => c.owners.size > 1;
  const tiers = sharedFirst
    ? [mine.filter(known), mine.filter((c) => !known(c)), left.filter((c) => !c.owners.has(drawerId))]
    : [mine, left.filter((c) => !c.owners.has(drawerId))];
  const out = [];
  for (const tier of tiers) {
    const fresh = (c) => !recent?.has(c.entry.id);
    const ordered = [...shuffle(tier.filter(fresh), rng), ...shuffle(tier.filter((c) => !fresh(c)), rng)];
    for (const { entry } of ordered) {
      if (out.length >= count) break;
      out.push({ key: entry.id, name: entry.name, series: entry.series ?? '', imageUrl: entry.imageUrl ?? '' });
    }
  }
  return out;
}

/**
 * Every character name the table's lists know, key → name: what a partial
 * guess is checked against, so "Uchiha" at a table that knows three Uchihas
 * names nobody.
 */
export function nameIndex(players) {
  return new Map(characterOwners(players).map(({ entry }) => [entry.id, entry.name]));
}

/**
 * Whether a typed guess names `character`: its full name in any order, or any
 * words of it that name exactly one character the table knows ("Kakashi" is
 * Kakashi Hatake) — the shared matcher (shared/utils/nameMatch.js), so a guess
 * is graded here exactly as AniChain and AniName grade one.
 */
export function isRightGuess(names, character, text) {
  const target = characterNameKey(character?.name);
  if (!target || !fold(text)) return false;
  if (characterNameKey(text) === target) return true;
  const typed = words(text);
  if (typed.length > 1 && [...typed].sort().join(' ') === [...words(character.name)].sort().join(' ')) return true;
  const entries = new Map(names ?? []);
  if (!entries.has(target)) entries.set(target, character.name);
  return uniqueByWords(typed, entries)?.key === target;
}
