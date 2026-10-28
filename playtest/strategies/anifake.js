// AniFake: everyone but one player is shown the same character; the fake
// bluffs. Pass the device round to see cards, give one-word clues, vote, and
// — if the fake is caught — let them try to steal the point by naming it.
//
// What the bot has to get right that the generic fallback would not:
//   - every clue must be NEW (a repeated clue is refused, and a bot that kept
//     offering "spirit" would sit on a disabled Say it button forever);
//   - a match is `rounds` rounds and ends on "Final Scores"; an endless one
//     (rounds 0) never ends on its own, so the bot ends it with "End match"
//     after one or two reveals;
//   - the steal is a search-then-pick, and the bot sometimes knows the answer:
//     it saw the crew's cards on the way round, as the table did.
import { makeStrategy } from './base.js';
import { find, findAll, click, fill, has } from '../core/generic.js';

const CLUES = [
  'sword', 'ramen', 'rival', 'school', 'mecha', 'ghost', 'idol', 'train', 'ocean',
  'demon', 'spirit', 'moon', 'cafe', 'storm', 'fox', 'cape', 'crown', 'glasses',
  'smile', 'twins', 'magic', 'robot', 'sister', 'blade', 'crying', 'tall', 'quiet',
];

// Who the cards say the fake is: the one told so (blind), or the one card
// unlike the rest (decoy). The table knows this only by playing well; the bot
// knows it because it looked at every card, and uses it about half the time
// so caught fakes — and the steal screen — come up as often as escapes.
function suspect(cardOf) {
  const entries = Object.entries(cardOf ?? {});
  const told = entries.find(([, c]) => c === 'FAKE');
  if (told) return told[0];
  const tally = new Map();
  for (const [, c] of entries) tally.set(c, (tally.get(c) ?? 0) + 1);
  const odd = entries.find(([, c]) => tally.get(c) === 1 && entries.length > 2);
  return odd?.[0] ?? null;
}

export default makeStrategy({
  players: [3, 6],
  axes: {
    mode: ['blind', 'decoy'],
    laps: [1, 2, 3],
    sharedOnly: [true, false],
    talkMode: [false, true],
    fame: ['any', 'known', 'iconic'],
    allowRedeal: [true, false],
    rounds: [1, 2, 0],
    clueSeconds: [0, 0, 30],
  },
  isDone(snap) {
    return /^final scores$/i.test(snap.heading);
  },

  act(snap, ctx) {
    const { rng, memory, scenario } = ctx;
    memory.target ??= 1 + (scenario.seed % 2);
    memory.used ??= new Set();
    memory.cards ??= [];

    // Between rounds: the last one goes on to the final scores; an endless
    // match is ended after `target` reveals; otherwise deal the next.
    if (/^reveal$/i.test(snap.heading)) {
      if (memory.lastReveal !== snap.signature) { memory.lastReveal = snap.signature; memory.reveals = (memory.reveals ?? 0) + 1; }
      const final = find(snap, /^final scores$/i);
      if (final) return click(final, 'final scores');
      const end = find(snap, /^end match$/i);
      if (end && memory.reveals >= memory.target && !/round \d+ of/i.test(snap.text)) return click(end, 'end the endless match');
      const again = find(snap, /^next round$/i);
      if (again) return click(again, 'next round');
    }

    // A card on screen: remember whose it is (the vote and the steal use it),
    // then hide or ask for a re-deal now and then.
    memory.cardOf ??= {};
    const viewing = find(snap, /^I'm (.+) — show me$/);
    if (viewing) memory.viewing = viewing.name.match(/I'm (.+) — show me/)[1];
    const m = snap.text.match(/Your character(.+?)Memorize/);
    if (m) memory.cards.push(m[1]);
    if (memory.viewing && (m || has(snap, /you are the fake/i))) {
      memory.cardOf[memory.viewing] = has(snap, /you are the fake/i) ? 'FAKE' : m[1];
    }
    const redeal = find(snap, /deal again/i);
    if (redeal && rng.chance(0.12)) return click(redeal, 'ask for a re-deal');
    const hide = find(snap, /^hide &/i);
    if (hide) return click(hide, 'hide the card');

    const clue = find(snap, /^your clue$/i);
    if (clue) {
      if (!clue.value) {
        const word = CLUES.find((w) => !memory.used.has(w) && rng.chance(0.4)) ?? `${rng.word()}${memory.used.size}`;
        memory.used.add(word);
        return fill(clue, word, 'give a clue');
      }
      return click(find(snap, /say it/i), 'say the clue');
    }

    // Voting: each button is named "Accuse <name>", so the suspect's is found
    // by name.
    const accuse = findAll(snap, /^accuse /i);
    if (accuse.length) {
      const fake = suspect(memory.cardOf);
      const mine = fake && accuse.find((c) => c.name.slice('Accuse '.length).trim().toLowerCase() === fake.toLowerCase());
      return click(mine && rng.chance(0.55) ? mine : rng.pick(accuse), 'vote');
    }

    // The steal: search, then pick from the list — the right name half the
    // time when the bot saw a crew card, a random entry otherwise.
    const search = find(snap, /the character you think/i);
    if (search) {
      const options = snap.controls.filter((c) => c.role === 'option' && !c.disabled);
      const lock = find(snap, /^lock in /i);
      if (lock) return click(lock, 'lock in the steal');
      if (options.length) {
        const known = options.find((o) => memory.cards.some((c) => c.includes(o.name.split(/\s{2,}|·/)[0].trim())));
        return click(known && rng.chance(0.5) ? known : rng.pick(options), 'steal guess');
      }
      if (!search.value) return fill(search, rng.pick(['a', 'e', 'ki', 'ra']), 'search the steal');
      const typeIt = find(snap, /type it instead/i);
      if (typeIt) return click(typeIt, 'type the steal');
    }
    return null;
  },
});
