// A match: a set number of rounds that ends on a final podium.
//
// AniGuess, AniRank and AniFake were endless — "New Round" for as long as the
// table kept pressing it — so an evening of them never ENDED: no podium, no
// winner, nothing for the play history to record but whatever round someone
// happened to stop on. Each now carries a `rounds` pref, and these helpers are
// the whole of what a match means, shared so the three cannot disagree on
// whether round 3 of 3 is the last one.
//
// `rounds` of 0 is ENDLESS, still offered: a table that likes the old loop
// keeps it, and leaves through the early "see results" exit it always had.
// `round` is 1-based and is the round being played (or just finished).

export const ENDLESS = 0;
export const MAX_MATCH_ROUNDS = 20;

export const isEndless = (rounds) => !(Number(rounds) > 0);

// The round just played was the match's last.
export const isFinalRound = (round, rounds) => !isEndless(rounds) && round >= Number(rounds);

// The tab a round's header carries: "Round 2 of 3", "Final round", or just
// "Round 4" in an endless session.
export function matchLabel(round, rounds) {
  if (isEndless(rounds)) return `Round ${round}`;
  if (isFinalRound(round, rounds) && Number(rounds) > 1) return 'Final round';
  return `Round ${round} of ${rounds}`;
}

// A stored value back into range. Anything that is not a whole number of
// rounds in [1, MAX] is endless — the old saved prefs had no key at all, and
// mergePrefs fills that from the default, so this only meets garbage.
export function clampRounds(rounds) {
  const n = Math.floor(Number(rounds));
  if (!Number.isFinite(n) || n <= 0) return ENDLESS;
  return Math.min(n, MAX_MATCH_ROUNDS);
}

// --- Laps: a length counted in turns round the table ---------------------------
//
// A game that hands one role round the seats a round at a time (AniWave's
// psychic, AniName's opener) is only fair when every seat gets it equally often,
// and a plain round count rarely divides: 8 rounds at 3 players made two
// psychics three times and one twice, 6 at 4 had two openers going twice. Those
// games store `laps` instead and play laps × players rounds, so the split is
// even at any table size. The count is taken from the players actually seated
// at Start, never from a lobby's roster before then.
export const MIN_LAPS = 1;
export const MAX_LAPS = 5;

export function clampLaps(laps) {
  const n = Math.floor(Number(laps));
  if (!Number.isFinite(n) || n < MIN_LAPS) return MIN_LAPS;
  return Math.min(n, MAX_LAPS);
}

/**
 * Rounds for `laps` times round a table of `players`. `minRounds` lifts a short
 * game (a table of one or two) to whole laps of at least that many rounds, so
 * the split stays even: AniName's 2 laps at 2 players would be 4 rounds, and a
 * solo 2.
 */
export function roundsFor(laps, players, { minRounds = 1 } = {}) {
  const seats = Math.max(1, Math.floor(Number(players) || 0));
  const rounds = clampLaps(laps) * seats;
  return rounds >= minRounds ? rounds : seats * Math.ceil(minRounds / seats);
}
