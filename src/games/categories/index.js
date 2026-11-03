import { lazyGame } from '../../shared/utils/lazyGame';

export default {
  id: 'anitag',
  title: 'AniTag',
  kana: 'アニタグ', // decorative only — see shared/ui/kanaText.js
  // Says "no list needed" because it is unconditionally true here, unlike
  // AniWave's, which has to hedge: every answer in this game is judged by a
  // person, so nothing is ever drawn from anybody's anime list and no mode can
  // change that. A player arriving from the other five assumes the opposite, and
  // a hub card has one line to correct them with.
  // Describes the DEFAULT source (the table picks), not both — a hub card has
  // one line, and the random deal is a setting away with its own explanation.
  blurb: 'The table picks you a secret category. Name things until you work out your own. No list needed.',
  accent: 'lime', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  // Loaded on demand — see shared/utils/lazyGame.js.
  Component: lazyGame(() => import('./AniTagGame')),
  // The rules sheet, loaded on demand like the game (shared/utils/lazyGame.js).
  howTo: () => import('./howTo'),
};
