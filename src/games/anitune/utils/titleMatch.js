// Guess matching for anime titles. Generous where a player plainly knows the
// answer — "jujutsu" for "Jujutsu Kaisen", any season of the right show, the
// romaji name or the list's English one — and strict where a guess only LOOKS
// like it knows: the point of the game is recognising the song, not spelling
// romaji, but also not fishing with common words.
//
// A question carries two names — the player's own list title (usually English)
// and the AnimeThemes name (romaji) — and either counts. It also carries
// `lookalikes` (pickRound): the other shows in the table's pool that share a
// distinctive word with it. A partial guess that would fit one of those too is
// not an answer, it is a coin toss.
//
// What used to pass and no longer does:
//   - any 4+ character SUBSTRING ("season" for "Attack on Titan Season 2",
//     "girl" inside "Girls und Panzer", "tack" inside "Attack") — a partial
//     must now be whole words of the title;
//   - a guess made only of words that name a season or a format ("season 2",
//     "the movie", "part 2");
//   - a word two shows on the table share ("death" with Death Note and Death
//     Parade both dealt from).

import { franchiseTitleKey } from '../../../shared/utils/franchise';

function normalize(s) {
  return (s || '')
    .toLowerCase()
    // Treat punctuation as a separator so "Re:Zero" and "re zero" agree.
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Words too common to accept on their own; matching on these alone would let
// "the" or "no" score a point.
const STOPWORDS = new Set(['the', 'a', 'an', 'no', 'of', 'to', 'wa', 'ga', 'na', 'ni', 'and', 'in', 'on', 'wo', 'de']);

// Words that say WHICH season, cut or format, never which show. They are fine
// inside a guess ("attack on titan season 2" is still Attack on Titan); they
// just never count as the part of a guess that names the show.
const GENERIC = new Set([
  'season', 'seasons', 'part', 'parts', 'cour', 'movie', 'movies', 'film', 'series',
  'final', 'ova', 'ona', 'oad', 'special', 'specials', 'tv', 'arc', 'chapter', 'edition',
  'second', 'third', 'fourth', 'fifth', 'sixth', 'new', 'shin', 'zoku', 'kan',
  'ii', 'iii', 'iv', 'v', 'vi', 'x', 'prologue', 'epilogue',
]);
const isOrdinalOrNumber = (t) => /^\d+(st|nd|rd|th)?$/.test(t);

// The words of a title or guess that can name a show.
export function distinctiveWords(text) {
  return normalize(text).split(' ')
    .filter((t) => t && !STOPWORDS.has(t) && !GENERIC.has(t) && !isOrdinalOrNumber(t));
}

function acceptableNames(question) {
  return [question?.animeTitle, question?.displayTitle].filter(Boolean);
}

// Whether `guess` (normalized, split) is a PART of `target` (normalized,
// split): either a run of consecutive whole words of it — the last one may be
// cut short once the guess is two words or more, since that is somebody still
// typing "attack on tit" — or two or more of its distinctive words in any
// order ("kaisen jujutsu"). A single cut-short word never counts: that is the
// substring match this replaced.
function isPartOf(guessTokens, targetTokens, guessDistinct) {
  if (!guessDistinct.length) return false;
  const n = guessTokens.length;
  for (let start = 0; start + n <= targetTokens.length; start++) {
    let ok = true;
    for (let k = 0; k < n; k++) {
      const g = guessTokens[k];
      const t = targetTokens[start + k];
      const last = k === n - 1;
      if (g === t) continue;
      if (last && n >= 2 && g.length >= 2 && t.startsWith(g)) continue;
      ok = false;
      break;
    }
    if (ok) return true;
  }
  const targetSet = new Set(targetTokens);
  return guessDistinct.length >= 2 && guessDistinct.every((t) => targetSet.has(t));
}

function partialMatch(name, guess, guessTokens, guessDistinct) {
  const target = normalize(name);
  if (!target) return false;
  // A partial must be worth something: at least four characters of guess, so
  // two letters that happen to be a whole word ("dr") are not one.
  if (guess.replace(/ /g, '').length < 4) return false;
  return isPartOf(guessTokens, target.split(' '), guessDistinct);
}

export function isCorrectTitleGuess(question, raw) {
  const guess = normalize(raw);
  if (!guess) return false;
  const guessTokens = guess.split(' ');
  const guessDistinct = distinctiveWords(guess);
  const names = acceptableNames(question);

  for (const name of names) {
    const target = normalize(name);
    if (!target) continue;
    // The whole title, as typed — always right, even a title that is nothing
    // but generic words.
    if (guess === target) return true;
    // Or the whole title inside a longer guess ("attack on titan season 2" for
    // "Attack on Titan"), on word boundaries.
    if (target.length >= 4 && ` ${guess} `.includes(` ${target} `)) return true;
    // Or the show's name without its season marker ("attack on titan" for
    // "Attack on Titan Season 2"). Checked before the lookalikes, because a
    // spin-off ("Attack on Titan: Junior High") shares every word of it, and
    // naming the show is the right answer for any of its seasons.
    const show = normalize(franchiseTitleKey(name));
    if (show.length >= 4 && guess === show) return true;
  }

  // A part of the title, as long as it does not fit another show the table
  // could have been dealt just as well.
  if (!names.some((name) => partialMatch(name, guess, guessTokens, guessDistinct))) return false;
  const lookalikes = question?.lookalikes ?? [];
  return !lookalikes.some((other) => {
    const t = normalize(other);
    return t === guess || partialMatch(other, guess, guessTokens, guessDistinct);
  });
}

// Autocomplete over the titles actually in play, so players pick from shows
// they own rather than guessing at romaji spellings. Matches on both names but
// always displays the player's own title.
export function suggestTitles(questions, raw, limit = 6) {
  const guess = normalize(raw);
  if (guess.length < 2) return [];

  const seen = new Set();
  const out = [];
  for (const question of questions) {
    const key = question.animeTitle;
    if (seen.has(key)) continue;
    const haystack = acceptableNames(question).map(normalize);
    if (haystack.some((h) => h.includes(guess))) {
      seen.add(key);
      out.push({ title: question.animeTitle, alt: question.displayTitle });
      if (out.length >= limit) break;
    }
  }
  return out;
}

// The online guess box's suggestions: the round's own songs first (they carry
// the AnimeThemes name as the alternate line), then every show on every
// seated player's list. Suggesting only the dealt songs, as it used to, turned
// the box into a ten-way multiple choice; local play has always suggested from
// the whole pool, and this is its nearest online equivalent — the room holds
// each player's list, not the pool the host built from it.
export function listSuggestionPool(round = [], players = []) {
  const fromLists = players.flatMap((p) => (p?.animeList ?? [])
    .filter((a) => a?.title)
    .map((a) => ({ animeTitle: a.title, displayTitle: a.title })));
  return [...round, ...fromLists];
}
