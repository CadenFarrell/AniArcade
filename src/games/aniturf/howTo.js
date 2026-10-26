import { DEFAULT_PREFS } from './prefs';
import { MIN_PLAYERS, OPENING_CLUE, SIZE } from './rules';

// The game's rules sheet (shared/components/HowToSheet.jsx), built from the
// rules' own constants. It names Red's and Blue's directions because the
// whole game is the crossroads those two routes share.
export const HOW_TO = {
  goal: `Two teams race to claim a connected route across a ${SIZE}×${SIZE} board of characters: Red from left to right, Blue from top to bottom.`,
  players: `${MIN_PLAYERS}+ players, in two teams`,
  sections: [
    {
      title: 'Setting up',
      items: [
        'Each team has a clue-giver. Only they can see their team’s footing: the squares the team can hold.',
        `Before the first clue, each clue-giver plants traps against the other team (${DEFAULT_PREFS.traps} by default).`,
      ],
    },
    {
      title: 'A turn',
      items: [
        'The clue-giver says one word and a number.',
        'The team claims up to that many squares, one at a time. Each must touch a square they already hold, or sit on one of their own two edges.',
        'A footing square is yours to keep. Anything else becomes rubble, blocked for both teams, and your turn ends.',
        'A trap springs only on the other team’s footing: that square becomes rubble and the team loses its newest claim.',
        `The game’s very first clue allows only ${OPENING_CLUE} claim, to make up for moving first.`,
      ],
    },
    {
      title: 'Winning',
      items: [
        'The first team to link its two edges wins.',
        'If your route gets cut, your clue-giver is shown a detour. A team left with no way across at all loses.',
      ],
    },
  ],
};
