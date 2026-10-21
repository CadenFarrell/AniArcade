// Every character a table's lists hold, one entry per person, with who holds
// them. Lifted out of AniFake's utils/pool.js when AniTurf needed the same
// collapse plus the owner count AniFake only used to filter by: two copies of
// "which duplicate wins" is exactly the kind that drifts.
//
// Entry shape:
//
//   { id, name, series, imageUrl, role, favourites, genres }
//
// Pure and offline: every field it reads is already on a saved profile.
import { characterNameKey, normalizeCharacter } from './character';

// Which of two copies of the same character to keep. The highest favourites
// count is the one mergeCharacterEdges already settled on across seasons, and a
// copy with a portrait beats one without, since a card is mostly the
// portrait. Applied BOTH within one profile and across profiles — two players
// can hold the same character at different import vintages, and picking by
// favourites alone there would let a portrait-less copy win.
//
// Genres rank above favourites for the same reason they are on the entry at
// all: the two shapes stored data comes in (an AniList `genres` array, the
// singular `genre` of an older hand-made character) mean one player's copy of
// a character can carry genres while another's carries none, and the copy with
// none deals AniFake's blind fake a blank.
export function preferred(existing, candidate) {
  if (!existing) return candidate;
  if (!existing.imageUrl && candidate.imageUrl) return candidate;
  if (existing.imageUrl && !candidate.imageUrl) return existing;
  if (!existing.genres.length && candidate.genres.length) return candidate;
  if (existing.genres.length && !candidate.genres.length) return existing;
  return (candidate.favourites ?? 0) > (existing.favourites ?? 0) ? candidate : existing;
}

// One entry per character, keyed by folded name so the same person listed under
// three season titles is one card — the same identity rule AniGuess and AniRank
// use, and the reason ids are not used (AniList ids and the Date.now() ids
// ListManager's old hand-made entries carry share no id space).
//
// That folded name is also what `id` holds, which is what makes it the key
// AniFake's deriveTruth groups published cards by. The name IS the identity end
// to end.
export function collapseCharacters(animeList) {
  const byName = new Map();
  for (const anime of animeList || []) {
    for (const raw of anime.characters || []) {
      // normalizeCharacter first, so a hand-made singular `genre` string is
      // already an array by the time anything here reads it.
      const char = normalizeCharacter(raw);
      const key = characterNameKey(char?.name);
      if (!key) continue;
      byName.set(key, preferred(byName.get(key), {
        id: key,
        name: char.name,
        series: anime.title || '',
        imageUrl: char.imageUrl || '',
        role: char.role || '',
        favourites: char.favourites ?? 0,
        genres: char.genres ?? [],
      }));
    }
  }
  return byName;
}

/**
 * Every character any seated player holds, as `{ entry, owners }` where
 * `owners` is the Set of player ids whose list has them. AniFake filters on
 * `owners.size === players.length` ("shared characters only"); AniTurf weights
 * its board toward characters more of the table knows.
 */
export function characterOwners(players) {
  const counts = new Map(); // key -> { entry, owners }
  for (const player of players || []) {
    for (const [key, entry] of collapseCharacters(player.animeList)) {
      if (!counts.has(key)) counts.set(key, { entry, owners: new Set() });
      const slot = counts.get(key);
      slot.owners.add(player.id);
      slot.entry = preferred(slot.entry, entry);
    }
  }
  return [...counts.values()];
}
