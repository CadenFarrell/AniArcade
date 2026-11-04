import { roundsFor as lapRounds } from '../../shared/utils/match';

// Every option AniName remembers between sessions, at its literal default — and
// the schema useGamePrefs validates a saved blob against. Setup and the lobby
// offer the same set through one AniNameSettings card.
//
//   laps: 2       — times round the table (shared/utils/match.js). The opener
//                   moves one seat a round, so the game plays laps × players
//                   rounds and everyone opens equally often. It was `rounds: 6`,
//                   which left two openers going twice at four players;
//                   mergePrefs drops the old key.
//   seconds: 60   — typing on a phone is slow; a minute leaves a bid of eight
//                   or so a real race rather than a sprint nobody can win.
export const DEFAULT_PREFS = {
  laps: 2,
  seconds: 60,
};

// A table of one or two still plays a real game: whole laps of at least this many.
export const MIN_GAME_ROUNDS = 4;
export const SECONDS_OPTIONS = [30, 45, 60, 90];

/** The rounds `settings` comes to at a table of `players`; a direct `rounds` wins. */
export function roundsFor(settings, players) {
  if (Number.isInteger(settings?.rounds) && settings.rounds > 0) return settings.rounds;
  return lapRounds(settings?.laps ?? DEFAULT_PREFS.laps, players, { minRounds: MIN_GAME_ROUNDS });
}
