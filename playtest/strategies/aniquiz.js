import { makeStrategy } from './base.js';
import { find, findAll, click } from '../core/generic.js';

export default makeStrategy({
  players: [1, 4],
  axes: {
    format: ['board', 'quiz'],
    answerStyle: ['choice', 'typed'],
    pool: ['shared', 'anyList', 'everything'],
    timed: [true, false],
    // One device only (online ignores it): answer by passing the device, or
    // out loud with the table ticking who got it.
    localAnswers: ['private', 'aloud'],
  },
  act(snap, ctx) {
    // Out loud: show the answer, then tick a random few (or nobody).
    const show = find(snap, /^show the answer$/i);
    if (show) return click(show, 'show the answer');
    const ticks = findAll(snap, / got it$/i).filter((c) => c.role === 'button' && !/^nobody/i.test(c.name));
    if (ticks.length) {
      const done = find(snap, /^done$/i);
      const pressed = ticks.filter((c) => c.pressed);
      if (!pressed.length && ctx.rng.chance(0.2)) return click(find(snap, /^nobody got it$/i), 'nobody got it');
      const unpressed = ticks.filter((c) => !c.pressed);
      if (unpressed.length && (!pressed.length || ctx.rng.chance(0.4))) return click(ctx.rng.pick(unpressed), 'tick who got it');
      if (done && !done.disabled) return click(done, 'done ticking');
    }
    const radios = findAll(snap, /./, { role: 'radio' });
    if (radios.length) {
      if (!radios.some((r) => r.checked)) return click(ctx.rng.pick(radios), 'answer');
      return click(find(snap, /lock in/i), 'lock in');
    }
    const cell = findAll(snap, / for \d+$/).filter((c) => c.role === 'button');
    if (cell.length) return click(ctx.rng.pick(cell), 'pick a clue');
    return null;
  },
});
