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
//   mode: 'odd'        — "Odd one out" (rounds of `cards`) or "Groups of
//                        four" (boards of 16 to sort, groups.js). A whole
//                        match is one or the other.
//   boards: 3          — a groups match's length: a board takes a few
//                        minutes to sort, so three is a match the length of
//                        eight odd-one-out rounds.
//   sharedOnly: false  — "Shared characters first": a pool of characters on
//                        EVERY list rarely holds eight clean rounds, so on it
//                        deals from everyone's lists when it falls short
//                        (deal.js's sharedFallback). The deal leans toward
//                        characters more of the table knows either way.
export const DEFAULT_PREFS = {
  rounds: 8,
  cards: 6,
  reasons: true,
  mode: 'odd',
  boards: 3,
  sharedOnly: false,
};

export const MODES = ['odd', 'groups'];
export const BOARDS_RANGE = { min: 1, max: 6 };

export const ROUNDS_RANGE = { min: 4, max: 15 };
export { CARDS_RANGE };
