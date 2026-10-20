import { makeStrategy } from './base.js';
import { find, findAll, click } from '../core/generic.js';

export default makeStrategy({
  players: [1, 4],
  axes: {
    format: ['board', 'quiz'],
    answerStyle: ['choice', 'typed'],
    pool: ['shared', 'anyList', 'everything'],
    timed: [true, false],
  },
  act(snap, ctx) {
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
