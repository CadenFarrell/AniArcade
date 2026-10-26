import { BOARD_VALUES } from './clues';
import { ANSWER_STYLES, DEFAULT_PREFS, FORMATS } from './prefs';
import { BOARD, DD_FLOOR, QUIZ } from './rules';

// The game's rules sheet (shared/components/HowToSheet.jsx). The values and the
// Daily Double floor are the rules' own constants, and the formats are the
// settings card's copy, so the sheet moves with the game.
const formatLabel = (id) => FORMATS.find((f) => f.id === id)?.label ?? id;
const low = BOARD_VALUES[0];
const high = BOARD_VALUES[BOARD_VALUES.length - 1];

export const HOW_TO = {
  goal: 'Answer trivia built from the credits of the shows you’ve watched. Most points wins.',
  players: '1+ players',
  sections: [
    {
      title: formatLabel(BOARD),
      items: [
        `A grid of categories, with clues worth ${low} to ${high}. Harder clues are worth more.`,
        'The picker chooses a clue, and the pick moves round the table.',
        'Everyone answers every clue in private. A right answer scores the clue’s value, and a wrong one costs nothing.',
        `Daily Double: only the player who found it answers, after a wager of up to their score (or ${DD_FLOOR.toLocaleString('en-US')} if they have less). A miss loses the wager.`,
        'Final round: everyone with points may wager up to their score on one last clue.',
      ],
    },
    {
      title: formatLabel(QUIZ),
      items: [
        `A straight run of ${DEFAULT_PREFS.quizLength} questions by default, easiest first, each priced by how hard it is.`,
      ],
    },
    {
      title: 'Settings worth knowing',
      items: [
        ...ANSWER_STYLES.map((s) => `${s.label}: ${s.blurb}`),
        'Pool: clues from shows everyone has watched, from anyone’s list, or from every show the arcade knows. The last needs no list at all.',
        'Categories: switch whole topics off, like theme songs or voice actors.',
      ],
    },
  ],
};
