// Repairs a saved profile's numbers from the fact pack, so a list imported
// before the stats existed plays every mode without a re-import.
//
// The stats arrived after the first games did (see CLAUDE.md's profiles table),
// so they are ABSENT, not null, on any profile imported before them — and
// AniRank's popularity and score axes, AniTune's popularity filter and AniFake's
// fame setting all switch themselves off below a coverage floor. A re-import
// fixes that, but only for someone who knows to do it, and never for a seed or
// hand-entered profile with no AniList list behind it. The pack carries the same
// numbers for its few hundred shows, folded by the same rule an import uses (see
// facts.js's FACT_FIELDS), so filling from it is a repair rather than a guess.
//
// Pure, for prefs.js's and fame.js's reason: a .test.js checks it directly.
// usePackBackfill.js is the half that loads the pack and writes the result.
import { franchiseTitleKey } from './franchise';
import { characterNameKey } from './character';
import { resolveShowKey } from './facts';

// Filled only when ABSENT (`== null`), backfillStats' rule: a value an import
// stored is newer than the pack's snapshot, and a real 0 is an answer.
function showPatch(entry, show) {
  const patch = {};
  if (entry.popularity == null && show.popularity != null) patch.popularity = show.popularity;
  if (entry.averageScore == null && show.averageScore != null) patch.averageScore = show.averageScore;
  // A profile's startDate is a FuzzyDate. The year is the only part any reader
  // uses (AniRank's year axis), and the only part the pack carries.
  if (entry.startDate?.year == null && show.startYear != null) {
    patch.startDate = { ...(entry.startDate ?? {}), year: show.startYear };
  }
  return patch;
}

// Character favourites are the exception to "absent only": the import writes
// `favourites ?? 0`, so a stored 0 means "never measured" at least as often as
// "nobody has heard of them" — the ambiguity AniFake's fameFloor already treats
// as unmeasured. A positive pack value can only be the better answer.
//
// Only a character the pack places in THIS show: names are the identity here
// (characterNameKey), and two different people called "Ymir" in two different
// franchises must not lend each other a favourites count.
function repairCharacters(characters, packChars, showKey) {
  let changed = 0;
  const next = (characters ?? []).map((c) => {
    if ((c?.favourites ?? 0) > 0) return c;
    const hit = packChars.get(characterNameKey(c?.name ?? ''));
    const here = hit && [...(hit.appearsIn ?? []), ...(hit.supportingIn ?? [])].includes(showKey);
    const fav = here ? hit.favourites : null;
    if (!(fav > 0)) return c;
    changed++;
    return { ...c, favourites: fav };
  });
  return { characters: changed ? next : characters, changed };
}

/**
 * Returns { profile, changed }. `profile` is the SAME object when nothing
 * changed, and a new one otherwise — never a mutation, because the objects in
 * a profile are the ones ProfileProvider holds in React state (the reason
 * profileMerge.js's addOrBackfillCharacter returns new objects too).
 *
 * `pack` is the indexed pack loadFactPack resolves to.
 */
export function backfillProfileFromPack(profile, pack) {
  const list = profile?.animeList;
  if (!Array.isArray(list) || !pack?.shows) return { profile, changed: 0 };

  let changed = 0;
  const animeList = list.map((entry) => {
    if (!entry) return entry;
    const key = resolveShowKey(pack, franchiseTitleKey(entry.title ?? ''));
    const show = pack.shows.get(key);
    if (!show) return entry;
    const patch = showPatch(entry, show);
    const chars = repairCharacters(entry.characters, pack.characters ?? new Map(), key);
    const fields = Object.keys(patch).length;
    if (!fields && !chars.changed) return entry;
    changed += fields + chars.changed;
    return { ...entry, ...patch, characters: chars.characters };
  });

  return changed ? { profile: { ...profile, animeList }, changed } : { profile, changed: 0 };
}
