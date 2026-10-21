// AniTurf: two teams claim a route across a 5×5 board of characters. Each
// clue-giver sees their own team's footing behind a handoff (locally) or on
// their own phone (online), plants traps, then gives one-word clues; their
// teammates pick and claim squares.
//
// What the bot has to get right that the generic fallback would not:
//   - a square is picked, THEN claimed — pressing random buttons would pick
//     and un-pick forever;
//   - Plant traps opens only at exactly the right count, so traps are toggled
//     one at a time until it does;
//   - a clue that is part of a board name is refused (Give the clue stays
//     disabled), so a refused word is replaced rather than retried.
// The bots claim at random among the squares their team can reach, which
// scorches plenty — good: it exercises misses, traps and cut-off routes as
// often as clean wins.
import { makeStrategy } from './base.js';
import { find, findAll, click, fill, has } from '../core/generic.js';

const WORDS = ['ninja', 'ramen', 'rival', 'mecha', 'ghost', 'idol', 'ocean', 'storm', 'crown', 'magic', 'robot', 'blade'];

export default makeStrategy({
  players: [4, 6],
  onlinePlayers: [4, 4],
  axes: {
    traps: [0, 1, 2, 3],
    sharedOnly: [false, true],
  },
  // A small shared list cannot fill 25 squares; the warning says what to do.
  fixBlocked(snap) {
    const shared = find(snap, /shared characters only/i, { role: 'checkbox' });
    if (shared?.checked && has(snap, /turn off “shared characters only”/i)) return click(shared, 'turn off shared-only');
    return null;
  },
  onBlocked: () => ({ expected: true }),

  act(snap, ctx) {
    const { rng, memory } = ctx;

    const show = find(snap, /— show me$/);
    if (show) return click(show, 'the clue-giver looks at the key');

    const plant = find(snap, /^plant traps/i, { enabled: false });
    if (plant) {
      if (!plant.disabled) return click(plant, 'plant the traps');
      const open = findAll(snap, /^Trap /).filter((c) => !c.pressed);
      // Half the time on their own footing — the crossroads bet the game is about.
      const own = open.filter((c) => /your footing$/.test(c.name));
      return click(own.length && rng.chance(0.5) ? rng.pick(own) : rng.pick(open), 'plant a trap');
    }
    const gotIt = find(snap, /^got it$/i);
    if (gotIt) return click(gotIt, 'read the key');

    const clue = find(snap, /^clue$/i, { role: 'textbox' });
    if (clue) {
      const give = find(snap, /^give the clue$/i);
      if (clue.value && give) return click(give, 'give the clue');
      // Empty, or refused (Give the clue disabled): a new word.
      return fill(clue, `${rng.pick(WORDS)}${rng.int(1, 99)}`, 'write a clue');
    }

    const claim = find(snap, /^Claim /);
    if (claim) return click(claim, 'claim the square');
    const picks = findAll(snap, /^Pick /);
    const end = find(snap, /^end turn$/i);
    if (picks.length) {
      if (end && rng.chance(0.15)) return click(end, 'stop while ahead');
      memory.picks = (memory.picks ?? 0) + 1;
      return click(rng.pick(picks), 'pick a square');
    }
    if (end) return click(end, 'nothing left to reach');

    const results = find(snap, /^see results$/i);
    if (results) return click(results, 'see results');
    return null;
  },
});
