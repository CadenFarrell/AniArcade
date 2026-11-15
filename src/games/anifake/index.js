import { lazyGame } from '../../shared/utils/lazyGame';

export default {
  id: 'anifake',
  title: 'AniFake',
  kana: 'アニフェイク', // decorative only — see shared/ui/kanaText.js
  blurb: 'Everyone knows the character. One of you is faking it — find the fake.',
  accent: 'teal', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  // Loaded on demand — see shared/utils/lazyGame.js.
  Component: lazyGame(() => import('./AniFakeGame')),
  // The rules sheet, loaded on demand like the game (shared/utils/lazyGame.js).
  howTo: () => import('./howTo'),
  // The final card's award titles, for the trophy page's collection. They
  // live in rules.js's award() calls; hub/awards.test.js keeps the two equal.
  awards: {
    good: ['Master thief', 'Poker face', 'Frame job', 'Lone accuser', 'Bloodhound'],
    roasts: ['Sweaty palms', 'Friendly fire', 'Scapegoat', 'Frozen', 'Wild stab'],
  },
};
