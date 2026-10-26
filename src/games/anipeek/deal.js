// The deal: which characters go under the tiles, in what order, with their
// wrong answers and their hint cards — everything a round needs, decided once
// so the table never waits on a lookup and a room's guests never need the pack.
//
// Pure, with an injectable rng, so a seed is a replay.
import { shuffle } from '../../shared/utils/random';
import { franchiseTitleKey } from '../../shared/utils/franchise';
import { resolveShowKey } from '../../shared/utils/facts';
import { FORMAT_NOUNS, SOURCE_LABELS } from '../../shared/utils/mediaLabels';
import { CHOICE, HINTS, SPARES, TYPED } from './rules';
import { everyCharacter, portraitPool } from './utils/pool';

const CHOICES = 4;

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// The show's facts as card text. The player's own import first — it is the
// show THEY listed, and it is on the device with no pack at all — then the
// pack for anything missing: older imports carry none of these, and the
// playtest fixtures carry only the year. A fact neither has is left out, and
// its card says so rather than offering a blank.
function hintsFor(series, players, pack) {
  const key = franchiseTitleKey(series);
  const fromList = {};
  for (const p of players) {
    for (const a of p.animeList ?? []) {
      if (franchiseTitleKey(a.title) !== key) continue;
      for (const f of ['studio', 'format', 'source', 'seasonYear']) {
        if (fromList[f] == null && a[f] != null && a[f] !== '') fromList[f] = a[f];
      }
      if (fromList.startYear == null && Number.isInteger(a.startDate?.year)) fromList.startYear = a.startDate.year;
    }
  }
  const packed = pack?.shows?.get(resolveShowKey(pack, key)) ?? {};
  const pick = (f) => fromList[f] ?? packed[f] ?? null;

  const year = pick('seasonYear') ?? pick('startYear');
  const source = SOURCE_LABELS[pick('source')];
  const format = FORMAT_NOUNS[pick('format')];
  const out = {};
  if (typeof pick('studio') === 'string' && pick('studio')) out.studio = pick('studio');
  if (Number.isInteger(Number(year)) && year) out.year = String(year);
  if (format) out.format = capitalize(format);
  if (source) out.source = source;
  return Object.fromEntries(HINTS.filter(({ id }) => out[id]).map(({ id }) => [id, out[id]]));
}

// Three wrong answers that cannot be ruled out by a glance at the options:
// from the same show first (a picture of a Bebop character beside three
// Bebop names), then the same gender, then anyone. AniFake's pickDecoy idea,
// widened to a set. Never the answer, never two of one person.
function choicesFor(card, everyone, rng) {
  const others = everyone.filter((c) => c.key !== card.key);
  const sameShow = shuffle(others.filter((c) => c.series === card.series), rng);
  const sameGender = shuffle(others.filter((c) => c.series !== card.series && card.gender && c.gender === card.gender), rng);
  const rest = shuffle(others.filter((c) => c.series !== card.series && !(card.gender && c.gender === card.gender)), rng);
  const wrong = [];
  const seen = new Set([card.key]);
  for (const c of [...sameShow, ...sameGender, ...rest]) {
    if (wrong.length >= CHOICES - 1) break;
    if (seen.has(c.key)) continue;
    seen.add(c.key);
    wrong.push(c.name);
  }
  return shuffle([card.name, ...wrong], rng);
}

// Most-known first, shuffled within each band: a character three players know
// is a fairer round than one only its importer has seen, but a table that
// always drew from the top band would see the same faces every game.
function draw(pool, count, rng) {
  const bands = new Map();
  for (const row of shuffle(pool, rng)) {
    const n = row.owners.size;
    if (!bands.has(n)) bands.set(n, []);
    bands.get(n).push(row);
  }
  const ordered = [...bands.keys()].sort((a, b) => b - a).flatMap((n) => bands.get(n));
  // Take from a window twice the size needed, then shuffle that, so the lean
  // toward shared characters is a lean and not a wall.
  return shuffle(ordered.slice(0, count * 2), rng).slice(0, count);
}

/**
 * Deals a game. Returns `{ deal }` or `{ error }`.
 *
 * `settings`: `{ rounds, answerStyle, hints, sharedOnly }` (prefs.js). The deal
 * holds `rounds` cards plus up to SPARES more, for portraits that fail to load.
 */
export function dealGame(players, settings, pack = null, rng = Math.random) {
  const rounds = settings?.rounds ?? 8;
  const pool = portraitPool(players, { sharedOnly: Boolean(settings?.sharedOnly) });
  if (pool.length < rounds) {
    return { error: `Not enough portraits for ${rounds} rounds — found ${pool.length}.` };
  }
  const everyone = everyCharacter(players);
  const genderOf = new Map(everyone.map((c) => [c.key, c.gender]));
  const answerStyle = settings?.answerStyle === TYPED ? TYPED : CHOICE;
  const hintsOn = settings?.hints !== false;

  const picked = draw(pool, Math.min(pool.length, rounds + SPARES), rng);
  const cards = picked.map(({ entry }) => {
    const card = {
      key: entry.id,
      name: entry.name,
      series: entry.series,
      imageUrl: entry.imageUrl,
      gender: genderOf.get(entry.id) ?? '',
    };
    return {
      key: card.key,
      name: card.name,
      series: card.series,
      imageUrl: card.imageUrl,
      choices: answerStyle === CHOICE ? choicesFor(card, everyone, rng) : [],
      hints: hintsOn ? hintsFor(card.series, players, pack) : {},
    };
  });
  return { deal: { answerStyle, hintsOn, rounds, cards } };
}

/** The typed box's suggestions: every character on the table's lists. */
export function suggestionsFor(players) {
  return everyCharacter(players).map(({ name, series }) => ({ name, series }));
}
