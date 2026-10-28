import { BOARD_SIZE, DEFAULT_MATCH_ROUNDS, READER_BONUS } from './rules';

// The game's rules sheet (shared/components/HowToSheet.jsx), built from the
// rules' own constants. The pair count is derived the way scoreBoard counts
// it — every pair of cards, not the neighbouring ones — so it moves with
// BOARD_SIZE.
const PAIRS = (BOARD_SIZE * (BOARD_SIZE - 1)) / 2;

export const HOW_TO = {
  goal: `Put ${BOARD_SIZE} cards in order from top to bottom, as close to the answer key as you can.`,
  players: '1+ players',
  sections: [
    {
      title: 'A round',
      items: [
        `Everyone gets the same ${BOARD_SIZE} shows or characters, and a question to rank them on: release date, popularity, best to worst and more.`,
        'Slot 1 is the top: the most of whatever the question measures.',
        'Dealt blind, the cards arrive one at a time and a placed card cannot move. Dealt open, you see all of them, arrange them, then lock in.',
        'On one device, each player places their whole board and then passes it on, or set it to pass after every card.',
      ],
    },
    {
      title: 'The answer key',
      items: [
        'A fact question is checked against the real numbers.',
        'An opinion question uses one player’s own board as the key, and everyone else guesses how they ranked. That player changes every round.',
      ],
    },
    {
      title: 'Scoring',
      items: [
        `Every pair of cards counts: ${PAIRS} pairs on ${BOARD_SIZE} cards, a point for each pair in the right order. Cards with the same value are right either way round.`,
        'On the reveal, every line that crosses another is a pair you had the wrong way round.',
        'In an opinion round, the player whose board was the key scores the average of everyone’s guesses.',
        `Whoever read them best (the top guess, ties shared) gets ${READER_BONUS} more.`,
        `A match is ${DEFAULT_MATCH_ROUNDS} rounds by default, then the final scores. Set the rounds to Endless to keep dealing new tens.`,
      ],
    },
    {
      title: 'Tier lists',
      items: [
        'Pick a tier list format in the settings to rank your whole list into tiers instead. There is no score; online, you compare lists with each other.',
      ],
    },
  ],
};
