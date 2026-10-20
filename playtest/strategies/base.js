// What every strategy starts from. A game's own file overrides only what its
// screens need; everything else falls through to the driver's generic policy.
import { find } from '../core/generic.js';

// Every results screen in the arcade offers a replay, and nothing mid-game
// does — a more reliable "the game is over" than any heading, which differ per
// game ("Final Scores", "Final Results", "Reveal").
// Online, the host's replay is "Back to lobby".
export const offersReplay = (snap) => Boolean(find(snap, /play again|back to lobby/i, { enabled: false }));

export function makeStrategy(spec) {
  return {
    players: [2, 4],
    axes: {},
    chaos: ['hub', 'reload'],
    isDone: offersReplay,
    ...spec,
  };
}

// A bot's guess at something it is meant to know: right `p` of the time (the
// answer is on screen to whoever may see it), otherwise a random other option.
export function guessFrom(options, right, rng, p = 0.5) {
  if (right && rng.chance(p)) return right;
  return rng.pick(options.filter((o) => o !== right)) ?? right;
}
