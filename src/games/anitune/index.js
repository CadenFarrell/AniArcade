import { lazyGame } from '../../shared/utils/lazyGame';

export default {
  id: 'anitune',
  title: 'AniTune',
  kana: 'アニチューン', // decorative only — see shared/ui/kanaText.js
  blurb: 'Guess the anime from the sound of its opening or ending.',
  accent: 'blue', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  // Loaded on demand — see shared/utils/lazyGame.js.
  Component: lazyGame(() => import('./AniTuneGame')),
};
