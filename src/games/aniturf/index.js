import { lazyGame } from '../../shared/utils/lazyGame';

export default {
  id: 'aniturf',
  title: 'AniTurf',
  kana: 'アニターフ', // decorative only — see shared/ui/kanaText.js
  blurb: 'Two teams race to claim a route across a board of characters, led by one-word clues.',
  accent: 'plum', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  // Loaded on demand — see shared/utils/lazyGame.js.
  Component: lazyGame(() => import('./AniTurfGame')),
};
