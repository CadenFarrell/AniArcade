// AniPeek: a portrait under sixteen tiles; bid how few you need, then uncover
// them (or buy hint cards) and name the character.
//
// What the bot has to get right that the generic fallback would not:
//   - a bid is a number in the "Tiles" stepper, then "Bid N" — the fallback
//     would press Bid at whatever the stepper starts on every time, so the bot
//     sometimes types its own (anything, the stepper clamps on blur) and
//     sometimes passes;
//   - peeking is "Uncover tile N" and "Hint: …" presses up to the budget, and
//     "Name them" whenever it feels sure — pressed at random, a tile press
//     and a Name press look the same to the fallback;
//   - the answer is a radio + Lock in, or the "Your answer" box.
// The bot cannot see the picture, so it answers at random: misses pay the
// rest of the table, which exercises both scoring paths every game.
import { makeStrategy } from './base.js';
import { find, findAll, click, fill } from '../core/generic.js';

export default makeStrategy({
  players: [2, 5],
  axes: {
    rounds: [4, 6, 8],
    answerStyle: ['choice', 'typed'],
    hints: [true, false],
    sharedOnly: [false, true],
  },
  // A shared-only pool at a big table can come up short of the rounds; the
  // banner says what to do, and the bot does the first thing it offers.
  fixBlocked(snap) {
    const shared = find(snap, /shared characters only/i, { role: 'checkbox' });
    if (shared?.checked) return click(shared, 'turn off shared-only');
    return null;
  },
  onBlocked: () => ({ expected: true }),

  act(snap, ctx) {
    const { rng } = ctx;

    const bid = find(snap, /^bid \d+$/i);
    if (bid) {
      const pass = find(snap, /^pass$/i);
      if (pass && rng.chance(0.45)) return click(pass, 'pass');
      const tiles = find(snap, /^tiles$/i, { role: 'spinbutton' });
      if (tiles && rng.chance(0.4) && !ctx.memory.typedBid) {
        ctx.memory.typedBid = true;
        return fill(tiles, String(rng.int(1, 15)), 'choose a bid');
      }
      ctx.memory.typedBid = false;
      return click(bid, 'bid');
    }

    const tiles = findAll(snap, /^uncover tile \d+$/i);
    const hints = findAll(snap, /^hint: /i);
    const nameThem = find(snap, /^name them$/i);
    if (nameThem) {
      if (hints.length && rng.chance(0.3)) return click(rng.pick(hints), 'buy a hint');
      if (tiles.length && rng.chance(0.8)) return click(rng.pick(tiles), 'uncover a tile');
      return click(nameThem, 'name them');
    }

    const radios = findAll(snap, /./, { role: 'radio' });
    if (radios.length) {
      if (!radios.some((r) => r.checked)) return click(rng.pick(radios), 'answer');
      return click(find(snap, /^lock in$/i), 'lock in');
    }
    const box = find(snap, /your answer/i, { role: 'combobox' }) ?? find(snap, /your answer/i);
    if (box) {
      const lock = find(snap, /^lock in$/i);
      if (box.value && lock) return click(lock, 'lock in');
      const options = snap.controls.filter((c) => c.role === 'option' && !c.disabled);
      if (options.length) return click(rng.pick(options), 'pick a suggestion');
      if (rng.chance(0.1)) return click(find(snap, /^pass$/i), 'give up');
      return fill(box, rng.pick(['a', 'e', 'hero', 'ka', 'ri']), 'type a name');
    }

    const next = find(snap, /^(next round|see results)$/i);
    if (next) return click(next, 'next');
    return null;
  },
});
