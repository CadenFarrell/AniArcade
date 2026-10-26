import { DEFAULT_PREFS } from './prefs';
import { HINT_COST, HINTS, MIN_PLAYERS, TILES, WRONG_BONUS } from './rules';

// The game's rules sheet (shared/components/HowToSheet.jsx), built from the
// rules' own constants. The score is TILES − bid, never "tiles still covered":
// see this folder's CLAUDE.md for why stopping early changes nothing.
export const HOW_TO = {
  goal: `A character hides under ${TILES} tiles. Bid how few you need to name them, then prove it.`,
  players: `${MIN_PLAYERS}+ players`,
  sections: [
    {
      title: 'A round',
      items: [
        'The opener bids how few tiles they need. Going round the table, everyone else bids lower or passes. A pass sits you out of that round’s bidding.',
        `The lowest bidder spends their bid: each tile costs 1, and a hint card (${HINTS.map((h) => h.label.toLowerCase()).join(', ')}) costs ${HINT_COST}.`,
        'Name the character whenever you’re ready.',
        'The opener moves round the table each round.',
      ],
    },
    {
      title: 'Scoring',
      items: [
        `Named right: ${TILES} minus your bid.`,
        `Named wrong: every other player gets ${WRONG_BONUS}.`,
        `${DEFAULT_PREFS.rounds} rounds by default. Highest total wins.`,
      ],
    },
    {
      title: 'Good to know',
      items: [
        'Nothing is secret. Bids are spoken, and tiles and hints are uncovered for the whole table.',
        'If a portrait won’t load, skip it before any tile comes off.',
      ],
    },
  ],
};
