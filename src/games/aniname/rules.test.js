import { describe, expect, it } from 'vitest';
import {
  MAX_BID, NAME_GRACE_MS, addName, beginNaming, canJudge, challengeAnswer, endGame, judgeAnswer,
  judgesFor, missPoints, nextRound, normalizeDeal, normalizeGame, pass, placeBid, settleIfComplete,
  nameAwards, standings, startGame, stopNaming, tally,
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

describe('the table’s vote (online)', () => {
  const FOUR = ['a', 'b', 'c', 'd'];
  const VOTE = { vote: true };
  // b names 4 with two right and three unknown, judged by a, c and d.
  function toReview(ids = FOUR) {
    let g = startGame(ids, DEAL);
    g = apply(g, placeBid(g, 'a', 3, ids, T0));
    g = apply(g, placeBid(g, 'b', 4, ids, T0));
    for (const id of ids.slice(2)) g = apply(g, pass(g, id, ids, T0));
    g = apply(g, pass(g, 'a', ids, T0));
    for (const k of ['x1', 'x2']) g = apply(g, addName(g, 'b', right(k), ids, T0));
    for (const k of ['u1', 'u2', 'u3']) g = apply(g, addName(g, 'b', unknown(k), ids, T0));
    return apply(g, stopNaming(g, 'b', ids, T0));
  }

  it('decides a name by majority, never by one judge alone', () => {
    let g = toReview();
    expect(judgesFor(g, FOUR)).toEqual(['a', 'c', 'd']);
    g = apply(g, judgeAnswer(g, 'a', 2, false, FOUR, VOTE));
    expect(g.answers[2]).toMatchObject({ verdict: 'pending', votes: { a: false } });
    g = apply(g, judgeAnswer(g, 'c', 2, false, FOUR, VOTE));
    expect(g.answers[2].verdict).toBe('wrong');
  });

  it('gives a tie to the namer', () => {
    // Two judges (a and c): one yes is half, which accepts.
    let g = toReview(IDS);
    g = apply(g, judgeAnswer(g, 'a', 2, true, IDS, VOTE));
    expect(g.answers[2].verdict).toBe('right');
    // ...while one no of two is not more than half.
    g = apply(g, judgeAnswer(g, 'c', 3, false, IDS, VOTE));
    expect(g.answers[3].verdict).toBe('pending');
  });

  it('lets a judge change their vote until the name is decided', () => {
    let g = toReview();
    g = apply(g, judgeAnswer(g, 'a', 2, false, FOUR, VOTE));
    g = apply(g, judgeAnswer(g, 'a', 2, true, FOUR, VOTE));
    expect(g.answers[2].votes).toEqual({ a: true });
    expect(tally(g.answers[2], ['a', 'c', 'd'])).toBeNull();
    expect(tally({ votes: { a: true, c: true } }, ['a', 'c', 'd'])).toBe('right');
  });

  it('re-counts without a judge who left, which can decide the name', () => {
    let g = toReview();
    g = apply(g, judgeAnswer(g, 'a', 2, false, FOUR, VOTE));
    g = apply(g, judgeAnswer(g, 'c', 2, true, FOUR, VOTE));
    expect(g.answers[2].verdict).toBe('pending');
    // d leaves: a and c split one each, a tie, which goes to the namer.
    g = apply(g, settleIfComplete(g, ['a', 'b', 'c']));
    expect(g.answers[2].verdict).toBe('right');
  });
});

describe('the clock handoff and the challenge', () => {
  it('leaves the clock unstarted with no `now`, and starts it once for the namer', () => {
    let g = startGame(['a', 'b'], DEAL);
    g = apply(g, placeBid(g, 'a', 2, ['a', 'b'], null));
    g = apply(g, pass(g, 'b', ['a', 'b'], null));
    expect(g).toMatchObject({ phase: 'naming', deadlineAt: null });
    expect(addName(g, 'a', right('x1'), ['a', 'b'], T0).patch).toEqual({});
    expect(beginNaming(g, 'b', T0).patch).toEqual({});
    g = apply(g, beginNaming(g, 'a', T0));
    expect(g.deadlineAt).toBe(T0 + 60_000);
    expect(beginNaming(g, 'a', T0 + 5).patch).toEqual({});
    expect(apply(g, addName(g, 'a', right('x1'), ['a', 'b'], T0 + 1)).answers).toHaveLength(1);
  });

  it('lets the namer send a name the arcade marked wrong to the table', () => {
    let g = toNaming();
    g = apply(g, addName(g, 'b', { text: 'Levi', key: 'levi', label: 'Levi', verdict: 'wrong', why: 'not in Naruto' }, IDS, T0));
    expect(challengeAnswer(g, 'a', 0).patch).toEqual({});
    g = apply(g, challengeAnswer(g, 'b', 0));
    expect(g.answers[0]).toMatchObject({ verdict: 'pending', why: 'challenged' });
    // Pending now, so it counts toward going to the table.
    for (const k of ['x1', 'x2', 'x3']) g = apply(g, addName(g, 'b', right(k), IDS, T0));
    expect(apply(g, stopNaming(g, 'b', IDS, T0)).phase).toBe('review');
  });

  it('never re-opens a name the table rejected, or one after the clock', () => {
    const g = { ...toNaming(), answers: [{ text: 'x', key: 'x', label: 'x', verdict: 'wrong', why: 'table said no' }] };
    expect(challengeAnswer(g, 'b', 0).patch).toEqual({});
    expect(challengeAnswer({ ...g, phase: 'review' }, 'b', 0).patch).toEqual({});
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
    expect(answers).toEqual([{ text: '', key: 'k', label: '', verdict: 'pending', why: null, votes: {} }]);
    expect(normalizeDeal({ cats: { 0: { kind: 'cast', key: 'x', label: 'X' }, 1: { nope: 1 } } }).cats)
      .toEqual([{ kind: 'cast', key: 'x', label: 'X', known: 0 }, null]);
  });

  it('ranks ties together', () => {
    const r = standings([{ id: 'a' }, { id: 'b' }], { a: 3, b: 3 });
    expect(r.map((p) => p.position)).toEqual([1, 1]);
  });
});

describe('the game log and its awards', () => {
  const players = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Cat' }];

  it('logs each revealed round on the way to the next, the last one included', () => {
    let g = toNaming();
    for (const k of ['x1', 'x2', 'x3', 'x4']) g = apply(g, addName(g, 'b', right(k), IDS, T0));
    g = apply(g, nextRound(g, IDS));
    expect(g.log).toEqual([{ round: 0, by: 'b', n: 4, made: true, count: 4, void: null }]);
    expect(normalizeGame({ ...g, log: { 0: g.log[0] } }).log).toEqual(g.log);
  });

  it('names the biggest bid made and the biggest that fell short, and drops a tie', () => {
    const log = [{ by: 'a', n: 6, made: true, count: 6 }, { by: 'b', n: 4, made: true, count: 4 }, { by: 'c', n: 9, made: false, count: 5 }];
    expect(nameAwards(log, players).map((x) => [x.title, x.player.id])).toEqual([['Big talker', 'a'], ['Overreach', 'c']]);
    expect(nameAwards([log[0], { ...log[0], by: 'b' }], players)).toEqual([]);
  });
});
