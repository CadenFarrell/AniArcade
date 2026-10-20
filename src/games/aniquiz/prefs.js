import { BOARD, QUIZ, CHOICE, TYPED } from './rules';
import { DEFAULT_POOL } from './utils/pool';

// Every option AniQuiz remembers between sessions, at its literal default — and
// the schema useGamePrefs validates a saved blob against (see
// shared/utils/gamePrefs.js). QuizSetup and the online lobby offer the same set
// through one QuizSettings component, so they cannot drift.
//
// Defaults worth stating, since each reaches everyone who never opens the card:
//
//   format: board     — the board is the game; the quiz is the short version.
//   answerStyle: choice — four options grade with no spelling at all, which is
//                       the gentler first experience. Typed is a setting away.
//   pool: shared      — clues about shows everybody at the table has seen.
//   timed: true       — online, an untimed clue waits on the slowest player
//                       forever, and the clock is what ends it.
//   topicsOff: []     — every topic on. The list names what a table switched
//                       OFF, so a topic added later is on for everyone; see
//                       enabledTopics in clues.js. Only the deal reads it — it
//                       never enters room state, because only the host deals.
export const DEFAULT_PREFS = {
  format: BOARD,
  answerStyle: CHOICE,
  pool: DEFAULT_POOL,
  categories: 5,
  quizLength: 10,
  dailyDouble: true,
  finalRound: true,
  timed: true,
  answerSeconds: 30,
  topicsOff: [],
};

export const FORMATS = [
  {
    id: BOARD,
    icon: 'grid', // a name from shared/ui/icons.js
    label: 'Board',
    blurb: 'Pick from a grid of categories. Harder clues are worth more.',
  },
  {
    id: QUIZ,
    icon: 'list',
    label: 'Quick quiz',
    blurb: 'A straight run of questions, easiest first.',
  },
];

export const ANSWER_STYLES = [
  { id: CHOICE, label: 'Multiple choice', blurb: 'Four options, one right.' },
  { id: TYPED, label: 'Type it', blurb: 'No options — type the answer, with suggestions as you go.' },
];

export const CATEGORY_RANGE = { min: 2, max: 6 };
export const QUIZ_RANGE = { min: 5, max: 30 };
export const ANSWER_SECONDS_RANGE = { min: 10, max: 120 };
