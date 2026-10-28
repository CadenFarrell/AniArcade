// Every option AniName remembers between sessions, at its literal default — and
// the schema useGamePrefs validates a saved blob against. Setup and the lobby
// offer the same set through one AniNameSettings card.
//
//   rounds: 6     — the opener moves one seat a round, so six lets a table of
//                   two, three or six open equally often.
//   seconds: 60   — typing on a phone is slow; a minute leaves a bid of eight
//                   or so a real race rather than a sprint nobody can win.
export const DEFAULT_PREFS = {
  rounds: 6,
  seconds: 60,
};

export const ROUNDS_RANGE = { min: 3, max: 12 };
export const SECONDS_OPTIONS = [30, 45, 60, 90];
