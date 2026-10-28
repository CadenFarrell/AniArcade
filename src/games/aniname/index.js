import { lazyGame } from '../../shared/utils/lazyGame';

export default {
  id: 'aniname',
  title: 'AniName',
  kana: 'アニネーム', // decorative only — see shared/ui/kanaText.js
  blurb: 'Bid how many of a category you can name, then name them before the clock runs out.',
  // The decorative umber ink: every other accent is spoken for (index.css).
  accent: 'umber',
  available: true,
  // Loaded on demand — see shared/utils/lazyGame.js.
  Component: lazyGame(() => import('./AniNameGame')),
  // The rules sheet, loaded on demand like the game (shared/utils/lazyGame.js).
  howTo: () => import('./howTo'),
};
