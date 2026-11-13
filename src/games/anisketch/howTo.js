import { DEFAULT_PREFS } from './prefs';
import { DRAWER_PER_GUESSER, GUESS_MAX, GUESS_MIN, MIN_PLAYERS } from './rules';

// The game's rules sheet (shared/components/HowToSheet.jsx), built from the
// rules' own constants, so a retuned number reaches the sheet by itself.
export const HOW_TO = {
  goal: 'Draw a character from your list. Everyone else names them, the sooner the better.',
  players: `${MIN_PLAYERS}+ players`,
  sections: [
    {
      title: 'A turn',
      items: [
        `The drawer picks one of ${DEFAULT_PREFS.choices} characters from their own list, in secret.`,
        `They have ${DEFAULT_PREFS.drawSeconds} seconds to draw them. No letters, no words.`,
        'Everyone else names the character. Online, type your guesses; on one device, shout them and the drawer taps who got it.',
        'A first name is enough when only one character the table knows has it.',
      ],
    },
    {
      title: 'Scoring',
      items: [
        `A right guess scores up to ${GUESS_MAX}, less the longer the clock has run, and never under ${GUESS_MIN}.`,
        `The drawer scores ${DRAWER_PER_GUESSER} for every player who names it, so draw to be understood.`,
        'Everyone draws the same number of times. Highest total wins.',
      ],
    },
    {
      title: 'The pen',
      items: [
        'Six inks picked for hair colour, an eraser, three sizes, Undo and Clear.',
        'Stuck? The drawer can give up and the character is revealed.',
        'Online, if the drawer leaves, the turn is void: only their phone knew who it was.',
      ],
    },
  ],
};
