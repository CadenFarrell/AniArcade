import { CLUE_MODE_HELP } from './help';
import { DEFAULT_PREFS } from './prefs';
import { BANDS, CLUE_MODES, DIAL_MAX, DIAL_MIN, MIN_PLAYERS } from './rules';

// The game's rules sheet (shared/components/HowToSheet.jsx). The scoring
// bands are read off BANDS, the table scoreDial pays from, and the modes off
// the settings card's own copy, so neither can drift from the game.
export const HOW_TO = {
  goal: 'Read the psychic’s clue and set your dial as close to the hidden target as you can.',
  players: `${MIN_PLAYERS}+ players`,
  sections: [
    {
      title: 'A round',
      items: [
        'Each round one player is the psychic. The role moves round the table.',
        `A spectrum with two ends appears, running ${DIAL_MIN} to ${DIAL_MAX}. Only the psychic sees where the target sits on it.`,
        'The psychic gives a clue that points at that spot. Everyone else sets their own dial, then the target is revealed.',
        `${DEFAULT_PREFS.rounds} rounds by default.`,
      ],
    },
    {
      title: 'Clue modes',
      items: CLUE_MODES.map((m) => `${CLUE_MODE_HELP[m].label}: ${CLUE_MODE_HELP[m].short}`),
    },
    {
      title: 'Scoring',
      items: [
        ...BANDS.map((b) => `Within ${b.within} of the target: ${b.points} points.`),
        'Any further: nothing.',
        'The psychic scores the average of everyone’s dials, so a clear clue pays them too.',
      ],
    },
  ],
};
