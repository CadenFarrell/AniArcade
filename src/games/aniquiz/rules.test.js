import { describe, it, expect } from 'vitest';
import {
  BOARD, QUIZ, DD_FLOOR, advance, currentClue, expireClue, isDailyDouble, normalizeDeal, normalizeGame,
  pickCell, placeWager, requiredIds, revealNow, settleIfComplete, skipPicker, standings, startGame,
  stillToAct, submitAnswer, wagerLimit,
} from './rules';

// A hand-built deal: grading only ever reads `accept`, so a clue here needs
// nothing the generator would add.
const clue = (answer, value, extra = {}) => ({
  id: answer, prompt: `Q ${answer}`, answer, kind: 'name', accept: [answer.toLowerCase()], value, ...extra,
});

const boardDeal = (over = {}) => ({
  format: BOARD,
  categories: [
    { id: 'a', title: 'A', clues: [200, 400, 600, 800, 1000].map((v, r) => clue(`a${r}`, v)) },
    { id: 'b', title: 'B', clues: [200, 400, 600, 800, 1000].map((v, r) => clue(`b${r}`, v)) },
  ],
  dailyDouble: '1-2',
  final: clue('fin', 0),
  ...over,
});

const quizDeal = () => ({ format: QUIZ, questions: [clue('q0', 100), clue('q1', 300)] });

const IDS = ['ann', 'bo', 'cy'];
const apply = (game, { patch }) => ({ ...game, ...patch });

describe('the board', () => {
  it('opens a normal cell to the whole table and spends it immediately', () => {
    const deal = boardDeal();
    let g = startGame(IDS, deal);
    expect(g.phase).toBe('board');
    expect(g.pickerId).toBe('ann');
    g = apply(g, pickCell(g, deal, 'ann', '0-1'));
    expect(g.phase).toBe('answering');
    expect(g.used['0-1']).toBe(true);
    expect(currentClue(g, deal).answer).toBe('a1');
    expect(requiredIds(g, IDS)).toEqual(IDS);
  });

  it('refuses a pick out of turn, a spent cell, and a cell off the board', () => {
    const deal = boardDeal();
    const g = startGame(IDS, deal);
    expect(pickCell(g, deal, 'bo', '0-0').patch).toEqual({});
    expect(pickCell(g, deal, 'ann', '9-0').patch).toEqual({});
    const used = apply(g, pickCell(g, deal, 'ann', '0-0'));
    const back = { ...used, phase: 'board' };
    expect(pickCell(back, deal, 'ann', '0-0').patch).toEqual({});
  });

  it('pays face value for right, nothing for wrong, and reveals when everyone is in', () => {
    const deal = boardDeal();
    let g = apply(startGame(IDS, deal), pickCell(startGame(IDS, deal), deal, 'ann', '0-3'));
    g = apply(g, submitAnswer(g, deal, 'ann', 'A3', IDS));
    expect(g.phase).toBe('answering');
    g = apply(g, submitAnswer(g, deal, 'bo', 'nope', IDS));
    g = apply(g, submitAnswer(g, deal, 'cy', 'a3', IDS));
    expect(g.phase).toBe('revealed');
    expect(g.scores).toEqual({ ann: 800, bo: 0, cy: 800 });
    expect(g.answers.ann.delta).toBe(800);
    expect(g.answers.bo.delta).toBe(0);
  });

  it('will not take a second answer from the same player', () => {
    const deal = boardDeal();
    let g = apply(startGame(IDS, deal), pickCell(startGame(IDS, deal), deal, 'ann', '0-0'));
    g = apply(g, submitAnswer(g, deal, 'ann', 'wrong', IDS));
    expect(submitAnswer(g, deal, 'ann', 'a0', IDS).patch).toEqual({});
  });

  it('rotates the pick round the table, skipping anyone who left', () => {
    const deal = boardDeal();
    let g = apply(startGame(IDS, deal), pickCell(startGame(IDS, deal), deal, 'ann', '0-0'));
    g = apply(g, revealNow(g, deal));
    g = apply(g, advance(g, deal, ['ann', 'cy']));
    expect(g.phase).toBe('board');
    expect(g.pickerId).toBe('cy');
    expect(g.answers).toEqual({});
    expect(g.cell).toBeNull();
  });

  it('hands the pick on when the picker leaves while the board waits', () => {
    const deal = boardDeal();
    const g = startGame(IDS, deal);
    expect(skipPicker(g, ['bo', 'cy']).patch.pickerId).toBe('bo');
    expect(settleIfComplete(g, deal, ['bo', 'cy']).patch.pickerId).toBe('bo');
    expect(skipPicker(g, IDS).patch).toEqual({});
  });
});

