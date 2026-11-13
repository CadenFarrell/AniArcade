// AniOut: a grid of characters, all but one sharing a connection; everyone
// picks the odd one out (and, with reasons on, why the rest belong), in secret.
//
// What the bot has to get right that the generic fallback would not:
//   - a pick is TWO radio groups and one button: a character (named by the
//     character's name) and a reason ("Reason: All …"), then "Lock in" — the
//     fallback would press radios forever without knowing the pair is done;
//   - the reason radios are told from the characters by their "Reason:" name,
//     never by "All …" alone, since a character can be called All Might.
// The bot cannot see what links the cards, so it picks at random: a right pick
// now and then exercises both scoring paths every game.
//
// "Groups of four" (mode: 'groups') is a different screen: the characters are
// toggles (aria-pressed), four make a group with "Make group", the last group
// makes itself, and each made group has its own "Group <L> reason: …" radios.
// The bot taps four random untaken cards at a time, gives every group a random
// reason, and locks in.
import { makeStrategy } from './base.js';
import { find, findAll, click } from '../core/generic.js';

export default makeStrategy({
  players: [1, 4],
  axes: {
    mode: ['odd', 'odd', 'groups'],
    boards: [1, 2, 3],
    rounds: [4, 6, 8],
    cards: [5, 6, 7],
    reasons: [true, false],
    sharedOnly: [false, true],
  },
  // A shared-only pool or a big grid can come up short of the rounds; the
  // banner says what to do, and the bot does the first things it offers. The
  // checkbox lives in the "More settings" fold, whose closed controls are
  // hidden (not in the snapshot), so the fold opens first.
  fixBlocked(snap) {
    const shared = find(snap, /shared characters only/i, { role: 'checkbox' });
    if (shared?.checked) return click(shared, 'turn off shared-only');
    if (!shared && /shared characters only/i.test(snap.text)) {
      const fold = find(snap, /more settings/i);
      if (fold) return click(fold, 'open more settings');
    }
    const cards = find(snap, /^characters per round$/i, { role: 'spinbutton' })
      ?? find(snap, /^characters per round$/i);
    if (cards && Number(cards.value) > 5) return { fill: cards.id, name: cards.name, text: '5', why: 'deal fewer per round' };
    const boards = find(snap, /^boards$/i, { role: 'spinbutton' }) ?? find(snap, /^boards$/i);
    if (boards && Number(boards.value) > 1) return { fill: boards.id, name: boards.name, text: '1', why: 'sort fewer boards' };
    return null;
  },
  onBlocked: () => ({ expected: true }),

  act(snap, ctx) {
    // A groups board: give each made group a reason, then fill the next group.
    // Both buttons stay disabled until their step is done, so look past that.
    const lockIn = find(snap, /^lock in$/i, { enabled: false });
    if (lockIn && /sort the board/i.test(`${snap.heading ?? ''} ${snap.text}`)) {
      const groupReasons = findAll(snap, /^group [a-d] reason: /i, { role: 'radio' });
      const byGroup = new Map();
      for (const r of groupReasons) {
        const g = r.name.slice(0, 7).toLowerCase();
        if (!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g).push(r);
      }
      for (const [, rs] of byGroup) if (!rs.some((r) => r.checked)) return click(ctx.rng.pick(rs), "pick a group's reason");
      const make = find(snap, /^make group/i, { enabled: false });
      if (make && !make.disabled) return click(make, 'make a group');
      // The board's characters are the only unpressed toggles on the round
      // screen bar the top bar's sound switch, told apart by its name.
      const toggles = snap.controls.filter((c) => c.role === 'button' && c.pressed === false && !c.disabled
        && !/sound|mute/i.test(c.name));
      if (make && toggles.length) return click(ctx.rng.pick(toggles), 'add a character to the group');
      if (!lockIn.disabled) return click(lockIn, 'lock in the sort');
    }
    const radios = findAll(snap, /./, { role: 'radio' });
    if (radios.length) {
      const reasons = radios.filter((r) => /^reason: /i.test(r.name));
      const cards = radios.filter((r) => !/^reason: /i.test(r.name));
      if (cards.length && !cards.some((r) => r.checked)) return click(ctx.rng.pick(cards), 'pick who is out');
      if (reasons.length && !reasons.some((r) => r.checked)) return click(ctx.rng.pick(reasons), 'pick a reason');
      const lock = find(snap, /^lock in$/i);
      if (lock) return click(lock, 'lock in');
    }
    const next = find(snap, /^(next round|next board|see results)$/i);
    if (next) return click(next, 'next');
    return null;
  },
});
