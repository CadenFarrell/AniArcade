import { MODES } from './modes';
import { DEFAULT_PREFS, LOCAL_RACE_STYLES } from './prefs';
import { FINAL_MULTIPLIER } from './rules';
import { QUESTION_POINTS } from '../../shared/utils/deadline';

// The game's rules sheet (shared/components/HowToSheet.jsx). The modes are read
// off modes.js, the same labels and lines the settings card shows, so the sheet
// and the picker cannot describe a mode two different ways.
export const HOW_TO = {
  goal: 'Name the anime from its opening or ending.',
  players: '1+ players',
  sections: [
    {
      title: 'A round',
      items: [
        `A song plays for the whole table: ${DEFAULT_PREFS.roundSize} songs a game by default.`,
        'Name the show the song is from: typed, or said out loud in the one-device styles below.',
        'Any season of the right show counts, in English or romaji. Part of a title counts too, if it names only that show.',
        'The song keeps playing until the answer is revealed, then the next one starts.'
      ],
    },
    {
      title: 'Modes',
      items: MODES.map((m) => `${m.label}: ${m.blurb}`),
    },
    {
      title: 'Scoring',
      items: [
        `A right answer is worth ${QUESTION_POINTS} point, plus up to one more for speed in a timed game with typed or buzzed answers. Said-out-loud answers score the flat point.`,
        `The last song of a game is worth ${FINAL_MULTIPLIER === 2 ? 'double' : `×${FINAL_MULTIPLIER}`}.`,
        `In Last one standing everyone starts with ${DEFAULT_PREFS.startingLives} lives, and saying nothing costs a life too. The last player in wins.`,
        'Otherwise the highest total wins.',
      ],
    },
    {
      title: 'Settings worth knowing',
      items: [
        'Popularity and years narrow which shows the songs come from.',
        'Shared songs only: songs only from shows everyone has watched.',
        'Hints: while nobody has it, the theme number and year, then whose lists the show is on.',
        'On one device, race can be buzz pads or shouting it out, and everyone-guesses can be said out loud with the table ticking who got it.',
        `${LOCAL_RACE_STYLES.find((s) => s.id === 'shout')?.label}: ${LOCAL_RACE_STYLES.find((s) => s.id === 'shout')?.blurb}`,
        'Online, the host can reveal a song early and starts the next game.',
      ],
    },
  ],
};
