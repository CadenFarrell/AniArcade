import { lazyGame } from '../../shared/utils/lazyGame';

export default {
  id: 'anirank',
  title: 'AniRank',
  kana: 'アニランク', // decorative only — see shared/ui/kanaText.js
  // Deliberately does not promise "one at a time": that is true of the fact
  // modes and of any round the host sets to blind, but the opinion modes now
  // deal all ten at once by default.
  blurb: 'Ten cards, one board. Rank them on facts — or on how someone else would.',
  accent: 'amber', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  // Loaded on demand — see shared/utils/lazyGame.js.
  Component: lazyGame(() => import('./AniRankGame')),
  // The rules sheet, loaded on demand like the game (shared/utils/lazyGame.js).
  howTo: () => import('./howTo'),
};
