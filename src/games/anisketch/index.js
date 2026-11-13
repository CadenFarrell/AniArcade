import { lazyGame } from '../../shared/utils/lazyGame';

export default {
  id: 'anisketch',
  title: 'AniSketch',
  kana: 'アニスケッチ', // decorative only — see shared/ui/kanaText.js
  blurb: 'Draw a character from your list against the clock while everyone races to name them.',
  // The decorative rose ink: every other accent is spoken for (index.css).
  accent: 'rose',
  available: true,
  // Loaded on demand — see shared/utils/lazyGame.js.
  Component: lazyGame(() => import('./AniSketchGame')),
  // The rules sheet, loaded on demand like the game (shared/utils/lazyGame.js).
  howTo: () => import('./howTo'),
};
