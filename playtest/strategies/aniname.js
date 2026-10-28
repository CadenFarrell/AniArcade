// AniName: an auction on a category ("characters from Naruto"), then the top
// bidder types that many answers against the clock, and the table rules on the
// names the arcade does not know.
//
// What the bot has to get right that the generic fallback would not:
//   - a bid is a number in the "Count" stepper, then "Bid N", or "Drop out" —
//     the fallback would raise forever, and a bid war of bots never ends;
//   - naming is the "Your answer" box and "Add", then "I'm done" — the box
//     clears after every Add, so the fallback would type into it forever;
//   - the table's review is "Accept “x”" / "Reject “x”" per unknown name.
// The bot cannot know real names, so it types a few made-up ones: every one is
// unknown, which sends the round to the table's review every time it could
// still be made — the path a real table hits least and most needs exercising.
import { makeStrategy } from './base.js';
import { find, findAll, click, fill } from '../core/generic.js';

const MADE_UP = ['Hero One', 'Rival Two', 'Captain Three', 'Sensei Four', 'Doctor Five', 'Ghost Six'];

export default makeStrategy({
  players: [1, 4],
  axes: {
    rounds: [3, 4, 6],
    seconds: [30, 60, 90],
  },
  onBlocked: () => ({ expected: true }),

  act(snap, ctx) {
    const { rng } = ctx;

    const bid = find(snap, /^bid \d+$/i);
    if (bid) {
      // Drop out often, so a bot table's auction closes quickly.
      const drop = find(snap, /^drop out$/i);
      if (drop && rng.chance(0.6)) return click(drop, 'drop out');
      const count = find(snap, /^count$/i, { role: 'spinbutton' });
      if (count && rng.chance(0.3) && !ctx.memory.typedBid) {
        ctx.memory.typedBid = true;
        return fill(count, String(rng.int(1, 6)), 'choose a bid');
      }
      ctx.memory.typedBid = false;
      return click(bid, 'bid');
    }

    const box = find(snap, /your answer/i, { role: 'textbox' }) ?? find(snap, /your answer/i);
    if (box) {
      ctx.memory.named = ctx.memory.named ?? 0;
      const add = find(snap, /^add$/i);
      if (box.value && add) { ctx.memory.named += 1; return click(add, 'add a name'); }
      const done = find(snap, /^i'?m done$/i, { enabled: false });
      if (ctx.memory.named >= rng.int(1, 5) && done) { ctx.memory.named = 0; return click(done, 'done'); }
      return fill(box, rng.pick(MADE_UP), 'type a name');
    }

    const rulings = findAll(snap, /^(accept|reject) /i);
    if (rulings.length) return click(rng.pick(rulings), 'rule on a name');

    const next = find(snap, /^(next round|see results)$/i);
    if (next) return click(next, 'next');
    return null;
  },
});
