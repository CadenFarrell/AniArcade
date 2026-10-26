// Who can be hidden under the tiles, and who can stand beside them as a wrong
// answer. Built on shared/utils/characterPool.js — the one collapse AniFake and
// AniTurf already share — so "the same person under three season titles is
// one character" means the same thing here as there.
import { characterOwners } from '../../../shared/utils/characterPool';
import { characterNameKey } from '../../../shared/utils/character';
import { portraitsFor } from '../../../shared/utils/portrait';

// AniList's stand-in for a character with no picture is a real image at a real
// URL ("…/character/large/default.jpg"), so a non-empty imageUrl is not enough:
// a round under that would be sixteen tiles over a grey silhouette.
const PLACEHOLDER = /\/default\.(jpe?g|png|webp)$/i;

export const hasPortrait = (url) => typeof url === 'string' && url.trim() !== '' && !PLACEHOLDER.test(url.trim());

/**
 * Every character a round can be dealt: one per person across the table's
 * lists, with a real portrait. With `sharedOnly`, only characters on every
 * seated player's list — the fair pool, and usually a small one.
 *
 * **Never a character a player is wearing.** Every seat's face is a character
 * from its own list (portraitsFor), drawn whole in the score row above the
 * board all round — dealt under the tiles, the answer would be on screen the
 * entire time. Leaving those out here, rather than in the deal, keeps the
 * setup screen's count the same number the deal draws from.
 *
 * Returns `{ entry, owners }` rows (characterOwners' shape), so the deal can
 * lean toward characters more of the table knows.
 */
export function portraitPool(players, { sharedOnly = false } = {}) {
  const seated = players ?? [];
  const worn = new Set([...portraitsFor(seated).values()]
    .filter(Boolean)
    .map((face) => characterNameKey(face.name)));
  return characterOwners(seated).filter(({ entry, owners }) =>
    hasPortrait(entry.imageUrl)
    && !worn.has(entry.id)
    && (!sharedOnly || owners.size === seated.length));
}

/**
 * Every character the table's lists hold, portrait or not, with gender — the
 * field characterOwners does not carry, and the one the wrong answers are
 * matched on after the show. Feeds the multiple-choice options and the typed
 * box's suggestions: a wrong answer needs no picture.
 */
export function everyCharacter(players) {
  const gender = new Map();
  for (const p of players ?? []) {
    for (const anime of p.animeList ?? []) {
      for (const c of anime.characters ?? []) {
        const key = characterNameKey(c?.name);
        if (key && c.gender && !gender.has(key)) gender.set(key, c.gender);
      }
    }
  }
  return characterOwners(players).map(({ entry }) => ({
    key: entry.id,
    name: entry.name,
    series: entry.series,
    gender: gender.get(entry.id) ?? '',
  }));
}
