// Every option AniDraft remembers between sessions, at its literal default — and
// the schema useGamePrefs validates a saved blob against. Setup and the lobby
// offer the same set through one AniDraftSettings card.
//
//   rounds: 3      — three drafts, with the first pick moving a seat each
//                    round: enough for a comeback, short enough for one
//                    sitting (a round is a draft AND a five-role vote).
//   pool: 'main'   — main characters: the ones a table has opinions about.
//   pickClock: 0   — no pick clock. Online only (a table on one phone sets
//                    its own pace); a host with a slow drafter turns it on.
export const DEFAULT_PREFS = {
  rounds: 3,
  pool: 'main',
  pickClock: 0,
};

export const ROUNDS_OPTIONS = [1, 3, 5];
export const POOL_OPTIONS = [
  { value: 'main', label: 'Main characters' },
  { value: 'all', label: 'Anyone on the lists' },
];
export const CLOCK_OPTIONS = [
  { value: 0, label: 'No clock' },
  { value: 30, label: '30 seconds a pick' },
  { value: 60, label: '60 seconds a pick' },
];

/** A saved blob's values back onto what the card offers (mergePrefs only checks types). */
export function cleanPrefs(prefs) {
  const pick = (v, options, fallback) => (options.includes(v) ? v : fallback);
  return {
    rounds: pick(prefs?.rounds, ROUNDS_OPTIONS, DEFAULT_PREFS.rounds),
    pool: pick(prefs?.pool, POOL_OPTIONS.map((o) => o.value), DEFAULT_PREFS.pool),
    pickClock: pick(prefs?.pickClock, CLOCK_OPTIONS.map((o) => o.value), DEFAULT_PREFS.pickClock),
  };
}
