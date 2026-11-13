import { DEFAULT_PREFS } from './prefs';
import { GROUP_SIZE } from './groups';
import { GROUP_POINTS, MIN_PLAYERS, PICK_POINTS, REASON_POINTS } from './rules';

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
      // The second game, picked on the settings card.
      title: 'Groups of four',
      items: [
        `A board of ${GROUP_SIZE * GROUP_SIZE} characters hides ${GROUP_SIZE} groups of ${GROUP_SIZE}. Sort them into the groups, in secret.`,
        'A group shares something no other character on the board has: a show, studio, debut year, source, genre, tag or Japanese voice actor.',
        `Each group right: ${GROUP_POINTS} points. Its reason as well: +${REASON_POINTS}.`,
        `${DEFAULT_PREFS.boards} boards by default. Lists too small for four groups get boards of three.`,
      ],
    },
    {
      title: 'Good to know',
      items: [
        'Every round has exactly one answer, and every board sorts exactly one way. Anything that could be read two ways is never dealt.',
        'The reveal shows each character’s show and what links them.',
        'Bigger lists make more varied rounds. Studio, tag and voice-actor rounds need the shows to be well known.',
      ],
    },
  ],
};
