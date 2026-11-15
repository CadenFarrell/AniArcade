import { lazyGame } from '../../shared/utils/lazyGame';

export default {
  id: 'anichain',
  title: 'AniChain',
  kana: 'アニチェーン', // decorative only — see shared/ui/kanaText.js
  blurb: 'Two clue-givers build a sentence one word at a time, without conferring, until someone names the character.',
  // The decorative violet ink: every other accent is spoken for (index.css).
  accent: 'violet',
  available: true,
  // Loaded on demand — see shared/utils/lazyGame.js.
  Component: lazyGame(() => import('./AniChainGame')),
  // The rules sheet, loaded on demand like the game (shared/utils/lazyGame.js).
  howTo: () => import('./howTo'),
  // The final card's award titles, for the trophy page's collection. They
  // live in rules.js's award() calls; hub/awards.test.js keeps the two equal.
  awards: {
    good: ['Mind reader', 'Set-up artist', 'Buzzer beater', 'Hat trick', 'Wordsmith'],
    roasts: ['Slip of the tongue', 'Wild guesser', 'Picky', 'Staller', 'Talked in circles'],
  },
};
