import { DEFAULT_PREFS, SOURCE_LABELS } from './prefs';
import { MIN_PLAYERS, WRONG_DECLARATION_COST } from './rules';

// The game's rules sheet (shared/components/HowToSheet.jsx), built from the
// rules' own constants. The scoring line mirrors scoreTurn: fewer names spent
// is worth more, up to the per-round cap.
const { label: table } = SOURCE_LABELS.table;
const { label: random } = SOURCE_LABELS.random;

export const HOW_TO = {
  goal: 'Work out your own hidden category, like “Wears glasses”, from the names that fit it.',
  players: `${MIN_PLAYERS}+ players`,
  sections: [
    {
      title: 'Your category',
      items: [
        'Everyone has a secret category that everyone can see except them.',
        `${table} (the usual game): before the round, each of you looks away in turn while everyone else agrees on a category for you.`,
        `${random}: the game deals them instead.`,
      ],
    },
    {
      title: 'Your go',
      items: [
        'Name one character or show. Your judge, the next player round, says whether it fits your category.',
        'The seat moves on after every name, so it comes back round quickly.',
        'When you think you know your category, declare it. The judge says whether you got it.',
        `A wrong declaration costs you ${WRONG_DECLARATION_COST} names.`,
      ],
    },
    {
      title: 'Scoring',
      items: [
        `You get ${DEFAULT_PREFS.proposalCap} names a round by default. A right declaration scores more the fewer names you used: a point less for every two names, never under half.`,
        'Running out of names, or giving up, scores nothing that round. Picking somebody’s category scores nothing either.',
        `${DEFAULT_PREFS.rounds} rounds by default. Highest total wins.`,
      ],
    },
  ],
};
