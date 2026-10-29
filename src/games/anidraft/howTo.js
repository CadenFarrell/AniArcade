import { CLOCK_OPTIONS, DEFAULT_PREFS } from './prefs';
import { BOARD_FACTOR, MAX_PLAYERS, MIN_PLAYERS, ROLES_PER_ROUND } from './rules';

const clocks = CLOCK_OPTIONS.filter((o) => o.value > 0).map((o) => o.value).join(' or ');

// The game's rules sheet (shared/components/HowToSheet.jsx), built from the
// rules' and prefs' own constants, so a retuned number reaches the sheet.
export const HOW_TO = {
  goal: 'Draft the best team out of everyone’s anime lists, one character per role, then win the table’s vote role by role.',
  players: `${MIN_PLAYERS}–${MAX_PLAYERS} players, each drafting their own team`,
  sections: [
    {
      title: 'A round',
      items: [
        `${ROLES_PER_ROUND} roles are dealt — Captain, Final Boss, Comic Relief and so on. They can be reshuffled until the first pick.`,
        `One board of characters from the table’s lists goes down, about ${BOARD_FACTOR}× as many as there are picks, so there is still a choice at the end.`,
        `Take turns picking from the board in a snake: first to last, then last to first, ${ROLES_PER_ROUND} times round. The first pick moves one seat each round.`,
        'Each pick goes into one of your empty roles. A character on someone else’s team is gone.',
      ],
    },
    {
      title: 'The vote',
      items: [
        'Once every team is full, everyone votes on every role: the best Captain, the best Final Boss, and so on.',
        'You can’t vote for your own team. On one device the phone is passed round so each vote stays secret.',
        'Each role’s most-voted team scores 1 point. A tie gives every tied team the point.',
      ],
    },
    {
      title: 'Winning',
      items: [
        `Most points after ${DEFAULT_PREFS.rounds} rounds (by default) wins. Level on points, the most votes received across the game wins.`,
        `Online, the host can give every pick a clock (${clocks} seconds). Run out, or leave, and your pick is made for you.`,
      ],
    },
  ],
};
