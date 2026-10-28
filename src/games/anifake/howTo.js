import { MODES } from './modes';
import { DEFAULT_CLUE_ROUNDS, DEFAULT_MATCH_ROUNDS, MAX_DEALS, MIN_PLAYERS } from './rules';

// The game's rules sheet (shared/components/HowToSheet.jsx), built from the
// rules' own constants and modes.js's labels so it cannot describe a different
// game from the one being dealt. The points mirror scoreRound.
export const HOW_TO = {
  goal: 'Everyone shares one secret character except the fake. Crew: find the fake. Fake: blend in.',
  players: `${MIN_PLAYERS}+ players`,
  sections: [
    {
      title: 'A round',
      items: [
        `Everyone looks at their card in private. Anyone who doesn’t know their character can ask for a new deal, anonymously, up to ${MAX_DEALS - 1} times a round.`,
        `Take turns giving a one-word clue about the character, ${DEFAULT_CLUE_ROUNDS} times round the table by default.`,
        'Then everyone votes for who they think the fake is. A tie goes to one runoff vote. If that ties too, the fake escapes.',
        'With the clue clock on, a player who runs out of time is marked in the clue list as having said nothing.',
      ],
    },
    {
      title: 'Modes',
      items: [
        ...MODES.map((m) => `${m.label}: ${m.blurb}`),
        'In Blind, a fake who is caught gets one chance to name the secret character.',
      ],
    },
    {
      title: 'Scoring',
      items: [
        'Crew who voted for the fake: +1.',
        'The fake, if the vote misses them: +2.',
        'A caught fake who names the character: +1.',
        `A match is ${DEFAULT_MATCH_ROUNDS} rounds by default, each with a new secret and a new fake. Points add up, and the final scores crown a winner.`,
        'Set the rounds to Endless to play until you choose to end the match.',
      ],
    },
  ],
};
