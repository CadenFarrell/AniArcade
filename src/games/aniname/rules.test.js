import { describe, expect, it } from 'vitest';
import {
  MAX_BID, NAME_GRACE_MS, addName, canJudge, endGame, judgeAnswer, missPoints, nextRound,
  normalizeDeal, normalizeGame, pass, placeBid, settleIfComplete, standings, startGame, stopNaming,
} from './rules';

const DEAL = {
  rounds: 2,
  namingMs: 60_000,
  cats: [{ kind: 'cast', key: 'naruto', label: 'Naruto', known: 10 }, { kind: 'studio', key: 'mappa', label: 'MAPPA', known: 8 }],
};
const IDS = ['a', 'b', 'c'];
const T0 = 1_000_000;
const apply = (game, { patch }) => ({ ...game, ...patch });
const right = (key) => ({ text: key, key, label: key, verdict: 'right' });
const unknown = (key) => ({ text: key, key: `?${key}`, label: key, verdict: 'pending' });

// a opens 3, b raises to 4, c drops, a drops: b names 4.
function toNaming(ids = IDS) {
  let g = startGame(ids, DEAL);
  g = apply(g, placeBid(g, 'a', 3, ids, T0));
  g = apply(g, placeBid(g, 'b', 4, ids, T0));
  g = apply(g, pass(g, 'c', ids, T0));
  g = apply(g, pass(g, 'a', ids, T0));
  return g;
}

describe('the auction', () => {
  it('goes round the table until nobody will raise, then the top bidder names', () => {
    const g = toNaming();
    expect(g).toMatchObject({ phase: 'naming', turnId: 'b', bid: { by: 'b', n: 4 }, deadlineAt: T0 + 60_000 });
  });

  it('refuses a bid that does not raise, one out of turn, and one over the cap', () => {
    let g = startGame(IDS, DEAL);
    expect(placeBid(g, 'b', 3, IDS, T0).patch).toEqual({});
    expect(placeBid(g, 'a', MAX_BID + 1, IDS, T0).patch).toEqual({});
    g = apply(g, placeBid(g, 'a', 3, IDS, T0));
    expect(placeBid(g, 'b', 3, IDS, T0).patch).toEqual({});
  });

  it('will not let the opener drop out before anyone bids', () => {
    expect(pass(startGame(IDS, DEAL), 'a', IDS, T0).patch).toEqual({});
  });

  it('sends a table of one straight to naming', () => {
    let g = startGame(['a'], DEAL);
    g = apply(g, placeBid(g, 'a', 5, ['a'], T0));
    expect(g.phase).toBe('naming');
  });
});

describe('naming', () => {
  it('ends the round the moment the bid is reached, and pays the bidder', () => {
    let g = toNaming();
    for (const k of ['x1', 'x2', 'x3']) g = apply(g, addName(g, 'b', right(k), IDS, T0));
    expect(g.phase).toBe('naming');
    g = apply(g, addName(g, 'b', right('x4'), IDS, T0));
    expect(g.phase).toBe('revealed');
    expect(g.scores).toEqual({ a: 0, b: 4, c: 0 });
    expect(g.result).toMatchObject({ by: 'b', n: 4, made: true, count: 4 });
  });

  it('counts a repeat once, and only the bidder may name', () => {
    let g = toNaming();
    g = apply(g, addName(g, 'b', right('x1'), IDS, T0));
    g = apply(g, addName(g, 'b', right('x1'), IDS, T0));
    expect(g.answers.map((a) => a.verdict)).toEqual(['right', 'repeat']);
    expect(addName(g, 'a', right('x2'), IDS, T0).patch).toEqual({});
  });

  it('refuses a name after the clock and its grace', () => {
    const g = toNaming();
    expect(addName(g, 'b', right('x1'), IDS, T0 + 60_000 + NAME_GRACE_MS + 1).patch).toEqual({});
  });

  it('pays everyone else half the bid on a miss', () => {
    let g = toNaming();
    g = apply(g, addName(g, 'b', right('x1'), IDS, T0));
    g = apply(g, stopNaming(g, 'b', IDS, T0));
    expect(g.phase).toBe('revealed');
    expect(g.scores).toEqual({ a: missPoints(4), b: 0, c: missPoints(4) });
  });

  it('lets anyone close the round only once the clock has run out', () => {
    const g = toNaming();
    expect(stopNaming(g, 'a', IDS, T0 + 1000).patch).toEqual({});
    expect(stopNaming(g, 'a', IDS, T0 + 60_000 + NAME_GRACE_MS).patch.phase).toBe('revealed');
  });
});

