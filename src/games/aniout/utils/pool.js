// Every character a round can be dealt, with everything the connections read.
//
// Built on shared/utils/characterPool.js — the collapse AniFake, AniTurf and
// AniPeek share — so "the same person under three season titles is one
// character" means the same thing here. On top of that each card carries
// `vals`: one `{ key, label }[] | null` per kind in connections.js.
//
// **The player's own import first, then the fact pack** — AniPeek's hintsFor
// order. The import is the show THEY listed and is on the device with no pack
// at all; but lists imported before the show stats existed carry no studio,
// source or format, and the playtest fixtures carry none of them, so the pack
// fills what it can. Tags and Japanese voice actors exist only in the pack
// (~680 popular shows): a round about either is only ever dealt from shows it
// covers, because a card missing the value is not eligible (connections.js).
import { characterOwners, hasPortrait } from '../../../shared/utils/characterPool';
import { characterNameKey } from '../../../shared/utils/character';
import { franchiseTitleKey } from '../../../shared/utils/franchise';
import { resolveShowKey } from '../../../shared/utils/facts';
import { FORMAT_NOUNS, SOURCE_LABELS } from '../../../shared/utils/mediaLabels';
import { fold } from '../connections';

const filled = (s) => typeof s === 'string' && s.trim() !== '';

// AniList tags that describe the cast's makeup or a show's content rating
// rather than what it is about. As a round's reason they read as a census
// ("All from shows tagged “Heterosexual”"), and the cast ones half-overlap the
// gender check. Folded names.
const TAG_SKIP = new Set([
  'heterosexual', 'primarily teen cast', 'primarily adult cast', 'primarily child cast',
  'primarily female cast', 'primarily male cast', 'episodic', 'nudity', 'cgi', 'full cgi',
]);
const one = (key, label) => [{ key, label }];
const many = (labels) => {
  const seen = new Map();
  for (const l of labels ?? []) if (filled(l) && !seen.has(fold(l))) seen.set(fold(l), { key: fold(l), label: l.trim() });
  return seen.size ? [...seen.values()] : null;
};

// AniList says Male / Female / Non-binary; a missing one is stored 'Unknown',
// and a hand-made character can hold anything. Only the three real values are
// a fact.
const GENDERS = new Set(['male', 'female', 'non-binary']);
function genderVal(raw) {
  const key = fold(raw);
  return GENDERS.has(key) ? one(key, raw.trim()) : null;
}

// Stored 'Main' / 'Supporting' by the import, MAIN / SUPPORTING by the pack and
// anything at all by an old hand-made character (AniFake matches /main/i too).
function roleVal(raw) {
  if (/main/i.test(raw ?? '')) return one('main', 'Main');
  if (/support/i.test(raw ?? '')) return one('supporting', 'Supporting');
  return null;
}

// The show's facts from every seated list that holds it, the first filled value
// winning per field — two players can hold the same show at different import
// vintages, and the newer one may be the only one with a studio.
function listFacts(players) {
  const byShow = new Map();
  for (const p of players) {
    for (const a of p.animeList ?? []) {
      const key = franchiseTitleKey(a.title);
      if (!key) continue;
      const facts = byShow.get(key) ?? {};
      for (const f of ['studio', 'format', 'source', 'seasonYear']) {
        if (facts[f] == null && a[f] != null && a[f] !== '') facts[f] = a[f];
      }
      if (facts.startYear == null && Number.isInteger(a.startDate?.year)) facts.startYear = a.startDate.year;
      byShow.set(key, facts);
    }
  }
  return byShow;
}

// Gender lives on the raw character, which characterOwners does not carry
// (AniPeek's everyCharacter re-attaches it the same way).
function rawGenders(players) {
  const gender = new Map();
  for (const p of players) {
    for (const anime of p.animeList ?? []) {
      for (const c of anime.characters ?? []) {
        const key = characterNameKey(c?.name);
        if (key && genderVal(c.gender) && !gender.has(key)) gender.set(key, c.gender);
      }
    }
  }
  return gender;
}

/**
 * One card per character on the table's lists with a real portrait (a card is
 * mostly its picture). With `sharedOnly`, only characters on every seated
 * player's list. `pack` is the indexed fact pack, or null.
 *
 * Card: `{ key, name, series, imageUrl, owners, vals }`, where `owners` is how
 * many seated players hold the character (the deal leans toward the known).
 */
export function cardPool(players, { sharedOnly = false } = {}, pack = null) {
  const seated = players ?? [];
  const fromLists = listFacts(seated);
  const genders = rawGenders(seated);

  return characterOwners(seated)
    .filter(({ entry, owners }) => hasPortrait(entry.imageUrl) && (!sharedOnly || owners.size === seated.length))
    .map(({ entry, owners }) => {
      const showKey = franchiseTitleKey(entry.series);
      const listed = fromLists.get(showKey) ?? {};
      const packed = (showKey && pack?.shows?.get(resolveShowKey(pack, showKey))) || {};
      const person = pack?.characters?.get(entry.id) ?? {};
      const pick = (f) => listed[f] ?? packed[f] ?? null;

      // The debut year, read the way the import folds it (the EARLIEST season):
      // the pack's startYear is that same fold, its seasonYear the canonical
      // season's, so it comes last.
      const year = listed.seasonYear ?? listed.startYear ?? packed.startYear ?? packed.seasonYear ?? null;
      const source = pick('source');
      const format = pick('format');
      const studio = pick('studio');

      return {
        key: entry.id,
        name: entry.name,
        series: entry.series,
        imageUrl: entry.imageUrl,
        owners: owners.size,
        vals: {
          show: showKey ? one(showKey, entry.series) : null,
          studio: filled(studio) ? one(fold(studio), studio.trim()) : null,
          year: Number.isInteger(Number(year)) && Number(year) > 0 ? one(String(year), String(year)) : null,
          source: SOURCE_LABELS[source] ? one(source, SOURCE_LABELS[source]) : null,
          // Genres are the show's, copied onto every character at import
          // (importGroups.js); an old hand-made character may carry none.
          genre: many(entry.genres?.length ? entry.genres : packed.genres),
          tag: many(packed.tags?.filter((t) => !TAG_SKIP.has(fold(t)))),
          va: filled(person.voiceActorJp) ? one(fold(person.voiceActorJp), person.voiceActorJp.trim()) : null,
          gender: genderVal(genders.get(entry.id) ?? person.gender ?? ''),
          role: roleVal(entry.role),
          format: FORMAT_NOUNS[format] ? one(format, FORMAT_NOUNS[format]) : null,
        },
      };
    });
}