describe('the clock', () => {
  it('stamps a deadline only when the game is timed and a clock is given', () => {
    const deal = boardDeal();
    const timed = startGame(IDS, deal, { timed: true, answerSeconds: 20 });
    expect(pickCell(timed, deal, 'ann', '0-0', 1000).patch.deadlineAt).toBe(21000);
    expect(pickCell(timed, deal, 'ann', '0-0', null).patch.deadlineAt).toBeNull();
    const untimed = startGame(IDS, deal, { timed: false });
    expect(pickCell(untimed, deal, 'ann', '0-0', 1000).patch.deadlineAt).toBeNull();
  });

  it('records a blank for everyone still owing an answer when it runs out', () => {
    const deal = boardDeal();
    let g = startGame(IDS, deal, { timed: true, answerSeconds: 20 });
    g = apply(g, pickCell(g, deal, 'ann', '0-0', 0));
    g = apply(g, submitAnswer(g, deal, 'ann', 'a0', IDS));
    g = apply(g, expireClue(g, deal, IDS));
    expect(g.phase).toBe('revealed');
    expect(g.answers.bo).toEqual({ text: '', correct: false, delta: 0 });
    expect(g.scores.ann).toBe(200);
  });

  it('does nothing on an untimed clue', () => {
    const deal = boardDeal();
    const g = apply(startGame(IDS, deal), pickCell(startGame(IDS, deal), deal, 'ann', '0-0'));
    expect(expireClue(g, deal, IDS).patch).toEqual({});
  });
});

describe('the Daily Double', () => {
  const deal = boardDeal();
  const atDD = () => {
    const g = startGame(IDS, deal);
    return apply(g, pickCell(g, deal, 'ann', '1-2'));
  };

  it('goes to a wager that only its finder can place', () => {
    const g = atDD();
    expect(g.phase).toBe('wager');
    expect(isDailyDouble(g, deal)).toBe(true);
    expect(requiredIds(g, IDS)).toEqual(['ann']);
    expect(placeWager(g, deal, 'bo', 100, IDS).patch).toEqual({});
  });

  it('lets somebody on zero wager up to the floor, and clamps beyond it', () => {
    let g = atDD();
    expect(wagerLimit(g, 'ann')).toBe(DD_FLOOR);
    g = apply(g, placeWager(g, deal, 'ann', 99999, IDS));
    expect(g.wagers.ann).toBe(DD_FLOOR);
    expect(g.phase).toBe('answering');
  });

  it('is answered by the finder alone, and a miss costs the stake', () => {
    let g = atDD();
    g = apply(g, placeWager(g, deal, 'ann', 500, IDS));
    expect(submitAnswer(g, deal, 'bo', 'b2', IDS).patch).toEqual({});
    g = apply(g, submitAnswer(g, deal, 'ann', 'wrong', IDS));
    expect(g.phase).toBe('revealed');
    expect(g.scores.ann).toBe(-500);
    expect(g.scores.bo).toBe(0);
  });

  it('a blank at the buzzer costs the stake too', () => {
    let g = startGame(IDS, deal, { timed: true, answerSeconds: 10 });
    g = apply(g, pickCell(g, deal, 'ann', '1-2', 0));
    g = apply(g, placeWager(g, deal, 'ann', 300, IDS, 0));
    g = apply(g, expireClue(g, deal, IDS));
    expect(g.scores.ann).toBe(-300);
  });

  it('is voided, not stuck, when its finder leaves', () => {
    let g = atDD();
    g = apply(g, settleIfComplete(g, deal, ['bo', 'cy']));
    expect(g.phase).toBe('revealed');
    expect(g.scores).toEqual({ ann: 0, bo: 0, cy: 0 });
  });
});

