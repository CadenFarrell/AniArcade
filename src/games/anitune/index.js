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
  // The rules sheet, loaded on demand like the game (shared/utils/lazyGame.js).
  howTo: () => import('./howTo'),
  // The final card's award titles, for the trophy page's collection. They
  // live in rules.js's award() calls; hub/awards.test.js keeps the two equal.
  awards: {
    good: ['Fastest finger', 'Clutch', 'Deep cut', 'Encore', 'Home turf'],
    roasts: ['Slowpoke', 'Wrong anime', 'Stranger to their own list', 'First out', 'Radio silence'],
  },
};
