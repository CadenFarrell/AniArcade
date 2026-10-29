// AniDraft: snake-draft characters from the table's lists into five roles,
// then vote role by role for the best pick that isn't yours.
//
// What the bot has to get right that the generic fallback would not:
//   - a pick is TWO presses: a "Take <name>" card on the board, then a
//     "Draft as <role>" button in the bar — the fallback would tap cards
//     forever, since tapping one only selects it;
//   - a ballot is one "<name> as <role>" radio in EVERY role's group before
//     "Cast votes" opens; the voter's own team is never offered, so any radio
//     is a legal vote;
//   - the reveal is "Next role" five times, then "Next round" / "See results".
// "Shuffle roles" is pressed now and then before a round's first pick, so the
// reshuffle path is exercised; online only the host sees it.
import { makeStrategy } from './base.js';
import { find, findAll, click, has, wait } from '../core/generic.js';

export default makeStrategy({
  players: [3, 5],
  onlinePlayers: [3, 4],
  axes: {
    rounds: [1, 3],
    // Locally the clock is not on the card at all; online a short one makes
    // the clock's auto-pick happen whenever a bot dawdles past it (it never
    // does at 30s, but the seed axis keeps the path in the matrix).
    pickClock: [0, 30],
  },
  onBlocked: () => ({ expected: true }),

  act(snap, ctx) {
    const { rng, memory } = ctx;

    // The vote's handoff, locally.
    const vote = find(snap, /— vote$/);
    if (vote) return click(vote, 'take the phone to vote');

    // A role for the card already picked.
    const roles = findAll(snap, /^Draft as /);
    if (roles.length) return click(rng.pick(roles), 'draft it into a role');

    const shuffle = find(snap, /^shuffle roles$/i);
    const board = findAll(snap, /^Take /);
    if (board.length) {
      const round = snap.text.match(/Round (\d+)\//)?.[1] ?? '?';
      if (shuffle && memory.shuffled !== round && rng.chance(0.3)) {
        memory.shuffled = round;
        return click(shuffle, 'reshuffle the roles');
      }
      return click(rng.pick(board), 'pick a card off the board');
    }

    // The ballot: a choice in every role, then cast. A radio is named
    // "<character> as <role>", and the role is what follows the LAST " as "
    // (a character's name may hold one; no role's does).
    const radios = findAll(snap, / as .+$/, { role: 'radio' });
    if (radios.length) {
      const roleOf = (r) => r.name.slice(r.name.lastIndexOf(' as ') + 4);
      const voted = new Set(radios.filter((r) => r.checked).map(roleOf));
      const open = radios.filter((r) => !voted.has(roleOf(r)));
      if (open.length) return click(rng.pick(open), 'vote in a role');
      const cast = find(snap, /^cast votes$/i);
      if (cast) return click(cast, 'cast the ballot');
    }

    const nextRole = find(snap, /^next role$/i);
    if (nextRole) return click(nextRole, 'turn over the next role');
    const move = find(snap, /^(next round|see results)$/i);
    if (move) return click(move, 'move on');

    // Online, everyone else waits on the picker or the other voters.
    if (has(snap, /waiting for|votes are in|counting the votes/i)) return wait(500, 'waiting on the table');
    return null;
  },
});
