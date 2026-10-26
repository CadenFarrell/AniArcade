import { MODES } from './modes';
import { DEFAULT_CLUE_ROUNDS, MAX_DEALS, MIN_PLAYERS } from './rules';

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
        'Play as many rounds as you like. Points add up.',
      ],
    },
  ],
};
