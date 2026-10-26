import { CHOICE, TYPED } from './rules';

// Every option AniPeek remembers between sessions, at its literal default — and
// the schema useGamePrefs validates a saved blob against. Setup and the lobby
// offer the same set through one AniPeekSettings card.
//
//   rounds: 8           — long enough that the opener rotates past everyone at
//                         a table of four, twice.
//   answerStyle: choice — four names grade with no spelling; typed is a
//                         setting away, as in AniQuiz.
//   hints: true         — the hint cards are half of what a low bid can buy,
//                         and a table that wants pictures only can turn them off.
//   sharedOnly: false   — a pool of characters on EVERY list rarely reaches
//                         eight portraits; the deal already leans toward
//                         characters more of the table knows (deal.js).
export const DEFAULT_PREFS = {
  rounds: 8,
  answerStyle: CHOICE,
  hints: true,
  sharedOnly: false,
};

export const ROUNDS_RANGE = { min: 4, max: 16 };

export const ANSWER_STYLES = [
  { id: CHOICE, label: 'Multiple choice', blurb: 'Four names, one right — the other three from the same show where it can.' },
  { id: TYPED, label: 'Type it', blurb: 'No options — type the name, with suggestions from every list at the table.' },
];
