// Every option AniChain remembers between sessions, at its literal default — and
// the schema useGamePrefs validates a saved blob against. Setup and the lobby
// offer the same set through one AniChainSettings card.
//
//   shape: 'pair'  — one pair of givers, everyone else guessing: it plays at
//                    three, and the rotation hands every seat the clues.
//   cap: 10        — a word cap of ten makes word one worth ten, and leaves
//                    room for a sentence to go wrong and come back.
//   rounds: 6      — the pair moves one seat a round, so six gives a table of
//                    three, or six, every seat twice.
//   pool: 'main'   — main characters: the ones a table can build a sentence
//                    towards from a few shared words.
//   wordClock: 0   — no clock on a spoken word. Local only (online the guess
//                    window already paces the chain); a table with a giver who
//                    stalls turns it on, and a word not said in time is lost.
//   words: 'spoken' — locally the words are said out loud and the device only
//                    counts them. 'typed' passes the phone between the two
//                    givers, who type each word: the sentence is on screen
//                    and banned words are refused as they are typed, as
//                    online. Local only (online every word is typed).
//
// Teams are deliberately not here: they are who is at the table tonight, not
// a preference (AniTurf's prefs.js says the same).
export const DEFAULT_PREFS = {
  shape: 'pair',
  cap: 10,
  rounds: 6,
  pool: 'main',
  wordClock: 0,
  words: 'spoken',
};

export const SHAPE_OPTIONS = [
  { value: 'pair', label: 'One pair, everyone guesses' },
  { value: 'rivals', label: 'Rival givers, two teams' },
  { value: 'teams', label: 'Team pairs, taking turns' },
];
export const CAP_OPTIONS = [6, 8, 10, 12];
export const ROUNDS_OPTIONS = [4, 6, 8];
export const WORD_CLOCK_OPTIONS = [
  { value: 0, label: 'No clock' },
  { value: 10, label: '10 seconds a word' },
  { value: 20, label: '20 seconds a word' },
];
export const WORDS_OPTIONS = [
  { value: 'spoken', label: 'Said out loud' },
  { value: 'typed', label: 'Typed on the phone' },
];
export const POOL_OPTIONS = [
  { value: 'main', label: 'Main characters' },
  { value: 'all', label: 'Anyone on the lists' },
];

/** A saved blob's values back onto what the card offers (mergePrefs only checks types). */
export function cleanPrefs(prefs) {
  const pick = (v, options, fallback) => (options.includes(v) ? v : fallback);
  return {
    shape: pick(prefs?.shape, SHAPE_OPTIONS.map((o) => o.value), DEFAULT_PREFS.shape),
    cap: pick(prefs?.cap, CAP_OPTIONS, DEFAULT_PREFS.cap),
    rounds: pick(prefs?.rounds, ROUNDS_OPTIONS, DEFAULT_PREFS.rounds),
    pool: pick(prefs?.pool, POOL_OPTIONS.map((o) => o.value), DEFAULT_PREFS.pool),
    wordClock: pick(prefs?.wordClock, WORD_CLOCK_OPTIONS.map((o) => o.value), DEFAULT_PREFS.wordClock),
    words: pick(prefs?.words, WORDS_OPTIONS.map((o) => o.value), DEFAULT_PREFS.words),
  };
}