describe('the final', () => {
  const deal = boardDeal({ categories: [{ id: 'a', title: 'A', clues: [200, 400, 600, 800, 1000].map((v, r) => clue(`a${r}`, v)) }], dailyDouble: null });

  // Plays the whole one-column board with ann answering everything right.
  function clearBoard() {
    let g = startGame(IDS, deal);
    for (let r = 0; r < 5; r++) {
      g = apply(g, pickCell(g, deal, g.pickerId, `0-${r}`));
      for (const id of IDS) g = apply(g, submitAnswer(g, deal, id, id === 'ann' ? `a${r}` : 'x', IDS));
      g = apply(g, advance(g, deal, IDS));
    }
    return g;
  }

  it('follows a cleared board, with everyone wagering', () => {
    const g = clearBoard();
    expect(g.round).toBe('final');
    expect(g.phase).toBe('wager');
    expect(currentClue(g, deal).answer).toBe('fin');
    expect(stillToAct(g, IDS)).toEqual(IDS);
    expect(wagerLimit(g, 'ann')).toBe(3000);
    expect(wagerLimit(g, 'bo')).toBe(0);
  });

  it('opens only once every wager is in, and settles every stake', () => {
    let g = clearBoard();
    g = apply(g, placeWager(g, deal, 'ann', 1000, IDS));
    g = apply(g, placeWager(g, deal, 'bo', 0, IDS));
    expect(g.phase).toBe('wager');
    g = apply(g, placeWager(g, deal, 'cy', 0, IDS));
    expect(g.phase).toBe('answering');
    g = apply(g, submitAnswer(g, deal, 'ann', 'wrong', IDS));
    g = apply(g, submitAnswer(g, deal, 'bo', 'fin', IDS));
    g = apply(g, submitAnswer(g, deal, 'cy', 'fin', IDS));
    expect(g.phase).toBe('revealed');
    expect(g.scores.ann).toBe(2000);
    g = apply(g, advance(g, deal, IDS));
    expect(g.phase).toBe('finished');
  });

  it('does not wait on somebody who left during the wagers', () => {
    let g = clearBoard();
    g = apply(g, placeWager(g, deal, 'ann', 10, IDS));
    g = apply(g, placeWager(g, deal, 'bo', 0, IDS));
    g = apply(g, settleIfComplete(g, deal, ['ann', 'bo']));
    expect(g.phase).toBe('answering');
    expect(requiredIds(g, IDS)).toEqual(['ann', 'bo']);
  });

  it('skips straight to the end when there is no final', () => {
    const noFinal = { ...deal, final: null };
    let g = startGame(['ann'], noFinal);
    for (let r = 0; r < 5; r++) {
      g = apply(g, pickCell(g, noFinal, 'ann', `0-${r}`));
      g = apply(g, submitAnswer(g, noFinal, 'ann', 'x', ['ann']));
      g = apply(g, advance(g, noFinal, ['ann']));
    }
    expect(g.phase).toBe('finished');
  });
});

describe('quiz', () => {
  it('opens on the first question and runs to the end', () => {
    const deal = quizDeal();
    let g = startGame(['ann', 'bo'], deal, { timed: true, answerSeconds: 5 }, 100);
    expect(g.phase).toBe('answering');
    expect(g.deadlineAt).toBe(5100);
    g = apply(g, submitAnswer(g, deal, 'ann', 'q0', ['ann', 'bo']));
    g = apply(g, submitAnswer(g, deal, 'bo', 'q0', ['ann', 'bo']));
    expect(g.scores).toEqual({ ann: 100, bo: 100 });
    g = apply(g, advance(g, deal, ['ann', 'bo'], 200));
    expect(currentClue(g, deal).answer).toBe('q1');
    expect(g.deadlineAt).toBe(5200);
    g = apply(g, revealNow(g, deal));
    g = apply(g, advance(g, deal, ['ann', 'bo']));
    expect(g.phase).toBe('finished');
  });

  it('reveals when the last player still waited on leaves', () => {
    const deal = quizDeal();
    let g = startGame(['ann', 'bo'], deal);
    g = apply(g, submitAnswer(g, deal, 'ann', 'q0', ['ann', 'bo']));
    g = apply(g, settleIfComplete(g, deal, ['ann']));
    expect(g.phase).toBe('revealed');
    expect(g.answers.bo).toBeUndefined();
  });
});

describe('repair', () => {
  it('restores every collection Realtime Database dropped', () => {
    const g = normalizeGame({ phase: 'board', order: { 0: 'ann', 1: 'bo' }, pickerId: 'ann', timed: true, answerMs: 20000 });
    expect(g.order).toEqual(['ann', 'bo']);
    expect(g.answers).toEqual({});
    expect(g.wagers).toEqual({});
    expect(g.used).toEqual({});
    expect(g.cell).toBeNull();
    expect(g.deadlineAt).toBeNull();
    expect(g.round).toBe('main');
  });

  it('keeps a blank answer and a zero wager — both are real values', () => {
    const g = normalizeGame({ answers: { ann: { text: '', correct: false } }, wagers: { ann: 0 } });
    expect(g.answers.ann).toEqual({ text: '', correct: false, delta: 0 });
    expect(g.wagers.ann).toBe(0);
  });

  it('round-trips a deal through JSON', () => {
    const deal = normalizeDeal(JSON.parse(JSON.stringify(boardDeal())));
    expect(deal.categories).toHaveLength(2);
    expect(deal.categories[1].clues[4].answer).toBe('b4');
    expect(deal.final.answer).toBe('fin');
    expect(normalizeDeal(null)).toBeNull();
  });
});

describe('standings', () => {
  it('shares a place on a tie', () => {
    const rows = standings([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { a: 5, b: 9, c: 5 });
    expect(rows.map((r) => [r.id, r.position])).toEqual([['b', 1], ['a', 2], ['c', 2]]);
  });
});
