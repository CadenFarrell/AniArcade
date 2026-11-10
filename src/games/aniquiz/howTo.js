import { BOARD_VALUES, TOPICS } from './clues';
import { ANSWER_STYLES, DEFAULT_PREFS, FORMATS } from './prefs';
import { BOARD, DD_FLOOR, QUIZ } from './rules';

// The game's rules sheet (shared/components/HowToSheet.jsx). The values, the
// Daily Double floor and the default-off topics are the rules' and prefs' own
// constants, and the formats are the settings card's copy, so the sheet moves
// with the game.
const formatLabel = (id) => FORMATS.find((f) => f.id === id)?.label ?? id;
const low = BOARD_VALUES[0];
const high = BOARD_VALUES[BOARD_VALUES.length - 1];
const titleOf = (id) => TOPICS.find((t) => t.id === id)?.title ?? id;
const list = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const offByDefault = list(DEFAULT_PREFS.topicsOff.map(titleOf));
const choiceOnly = list(TOPICS.filter((t) => t.choiceOnly).map((t) => t.title));

export const HOW_TO = {
  goal: 'Answer anime trivia about the shows you’ve watched. Most points wins.',
  players: '1+ players',
  sections: [
    {
      title: 'Your turn',
      items: [
        'Players take turns. Each clue is answered by one player, while everyone else watches.',
        'A right answer scores the clue’s value. A wrong answer, a pass or running out of time loses the same amount, so scores can go below zero.',
      ],
    },
    {
      title: formatLabel(BOARD),
      items: [
        `A grid of categories, with clues worth ${low} to ${high}. Harder clues are worth more.`,
        'On your turn, pick a clue and answer it. Then the turn moves to the next player.',
        `Daily Double: one hidden clue. Whoever picks it wagers up to their score (or ${DD_FLOOR.toLocaleString('en-US')} if they have less) before seeing it, and wins or loses the wager.`,
        'Final round: everyone wagers up to their score on one last clue and answers it in private.',
      ],
    },
    {
      title: formatLabel(QUIZ),
      items: [
        `A straight run of ${DEFAULT_PREFS.quizLength} questions by default, easiest first, each priced by how hard it is. The questions go round the table, one player at a time.`,
      ],
    },
    {
      title: 'Settings worth knowing',
      items: [
        ...ANSWER_STYLES.map((s) => `${s.label}: ${s.blurb}`),
        'Pool: clues from shows everyone has watched, from anyone’s list, or from every show the arcade knows. The last needs no list at all.',
        `Categories: switch whole topics on or off. ${offByDefault} are harder credits trivia and start switched off. ${choiceOnly} need multiple choice.`,
        `${titleOf('lines')}: finish a famous line, or say who says it and in which show. Finishing one needs multiple choice, since translations word it differently; with typed answers you get the other two.`,
        'Name That Character uses the portraits on your imported lists, so it needs at least one list.',
      ],
    },
  ],
};
