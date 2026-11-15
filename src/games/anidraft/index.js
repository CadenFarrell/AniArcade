import { lazyGame } from '../../shared/utils/lazyGame';

export default {
  id: 'anidraft',
  title: 'AniDraft',
  kana: 'アニドラフト', // decorative only — see shared/ui/kanaText.js
  blurb: 'Snake-draft a team of characters from everyone’s lists into roles, then the table votes on the best pick for each.',
  // The decorative magenta ink: every other accent is spoken for (index.css).
  accent: 'magenta',
  available: true,
  // Loaded on demand — see shared/utils/lazyGame.js.
  Component: lazyGame(() => import('./AniDraftGame')),
  // The rules sheet, loaded on demand like the game (shared/utils/lazyGame.js).
  howTo: () => import('./howTo'),
  // The final card's award titles, for the trophy page's collection. They
  // live in rules.js's award() calls; hub/awards.test.js keeps the two equal.
  awards: {
    good: ['Unanimous', 'People’s champ', 'Dynasty', 'Silver tongue', 'Steal of the draft'],
    roasts: ['Benchwarmer', 'First-round bust', 'Hot take', 'Bridesmaid', 'Autopilot'],
  },
};
