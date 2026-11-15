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
  // The rules sheet, loaded on demand like the game (shared/utils/lazyGame.js).
  howTo: () => import('./howTo'),
  // The final card's award titles, for the trophy page's collection. They
  // live in rules.js's award() calls; hub/awards.test.js keeps the two equal.
  awards: {
    good: ['Finishing move', 'Best clue', 'It’s a trap!', 'Unstoppable', 'Speedrun'],
    roasts: ['Overpromised', 'Scorched earth', 'Trap magnet', 'Played it safe', 'Dead end'],
  },
};
