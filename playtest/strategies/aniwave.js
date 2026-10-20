// AniWave (wavelength/): one psychic sees where the target sits on a spectrum
// and gives a clue; everyone else, in turn, nudges a dial to where they think
// it is. The dial is a custom slider moved by its Nudge buttons, so a guess is
// a random number of nudges one way, then Lock it in — spread enough that
// reveals score everything from a bullseye to a miss.
import { makeStrategy } from './base.js';
import { find, findAll, click, fill, wait, has } from '../core/generic.js';

export default makeStrategy({
  players: [2, 6],
  axes: {
    rounds: [2, 4, 8],
    timed: [false, true],
    guessSeconds: [30, 60],
    clueMode: ['text', 'cards', 'readroom'],
    cardPool: ['characters', 'shows'],
    sharedOnly: [true, false],
  },
  // The card modes need a dozen cards; a table whose shared list is shorter
  // is told so and refused. Answer it the way the warning says to.
  fixBlocked(snap) {
    const shared = find(snap, /shared cards only/i, { role: 'checkbox' });
    if (shared?.checked && has(snap, /turn off “shared cards only”/i)) return click(shared, 'turn off shared-only');
    const typed = find(snap, /^typed clue/i);
    if (typed && has(snap, /needs \d+|needs a list/i)) return click(typed, 'switch to typed clues');
    return null;
  },
  onBlocked: () => ({ expected: true }),
  act(snap, ctx) {
    const { rng, memory, scenario } = ctx;

    // The psychic: choose a spectrum (now and then write one), then a clue.
    const own = find(snap, /write your own/i);
    const spectra = findAll(snap, /→/).filter((c) => !/next|lock|give the clue|show me/i.test(c.name));
    if (has(snap, /you're the psychic/i)) {
      const left = find(snap, /^left end$/i);
      const right = find(snap, /^right end$/i);
      if (left && !left.value) return fill(left, rng.pick(['Calm', 'Cute', 'Weak']), 'write a spectrum');
      if (right && !right.value) return fill(right, rng.pick(['Chaotic', 'Scary', 'Strong']), 'write a spectrum');
      const clue = find(snap, /clue/i, { role: 'textbox' });
      if (clue && !clue.value) return fill(clue, rng.word(), 'give a clue');
      const give = find(snap, /give the clue/i);
      if (give) return click(give, 'give the clue');
      if (spectra.length && !memory.spectrumPicked) {
        memory.spectrumPicked = true;
        if (own && rng.chance(0.1)) return click(own, 'write your own spectrum');
        return click(rng.pick(spectra), 'pick a spectrum');
      }
    } else {
      memory.spectrumPicked = false;
    }

    // A guesser's dial: nudge a seeded number of times, then lock in.
    const lock = find(snap, /^lock it in/i);
    const left = find(snap, /^nudge left$/i);
    const rightN = find(snap, /^nudge right$/i);
    if (lock && left && rightN) {
      if (memory.nudges == null) {
        memory.nudges = rng.int(0, 12);
        memory.dir = rng.chance(0.5) ? left.name : rightN.name;
        if (scenario.prefs.timed && rng.chance(0.08)) { memory.nudges = null; return wait(scenario.prefs.guessSeconds * 1000 + 1500, 'let the clock run out'); }
      }
      if (memory.nudges > 0) { memory.nudges--; return click(find(snap, new RegExp(`^${memory.dir}$`, 'i')), 'nudge the dial'); }
      memory.nudges = null;
      return click(lock, 'lock in the dial');
    }
    return null;
  },
});
