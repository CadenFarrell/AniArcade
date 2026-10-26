import { lazyGame } from '../../shared/utils/lazyGame';

export default {
  id: 'anipeek',
  title: 'AniPeek',
  kana: 'アニピーク', // decorative only — see shared/ui/kanaText.js
  blurb: 'A face hides under sixteen tiles. Bid how few you need to name them — then prove it.',
  // The decorative slate ink: every semantic accent is spoken for (index.css).
  accent: 'slate',
  available: true,
  // Loaded on demand — see shared/utils/lazyGame.js.
  Component: lazyGame(() => import('./AniPeekGame')),
  // The rules sheet, loaded on demand like the game (shared/utils/lazyGame.js).
  howTo: () => import('./howTo'),
};
