import { DEFAULT_PREFS } from './prefs';
import { MIN_PLAYERS, PICK_POINTS, REASON_POINTS } from './rules';

// The game's rules sheet (shared/components/HowToSheet.jsx), built from the
// rules' own constants, so a retuned number reaches the sheet by itself.
export const HOW_TO = {
  goal: `${DEFAULT_PREFS.cards} characters from your lists. All but one share something. Spot the one who's out.`,
  players: `${MIN_PLAYERS}+ players (2+ online)`,
  sections: [
    {
      title: 'A round',
      items: [
        'Everyone sees the same characters, by face and name only.',
        'All but one share a connection: the same show, studio, debut year, source, genre, tag or Japanese voice actor.',
        'Pick the one who doesn’t belong, then pick why the rest go together.',
        'Picks are secret until everyone has locked in. On one device, pass it round.',
      ],
    },
    {
      title: 'Scoring',
      items: [
        `Right pick: ${PICK_POINTS} points.`,
        `Right reason as well: +${REASON_POINTS}. A right reason with a wrong pick scores nothing.`,
        `${DEFAULT_PREFS.rounds} rounds by default. Highest total wins.`,
      ],
    },
    {
      title: 'Good to know',
      items: [
        'Every round has exactly one answer. A round where a second character also stands out is never dealt.',
        'The reveal shows each character’s show and what links them.',
        'Bigger lists make more varied rounds. Studio, tag and voice-actor rounds need the shows to be well known.',
      ],
    },
  ],
};
