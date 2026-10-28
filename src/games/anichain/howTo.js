import { DEFAULT_PREFS } from './prefs';
import { GUESS_MS, MIN_PLAYERS, SKIPS, giverShare, valueAt } from './rules';

const cap = DEFAULT_PREFS.cap;

// The game's rules sheet (shared/components/HowToSheet.jsx), built from the
// rules' and prefs' own constants, so a retuned number reaches the sheet.
export const HOW_TO = {
  goal: 'Two clue-givers build one sentence, a word each in turn, until the table names the secret character. They can’t confer.',
  players: `${MIN_PLAYERS.pair}+ players (${MIN_PLAYERS.rivals}+ for rival givers, ${MIN_PLAYERS.teams}+ for team pairs)`,
  sections: [
    {
      title: 'A turn',
      items: [
        `Two clue-givers see a character from the table’s lists. Before the first word, either may ask for another if they don’t know them (${SKIPS} times a turn).`,
        'They take turns adding ONE word to the sentence. No planning together: each word has to follow whatever the other just said.',
        'The character’s name, the show’s title and the names of anyone else in that show are off limits. The givers’ card lists them.',
        `Up to ${cap} words by default. Nobody right by then, and the turn is over.`,
      ],
    },
    {
      title: 'Guessing',
      items: [
        'After each word, everyone it is for gets ONE guess. A wrong guess just waits for the next word.',
        'On one device, say guesses out loud and tap who got it. Online, type them in.',
        `Online the next word waits until everyone has guessed or passed, or ${GUESS_MS / 1000} seconds have gone.`,
      ],
    },
    {
      title: 'Scoring',
      items: [
        `A right guess after word 1 is worth ${valueAt(cap, 1)}, one less for every word after (never less than 1).`,
        `One pair: the guesser scores it, and each giver scores half, rounded up (${giverShare(valueAt(cap, 3))} each for a ${valueAt(cap, 3)}).`,
        'Rival givers: one giver from each team, sharing the sentence. After your word only your team may guess, so a word that sets the answer up hands the other team the next guess.',
        'Team pairs: each team gives to its own guessers on alternate turns while the other team watches.',
        'In the team games the team scores the value. Highest total wins.',
      ],
    },
  ],
};
