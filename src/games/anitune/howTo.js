import { MODES } from './modes';
import { DEFAULT_PREFS } from './prefs';
import { QUESTION_POINTS } from '../../shared/utils/deadline';

// The game's rules sheet (shared/components/HowToSheet.jsx). The modes are read
// off modes.js, the same labels and lines the settings card shows, so the sheet
// and the picker cannot describe a mode two different ways.
export const HOW_TO = {
  goal: 'Name the anime from a few seconds of its opening or ending.',
  players: '1+ players',
  sections: [
    {
      title: 'A round',
      items: [
        `A clip plays for the whole table: ${DEFAULT_PREFS.roundSize} songs a game by default.`,
        'Type the name of the show the song is from.',
        'The answer is revealed after every song, then the next clip plays.',
      ],
    },
    {
      title: 'Modes',
      items: MODES.map((m) => `${m.label}: ${m.blurb}`),
    },
    {
      title: 'Scoring',
      items: [
        `A right answer is worth ${QUESTION_POINTS} point, plus up to one more for speed when the round is timed.`,
        `In Last one standing everyone starts with ${DEFAULT_PREFS.startingLives} lives, and saying nothing costs a life too. The last player in wins.`,
        'Otherwise the highest total wins.',
      ],
    },
    {
      title: 'Settings worth knowing',
      items: [
        'Popularity and years narrow which shows the songs come from.',
        'Shared songs only: songs only from shows everyone has watched.',
      ],
    },
  ],
};
