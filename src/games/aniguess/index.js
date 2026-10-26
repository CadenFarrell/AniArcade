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
};