describe('the table’s review', () => {
  function toReview() {
    let g = toNaming();
    for (const k of ['x1', 'x2']) g = apply(g, addName(g, 'b', right(k), IDS, T0));
    for (const k of ['u1', 'u2', 'u3']) g = apply(g, addName(g, 'b', unknown(k), IDS, T0));
    return apply(g, stopNaming(g, 'b', IDS, T0));
  }

  it('goes to the table only when the unknown names could make the bid', () => {
    expect(toReview().phase).toBe('review');
    let g = toNaming();
    g = apply(g, addName(g, 'b', unknown('u1'), IDS, T0));
    expect(apply(g, stopNaming(g, 'b', IDS, T0)).phase).toBe('revealed');
  });

  it('lets anyone but the namer rule, and settles as soon as the result is decided', () => {
    let g = toReview();
    expect(canJudge(g, 'b', IDS)).toBe(false);
    expect(judgeAnswer(g, 'b', 2, true, IDS).patch).toEqual({});
    g = apply(g, judgeAnswer(g, 'a', 2, true, IDS));
    expect(g.phase).toBe('review');
    g = apply(g, judgeAnswer(g, 'c', 3, true, IDS));
    expect(g.phase).toBe('revealed');
    expect(g.result.made).toBe(true);
    expect(g.answers[4].verdict).toBe('pending');
  });

  it('settles a miss once too few unknowns are left', () => {
    let g = toReview();
    g = apply(g, judgeAnswer(g, 'a', 2, false, IDS));
    expect(g.phase).toBe('review');
    g = apply(g, judgeAnswer(g, 'a', 3, false, IDS));
    expect(g.phase).toBe('revealed');
    expect(g.result.made).toBe(false);
  });

  it('lets the namer rule when nobody else is here', () => {
    const g = toReview();
    expect(canJudge(g, 'b', ['b'])).toBe(true);
  });
});

describe('departures', () => {
  it('drops a departed bidder whose turn it is', () => {
    let g = startGame(IDS, DEAL);
    g = apply(g, placeBid(g, 'a', 3, IDS, T0));
    g = apply(g, settleIfComplete(g, ['a', 'c'], T0));
    expect(g.passed.b).toBe(true);
    expect(g.turnId).toBe('c');
  });

  it('moves the opening on when the opener has gone before bidding', () => {
    const g = apply(startGame(IDS, DEAL), settleIfComplete(startGame(IDS, DEAL), ['b', 'c'], T0));
    expect(g).toMatchObject({ opener: 'b', turnId: 'b' });
  });

  it('restarts the auction when the high bidder leaves', () => {
    let g = startGame(IDS, DEAL);
    g = apply(g, placeBid(g, 'a', 3, IDS, T0));
    g = apply(g, settleIfComplete(g, ['b', 'c'], T0));
    expect(g).toMatchObject({ phase: 'bidding', bid: null, turnId: 'b' });
  });

  it('voids the round when the namer leaves', () => {
    const g = apply(toNaming(), settleIfComplete(toNaming(), ['a', 'c'], T0));
    expect(g.phase).toBe('revealed');
    expect(g.result.void).toBe('left');
    expect(g.scores).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('ends the game on request, once', () => {
    const g = apply(toNaming(), endGame(toNaming()));
    expect(g.phase).toBe('finished');
    expect(endGame(g).patch).toEqual({});
  });
});

describe('advancing', () => {
  it('moves the opener one seat, skipping the departed, then finishes', () => {
    let g = toNaming();
    g = apply(g, stopNaming(g, 'b', IDS, T0));
    g = apply(g, nextRound(g, ['a', 'c']));
    expect(g).toMatchObject({ round: 1, opener: 'c', turnId: 'c', phase: 'bidding', bid: null, answers: [] });
    g = apply(g, placeBid(g, 'c', 1, ['c'], T0));
    g = apply(g, stopNaming(g, 'c', ['c'], T0));
    expect(apply(g, nextRound(g)).phase).toBe('finished');
  });
});

describe('repair', () => {
  it('rebuilds what RTDB drops and refuses a naming phase with no bid', () => {
    const g = normalizeGame({ order: { 0: 'a' }, phase: 'naming', scores: { a: '2' } });
    expect(g).toMatchObject({ order: ['a'], phase: 'bidding', bid: null, answers: [], passed: {}, scores: { a: 2 } });
    const answers = normalizeGame({ bid: { by: 'a', n: 2 }, phase: 'review', answers: { 0: { key: 'k', verdict: 'nope' } } }).answers;
    expect(answers).toEqual([{ text: '', key: 'k', label: '', verdict: 'pending', why: null }]);
    expect(normalizeDeal({ cats: { 0: { kind: 'cast', key: 'x', label: 'X' }, 1: { nope: 1 } } }).cats)
      .toEqual([{ kind: 'cast', key: 'x', label: 'X', known: 0 }, null]);
  });

  it('ranks ties together', () => {
    const r = standings([{ id: 'a' }, { id: 'b' }], { a: 3, b: 3 });
    expect(r.map((p) => p.position)).toEqual([1, 1]);
  });
});
