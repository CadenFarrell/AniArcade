import { RACE, SIMULTANEOUS, LIVES } from './rules';

// The mode picker's table and the rules sheet's list. Nothing looks a mode up by
// id today; a screen that ever names the current mode needs a resolver that
// falls back to RACE (an id can arrive from a saved prefs blob or an older
// build's room), as anifake/modes.js's getMode does.
export const MODES = [
  {
    id: RACE,
    icon: 'bell', // a name from shared/ui/icons.js
    label: 'Race',
    blurb: 'First correct answer takes the point. Miss and you’re out for that song.',
  },
  {
    id: SIMULTANEOUS,
    icon: 'pencil',
    label: 'Everyone guesses',
    blurb: 'Everyone answers the same clip. Everyone who gets it right scores.',
  },
  {
    id: LIVES,
    icon: 'heart',
    label: 'Last one standing',
    blurb: 'Everyone answers, and a miss costs a life. Outlast the table.',
  },
];
