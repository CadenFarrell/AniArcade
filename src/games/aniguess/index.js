import { lazyGame } from '../../shared/utils/lazyGame';

export default {
  id: 'aniguess',
  title: 'AniGuess',
  kana: 'アニゲス', // decorative only — see shared/ui/kanaText.js
  blurb: 'Guess the anime character you were assigned by asking yes/no questions.',
  accent: 'pink', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  // Loaded on demand — see shared/utils/lazyGame.js.
  Component: lazyGame(() => import('./AniGuessGame')),
  // The rules sheet, loaded on demand like the game (shared/utils/lazyGame.js).
  howTo: () => import('./howTo'),
  // The final card's award titles, for the trophy page's collection. They
  // live in rules.js's award() calls; hub/awards.test.js keeps the two equal.
  awards: {
    good: ['Sharpest', 'Lucky shot', 'Cold read', 'Sole survivor', 'Clean slate'],
    roasts: ['Slow burner', 'Mistaken identity', 'The interrogator', 'Identity crisis', 'Rage quit'],
  },
};
