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
};
