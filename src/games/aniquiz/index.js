import AniQuizGame from './AniQuizGame';

export default {
  id: 'aniquiz',
  title: 'AniQuiz',
  // Describes the default — a board, clues from the shows you share. The whole-
  // pack pool means a table can play with no lists at all, but that is a
  // setting, and a hub card has one line.
  blurb: 'A trivia board built from the credits of the shows you’ve watched. Bet big on the Daily Double.',
  icon: '🧠',
  accent: 'red', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  Component: AniQuizGame,
};
