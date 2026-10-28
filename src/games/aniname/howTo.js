import { DEFAULT_PREFS } from './prefs';
import { MAX_BID, MIN_PLAYERS } from './rules';

// The game's rules sheet (shared/components/HowToSheet.jsx), built from the
// rules' and prefs' own constants, so a retuned number reaches the sheet.
export const HOW_TO = {
  goal: 'Bid how many of a category you can name. The top bidder has to name that many before the clock runs out.',
  players: `${MIN_PLAYERS}+ players (2+ online)`,
  sections: [
    {
      title: 'A round',
      items: [
        'A category comes up, like “characters from Naruto” or “anime animated by MAPPA”.',
        `The opener bids first. Going round the table, everyone raises (up to ${MAX_BID}) or drops out for the round.`,
        `When nobody will raise, the top bidder has ${DEFAULT_PREFS.seconds} seconds (by default) to type that many answers.`,
        'Repeats count once. “Kakashi” is fine for Kakashi Hatake.',
      ],
    },
    {
      title: 'Checking',
      items: [
        'Answers are checked against everyone’s lists and the arcade’s facts on popular shows.',
        'A name the arcade doesn’t know goes to the rest of the table to accept or reject after the clock.',
        'A name it knows doesn’t fit is marked wrong straight away.',
      ],
    },
    {
      title: 'Scoring',
      items: [
        'Name them all: you score your bid.',
        'Fall short: everyone else scores half your bid, rounded up.',
        `${DEFAULT_PREFS.rounds} rounds by default, and the opener moves each round. Highest total wins.`,
      ],
    },
  ],
};
