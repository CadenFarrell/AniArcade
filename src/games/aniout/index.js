import { lazyGame } from '../../shared/utils/lazyGame';

export default {
  id: 'aniout',
  title: 'AniOut',
  kana: 'アニアウト', // decorative only — see shared/ui/kanaText.js
  blurb: 'Six characters from your lists. Five share something. Spot the one who’s out — and say why.',
  // The decorative moss ink: every other accent is spoken for (index.css).
  accent: 'moss',
  available: true,
  // Loaded on demand — see shared/utils/lazyGame.js.
  Component: lazyGame(() => import('./AniOutGame')),
  // The rules sheet, loaded on demand like the game (shared/utils/lazyGame.js).
  howTo: () => import('./howTo'),
  // The final card's award titles, for the trophy page's collection. They
  // live in rules.js's award() calls; hub/awards.test.js keeps the two equal.
  awards: {
    good: ['Lone wolf', 'Full marks', 'Perfect game', 'Hot streak', 'Against the grain'],
    roasts: ['Fooled again', 'Contrarian', 'Right for the wrong reason', 'Herd mentality', 'Blind spot'],
  },
};
