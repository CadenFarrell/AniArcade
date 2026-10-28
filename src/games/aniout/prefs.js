import { CARDS_RANGE } from './deal';

// Every option AniOut remembers between sessions, at its literal default — and
// the schema useGamePrefs validates a saved blob against. Setup and the lobby
// offer the same set through one AniOutSettings card.
//
//   rounds: 8          — long enough that every kind of connection tends to
//                        come up once.
//   cards: 6           — five who belong and one who does not: few enough to
//                        hold in your head, enough that a lucky tap is 1 in 6.
//   reasons: true      — saying WHY is what separates knowing from guessing,
//                        and it is worth a point only beside a right pick.
//   sharedOnly: false  — a pool of characters on EVERY list rarely holds eight
//                        clean rounds; the deal leans toward characters more of
//                        the table knows either way (deal.js).
export const DEFAULT_PREFS = {
  rounds: 8,
  cards: 6,
  reasons: true,
  sharedOnly: false,
};

export const ROUNDS_RANGE = { min: 4, max: 15 };
export { CARDS_RANGE };
