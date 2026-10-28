import { DEFAULT_PREFS } from './prefs';
import { DEFAULT_MATCH_ROUNDS, LAST_STANDING_TURNS, MIN_PLAYERS } from './rules';

// The game's rules sheet, opened from the top bar's "How to play" (see
// shared/components/HowToSheet.jsx). Loaded on demand like the game itself, and
// built from the same constants the rules use, so a retuned number cannot leave
// the sheet describing the old game.
const [first, second, third] = DEFAULT_PREFS.pointsPerPosition;

export const HOW_TO = {
  goal: 'Work out which anime character you are by asking yes/no questions. Get there in the fewest turns.',
  players: `${MIN_PLAYERS}+ players`,
  sections: [
    {
      title: 'A round',
      items: [
        'Everyone is given a character they cannot see. While you look away, the rest of the table picks yours, or lets the game pick one at random.',
        'On your turn, ask one yes/no question about your character and the table answers it, or spend the turn on a guess.',
        'A right guess finishes your round. A wrong one just ends your turn.',
        'Once a round you may peek at your own anime list for ideas.',
        'The round ends when everyone has named their character.',
        `Final chances: once everyone else has solved, the last player gets as many turns as the slowest solver took, plus ${LAST_STANDING_TURNS}. Then their character is revealed and they score nothing that round.`,
        'You can also give up your round at any point, which reveals your character.',
      ],
    },
    {
      title: 'Scoring',
      items: [
        `Places go by how few turns you needed: ${first}, ${second} and ${third} points for the first three by default. The same number of turns shares a place.`,
        `A match is ${DEFAULT_MATCH_ROUNDS} rounds by default, then the final leaderboard. Set the rounds to Endless to play until you choose to stop.`,
      ],
    },
    {
      title: 'Settings worth knowing',
      items: [
        'Shared shows only: characters come only from shows everyone has watched.',
        'Talk it out: ask questions out loud instead of typing them.',
        'Timer: a countdown on each turn. Running out ends it.',
      ],
    },
  ],
};
