import { DEFAULT_PREFS, MODE_LABELS } from './prefs';
import { MIN_PLAYERS, WRONG_DECLARATION_COST } from './rules';

// The game's rules sheet (shared/components/HowToSheet.jsx), built from the
// rules' own constants. The scoring line mirrors scoreTurn: fewer names spent
// is worth more, up to the per-round cap.
const { label: chosen } = MODE_LABELS.chosen;
const { label: dealt } = MODE_LABELS.dealt;

export const HOW_TO = {
  goal: 'Work out a hidden category, like “Wears glasses”, from the names that fit it.',
  players: `${MIN_PLAYERS}+ players`,
  sections: [
    {
      title: `${chosen} (the usual game)`,
      items: [
        'Everyone secretly picks a category.',
        'On your go, name one character or show. Every other player says whether it fits their category.',
        'The seat moves on after every name, so it comes back round quickly.',
        'When you think you know somebody’s category, declare it. The first right claim on a player wins it, and nobody else can claim them that round.',
        `A wrong declaration costs you ${WRONG_DECLARATION_COST} names.`,
      ],
    },
    {
      title: dealt,
      items: [
        'You are handed a category that everyone can see except you.',
        'Name things, one judge says yes or no, and declare your own category when you know it.',
      ],
    },
    {
      title: 'Scoring',
      items: [
        `You get ${DEFAULT_PREFS.proposalCap} names a round by default. A right declaration scores more the fewer names you used.`,
        'Running out of names, or giving up, scores nothing that round.',
        `${DEFAULT_PREFS.rounds} rounds by default. Highest total wins.`,
      ],
    },
  ],
};
