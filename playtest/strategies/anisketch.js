// AniSketch: the drawer picks one of their characters in secret and draws it
// against the clock; everyone else names it — shouted and tapped on one
// device, typed online.
//
// What the bot has to get right that the generic fallback would not:
//   - the drawing itself is no button: the bot DRAWS (the `draw` action,
//     core/draw.js) a couple of strokes a turn, and undoes one now and then;
//   - locally the drawer then credits "<name> got it", gives up, or lets the
//     clock run out — the fallback would tap "Clear" and "Peek" forever;
//   - online a guess is the "Your guess" box then "Guess", held while one is
//     being checked (waited out, not resent).
// The bot cannot see who is drawn, so online its guesses are names off the
// fixture lists — right only by luck — and an online drawer gives up after a
// few looks so a run is not every turn's whole clock. Locally a random
// guesser is credited, so every scoring branch is reached.
import { makeStrategy } from './base.js';
import { find, findAll, click, fill, wait } from '../core/generic.js';
import { FIXTURE_PROFILES } from '../core/scenarios.js';

const NAMES = [...new Set((Array.isArray(FIXTURE_PROFILES) ? FIXTURE_PROFILES : Object.values(FIXTURE_PROFILES))
  .flatMap((p) => (p.animeList ?? []).flatMap((a) => (a.characters ?? []).map((c) => c.name)))
  .filter(Boolean))];
const GUESSES = NAMES.length ? NAMES : ['Hero One', 'Rival Two'];

// A stroke: three to five points somewhere on the pad, as fractions of its box.
function stroke(rng) {
  const n = rng.int(3, 5);
  return Array.from({ length: n }, () => [Number((0.1 + rng.next() * 0.8).toFixed(3)), Number((0.1 + rng.next() * 0.8).toFixed(3))]);
}

export default makeStrategy({
  players: [2, 5],
  onlinePlayers: [2, 3],
  axes: {
    laps: [1, 1, 2],
    drawSeconds: [60, 80, 100],
    choices: [2, 3, 4],
    sharedFirst: [true, false],
  },
  // A list short of characters for the drawings: once round the table, and
  // fewer to choose from.
  fixBlocked(snap) {
    const laps = find(snap, /^times round the table$/i, { role: 'spinbutton' }) ?? find(snap, /^times round the table$/i);
    if (laps && Number(laps.value) > 1) return { fill: laps.id, name: laps.name, text: '1', why: 'once round the table' };
    const choices = find(snap, /^characters to choose from$/i, { role: 'spinbutton' }) ?? find(snap, /^characters to choose from$/i);
    if (choices && Number(choices.value) > 2) return { fill: choices.id, name: choices.name, text: '2', why: 'fewer to choose from' };
    return null;
  },
  onBlocked: () => ({ expected: true }),

  act(snap, ctx) {
    const { rng, memory } = ctx;
    const turn = /turn (\d+)\//i.exec(snap.text)?.[1] ?? '0';
    const heading = `${snap.heading ?? ''}`;

    const ready = find(snap, /— ready$/i);
    if (ready) return click(ready, 'take the device to draw');
    const choices = findAll(snap, /^draw /i);
    if (choices.length && /pick what to draw/i.test(heading)) return click(rng.pick(choices), 'pick who to draw');
    const start = find(snap, /^start drawing$/i);
    if (start) return click(start, 'start drawing');

    // The drawer, with the pad and the toolbar.
    if (/^draw!$/i.test(heading)) {
      const drawn = memory.drawn?.turn === turn ? memory.drawn.n : 0;
      if (drawn < 2) {
        memory.drawn = { turn, n: drawn + 1 };
        return { draw: stroke(rng), why: 'draw a stroke' };
      }
      const undo = find(snap, /^undo$/i);
      if (undo && !memory.undid?.[turn] && rng.chance(0.15)) {
        memory.undid = { ...memory.undid, [turn]: true };
        return click(undo, 'undo a stroke');
      }
      const credits = findAll(snap, / got it$/i, { role: 'button' });
      const giveUp = find(snap, /^give up$/i);
      if (credits.length) {
        // Locally: somebody shouted it, or the drawer gives up, or the clock goes.
        if (rng.chance(0.1) && giveUp) return click(giveUp, 'give up on this one');
        if (rng.chance(0.1)) return wait((ctx.scenario.prefs.drawSeconds ?? 80) * 1000 + 2000, 'let the clock run out');
        return click(rng.pick(credits), 'credit whoever shouted it');
      }
      // Online: the guessers are typing. Give up after a few looks so a run
      // is not every turn's full clock.
      memory.looks = memory.looks?.turn === turn ? { turn, n: memory.looks.n + 1 } : { turn, n: 1 };
      if (giveUp && memory.looks.n > 2 && rng.chance(0.7)) return click(giveUp, 'give up on this one');
      return wait(2000, 'watch the guesses come in');
    }

    // A guesser, online.
    const box = find(snap, /^your guess$/i, { role: 'textbox' });
    if (box) {
      const send = find(snap, /^guess$/i);
      if (box.value && send) return click(send, 'send the guess');
      if (box.value) return wait(600, 'the guess is being checked');
      return fill(box, rng.pick(GUESSES), 'guess a name');
    }
    if (/guess the drawing|is choosing/i.test(heading)) return wait(800, 'wait on the drawer');

    const next = find(snap, /^(next turn|see results)$/i);
    if (next) return click(next, 'next');
    return null;
  },
});
