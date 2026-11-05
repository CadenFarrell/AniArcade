import { describe, it, expect } from 'vitest';
import {
  BOARD, QUIZ, DD_FLOOR, advance, currentClue, expireClue, isDailyDouble, normalizeDeal, normalizeGame,
  pickCell, placeWager, requiredIds, revealNow, settleIfComplete, skipPicker, standings, startGame,
  stillToAct, submitAnswer, wagerLimit, quizAwards,
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
  it('opens a normal cell to its picker alone and spends it immediately', () => {
    const deal = boardDeal();
    let g = startGame(IDS, deal);
    expect(g.phase).toBe('board');
    expect(g.pickerId).toBe('ann');
    g = apply(g, pickCell(g, deal, 'ann', '0-1'));
    expect(g.phase).toBe('answering');
    expect(g.used['0-1']).toBe(true);
    expect(currentClue(g, deal).answer).toBe('a1');
    expect(requiredIds(g, IDS)).toEqual(['ann']);
    expect(g.solo).toBe('ann');
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

  it('takes the picker’s answer only, and reveals on it', () => {
    const deal = boardDeal();
    const g = apply(startGame(IDS, deal), pickCell(startGame(IDS, deal), deal, 'ann', '0-3'));
    expect(submitAnswer(g, deal, 'bo', 'a3', IDS).patch).toEqual({});
    const done = apply(g, submitAnswer(g, deal, 'ann', 'A3', IDS));
    expect(done.phase).toBe('revealed');
    expect(done.scores).toEqual({ ann: 800, bo: 0, cy: 0 });
    expect(done.answers.ann.delta).toBe(800);
  });

  it('charges a miss and a pass the clue’s value, into the negatives', () => {
    const deal = boardDeal();
    let g = apply(startGame(IDS, deal), pickCell(startGame(IDS, deal), deal, 'ann', '0-2'));
    g = apply(g, submitAnswer(g, deal, 'ann', 'nope', IDS));
    expect(g.scores.ann).toBe(-600);
    expect(g.answers.ann.delta).toBe(-600);
    g = apply(g, advance(g, deal, IDS));
    g = apply(g, pickCell(g, deal, 'bo', '0-0'));
    g = apply(g, submitAnswer(g, deal, 'bo', '', IDS));
    expect(g.scores).toEqual({ ann: -600, bo: -200, cy: 0 });
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

  it('charges a blank at the clock as a miss', () => {
    const deal = boardDeal();
    let g = startGame(IDS, deal, { timed: true, answerSeconds: 20 });
    g = apply(g, pickCell(g, deal, 'ann', '0-1', 0));
    g = apply(g, expireClue(g, deal, IDS));
    expect(g.phase).toBe('revealed');
    expect(g.answers.ann).toEqual({ text: '', correct: false, delta: -400 });
    expect(g.answers.bo).toBeUndefined();
    expect(g.scores).toEqual({ ann: -400, bo: 0, cy: 0 });
  });

  it('lets a clue whose player left go uncharged', () => {
    const deal = boardDeal();
    let g = apply(startGame(IDS, deal), pickCell(startGame(IDS, deal), deal, 'ann', '0-1'));
    g = apply(g, settleIfComplete(g, deal, ['bo', 'cy']));
    expect(g.phase).toBe('revealed');
    expect(g.scores).toEqual({ ann: 0, bo: 0, cy: 0 });
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

  // Plays the whole one-column board: the turn goes ann, bo, cy, ann, bo, and
  // ann answers right while the others miss — ann +200 +800, bo −400 −1000,
  // cy −600.
  function clearBoard() {
    let g = startGame(IDS, deal);
    for (let r = 0; r < 5; r++) {
      const turn = g.pickerId;
      g = apply(g, pickCell(g, deal, turn, `0-${r}`));
      g = apply(g, submitAnswer(g, deal, turn, turn === 'ann' ? `a${r}` : 'x', IDS));
      g = apply(g, advance(g, deal, IDS));
    }
    return g;
  }

  it('follows a cleared board, with everyone wagering', () => {
    const g = clearBoard();
    expect(g.round).toBe('final');
    expect(g.phase).toBe('wager');
    expect(currentClue(g, deal).answer).toBe('fin');
    expect(g.scores).toEqual({ ann: 1000, bo: -1400, cy: -600 });
    expect(stillToAct(g, IDS)).toEqual(IDS);
    expect(wagerLimit(g, 'ann')).toBe(1000);
    // Below zero there is nothing to stake, but the final is still theirs.
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
    expect(g.scores.ann).toBe(0);
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
  it('hands each question to the next seat, and runs to the end', () => {
    const deal = quizDeal();
    let g = startGame(['ann', 'bo'], deal, { timed: true, answerSeconds: 5 }, 100);
    expect(g.phase).toBe('answering');
    expect(g.deadlineAt).toBe(5100);
    expect(requiredIds(g, ['ann', 'bo'])).toEqual(['ann']);
    expect(submitAnswer(g, deal, 'bo', 'q0', ['ann', 'bo']).patch).toEqual({});
    g = apply(g, submitAnswer(g, deal, 'ann', 'q0', ['ann', 'bo']));
    expect(g.scores).toEqual({ ann: 100, bo: 0 });
    g = apply(g, advance(g, deal, ['ann', 'bo'], 200));
    expect(currentClue(g, deal).answer).toBe('q1');
    expect(g.solo).toBe('bo');
    expect(g.deadlineAt).toBe(5200);
    g = apply(g, submitAnswer(g, deal, 'bo', 'nope', ['ann', 'bo']));
    expect(g.scores).toEqual({ ann: 100, bo: -300 });
    g = apply(g, advance(g, deal, ['ann', 'bo']));
    expect(g.phase).toBe('finished');
  });

  it('reveals when the player answering leaves, and moves on past them', () => {
    const deal = quizDeal();
    let g = startGame(['ann', 'bo', 'cy'], deal);
    g = apply(g, settleIfComplete(g, deal, ['bo', 'cy']));
    expect(g.phase).toBe('revealed');
    expect(g.scores.ann).toBe(0);
    g = apply(g, advance(g, deal, ['bo', 'cy']));
    expect(g.solo).toBe('bo');
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

describe('the clue log and awards', () => {
  const players = IDS.map((id) => ({ id, name: id }));
  const titles = (log, scores = {}) => Object.fromEntries(quizAwards(log, players, scores).map((a) => [a.title, [a.player.id, a.detail]]));

  it('logs each revealed clue, and the log survives the room', () => {
    const deal = boardDeal();
    let g = startGame(IDS, deal);
    g = apply(g, pickCell(g, deal, 'ann', '0-4'));
    g = apply(g, submitAnswer(g, deal, 'ann', 'a4', IDS));
    expect(g.log).toEqual([{
      final: false, dd: false, top: true, low: false, answer: 'a4', answers: { ann: { correct: true, delta: 1000, blank: false } },
    }]);
    g = apply(g, advance(g, deal, IDS));
    g = apply(g, pickCell(g, deal, 'bo', '0-0'));
    g = apply(g, submitAnswer(g, deal, 'bo', '', IDS));
    expect(g.log[1]).toMatchObject({ low: true, answer: 'a0', answers: { bo: { correct: false, delta: -200, blank: true } } });
    expect(normalizeGame(JSON.parse(JSON.stringify(g))).log).toEqual(g.log);
    expect(normalizeGame({ phase: 'board' }).log).toEqual([]);
  });

  const a = (correct, delta, extra = {}) => ({ correct, delta, blank: false, ...extra });
  const line = (answers, extra = {}) => ({ final: false, dd: false, top: false, low: false, answer: 'Levi', answers, ...extra });

  it('names the hot hand, the big game hunter, the jackpot, all in and the comeback', () => {
    const log = [
      line({ ann: a(false, -400) }),
      line({ bo: a(true, 1000) }, { top: true }),
      line({ ann: a(true, 200) }),
      line({ bo: a(true, 1000) }, { top: true }),
      line({ ann: a(true, 600) }),
      line({ cy: a(true, 1500, { wager: 1500, before: 2000 }) }, { dd: true, answer: 'Rem' }),
      line({ ann: a(true, 800) }),
      line({ ann: a(true, 1200, { wager: 1200, before: 1200 }), bo: a(false, -500, { wager: 500, before: 2000 }) }, { final: true }),
    ];
    const t = titles(log, { ann: 2400, bo: 1500, cy: 1500 });
    expect(t['Hot hand']).toEqual(['ann', '4 right in a row']);
    expect(t['Big game hunter']).toEqual(['bo', 'Took 2 of the 1,000s']);
    expect(t.Jackpot).toEqual(['cy', '+1,500 on the Daily Double on Rem']);
    expect(t['All in']).toEqual(['ann', 'Bet all 1,200 on the final — and got it']);
    expect(t['Comeback kid']).toEqual(['ann', 'From −400 to first']);
    expect(t['Bold strategy']).toEqual(['bo', 'Bet 500 on the final — and lost']);
  });

  it('roasts the brain freeze, the gimme, rock bottom and the silent', () => {
    const log = [
      line({ cy: a(false, -200) }, { low: true, answer: 'Naruto' }),
      line({ cy: a(false, -1000) }, { answer: 'Gintoki' }),
      line({ cy: a(false, -600) }),
      line({ bo: a(false, -200, { blank: true }) }), line({ bo: a(false, -200, { blank: true }) }),
    ];
    const t = titles(log, { ann: 0, bo: -400, cy: -1800 });
    expect(t['Brain freeze']).toEqual(['cy', 'Lost 1,000 on Gintoki']);
    expect(t['Missed the gimme']).toEqual(['cy', 'Missed the 200 on Naruto']);
    expect(t['Rock bottom']).toEqual(['cy', 'Sank to −1,800']);
    expect(t['Cat got your tongue']).toEqual(['bo', 'Left 2 clues blank']);
    expect(t['Comeback kid']).toBeUndefined();
  });
});
