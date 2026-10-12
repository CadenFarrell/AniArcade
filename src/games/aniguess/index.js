import { lazyGame } from '../../shared/utils/lazyGame';

export default {
  id: 'aniguess',
  title: 'AniGuess',
  blurb: 'Guess the anime character you were assigned by asking yes/no questions.',
  icon: '🎭',
  accent: 'pink', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  // Loaded on demand — see shared/utils/lazyGame.js.
  Component: lazyGame(() => import('./AniGuessGame')),
};
