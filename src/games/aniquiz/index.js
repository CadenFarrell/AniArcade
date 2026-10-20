import { lazyGame } from '../../shared/utils/lazyGame';

export default {
  id: 'aniquiz',
  title: 'AniQuiz',
  kana: 'アニクイズ', // decorative only — see shared/ui/kanaText.js
  // Describes the default — a board, clues from the shows you share. The whole-
  // pack pool means a table can play with no lists at all, but that is a
  // setting, and a hub card has one line.
  blurb: 'A trivia board built from the credits of the shows you’ve watched. Bet big on the Daily Double.',
  accent: 'red', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  // Loaded on demand — see shared/utils/lazyGame.js.
  Component: lazyGame(() => import('./AniQuizGame')),
};
