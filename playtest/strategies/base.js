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

