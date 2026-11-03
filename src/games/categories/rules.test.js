import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CAP, MAX_CAP, MAX_PROPOSAL_LEN, MIN_CAP, MIN_PLAYERS, WRONG_DECLARATION_COST,
  CATEGORY_SOURCES, applyRoundScores, beginNaming, declareCategory, everyonePicked,
  explainRound, finalScores, hasPicked, isTablePicked, judge, judgeIdFor, nextSeatId,
  nextTurn, normalizeGame, normalizePending, normalizeResults, normalizeTrail,
  normalizeTrails, passTurn, pickingFor, proposalsLeft, proposalsUsed, proposeName,
  recordPick, requiredJudges, roundComplete, scoreTurn, skipDepartedSeat, startRound,
  toSpec, trailFor, turnOrder, verdictsOf,
} from './rules';

const IDS = ['a', 'b', 'c'];
const apply = (state, { patch }) => ({ ...state, ...patch });

// Everyone who owes an answer gives the same one. Recomputing the required list
// per call would be wrong once the last verdict settles the pending and the
// list empties, so it is resolved up front — which is also how the hooks do it.
//
// THE ROSTER GOES IN AS WELL, and it has to: a settled name hands the seat to
// the next player, and judge cannot work out who that is without it. Leaving it
// off would leave every test below playing a game where the seat never moves —
// which is precisely the game this suite is here to say we no longer have.
const ruleAll = (state, verdict, ids = IDS, skip = []) => {
  const required = requiredJudges(state, ids, skip);
  let s = state;
  for (const id of required) s = apply(s, judge(s, id, verdict, required, ids, skip));
  return s;
};

// Drives `count` fully judged names, each by whoever holds the seat at the time
// — so it walks round the table rather than down one player's turn.
const withNames = (state, count, verdict = false, ids = IDS) => {
  let s = state;
  for (let i = 0; i < count; i++) {
    s = apply(s, proposeName(s, s.seatId, `name ${i}`));
    s = ruleAll(s, verdict, ids);
  }
  return s;
};

// Whole laps of the table, so EVERY player spends `laps` names and the seat
// comes back to whoever opened. "Give one player three names" is a lap-shaped
// question now, not a loop-shaped one.
const withLaps = (state, laps, verdict = false, ids = IDS) => (
  withNames(state, laps * ids.length, verdict, ids)
);

// A table-picked round with the picking phase already done, for the tests about
// what comes after it.
const tableRound = (opts = {}) => {
  let s = startRound(IDS, { source: 'table', ...opts });
  for (const id of IDS) s = apply(s, recordPick(s, id));
  return apply(s, beginNaming(s, IDS));
};

describe('startRound', () => {
  it('opens on the first player who is actually here', () => {
    expect(startRound(IDS).seatId).toBe('a');
    expect(startRound(IDS, { skipIds: ['a'] }).seatId).toBe('b');
  });

  it('starts with nothing decided and nothing pending', () => {
    const s = startRound(IDS);
    expect(s.phase).toBe('naming');
    expect(s.pending).toBeNull();
    expect(s.trails).toEqual({});
    expect(s.results).toEqual({});
  });

  // The clause is the one thing this game hides, and startRound is called by
  // the host online. If one could reach round state it would be readable by
  // every member of the room watching raw RTDB — the target included.
  it('never puts a category anywhere in round state, from either source', () => {
    for (const source of CATEGORY_SOURCES) {
      const json = JSON.stringify(startRound(IDS, { round: 3, cap: 8, source }));
      expect(json, source).not.toMatch(/categor/i);
      expect(json, source).not.toMatch(/assignment|secret/i);
    }
  });

  // The source has to reach the round, because it decides whether there is a
  // picking phase at all.
  it('opens a table-picked round on picking and a random one straight onto a go', () => {
    expect(startRound(IDS, { source: 'table' }).phase).toBe('picking');
    expect(isTablePicked(startRound(IDS, { source: 'table' }))).toBe(true);
    expect(startRound(IDS, { source: 'random' }).phase).toBe('naming');
    expect(isTablePicked(startRound(IDS, { source: 'random' }))).toBe(false);
  });

  it('clamps the cap into range', () => {
    expect(startRound(IDS, { cap: 999 }).cap).toBe(MAX_CAP);
    expect(startRound(IDS, { cap: 0 }).cap).toBe(MIN_CAP);
    expect(startRound(IDS, { cap: 'nonsense' }).cap).toBe(DEFAULT_CAP);
  });

  it('needs two players — a hot seat and somebody to answer', () => {
    expect(MIN_PLAYERS).toBe(2);
  });
});

describe('toSpec', () => {
  it('accepts the two shapes categories.js resolves', () => {
    expect(toSpec('glasses')).toBe('glasses');
    expect(toSpec({ id: 'x', label: 'y', custom: true })).toEqual({ id: 'x', label: 'y', custom: true });
  });

  // RTDB does not store an empty object, so accepting {} would deal a turn
  // whose category reads back absent.
  it('rejects everything RTDB would decline to store', () => {
    for (const spec of [null, undefined, '', {}, [], 0, false]) {
      expect(toSpec(spec), JSON.stringify(spec)).toBeNull();
    }
  });
});

describe('nextSeatId', () => {
  it('is the first player still here who has not had a turn', () => {
    expect(nextSeatId(IDS, {}, [])).toBe('a');
    expect(nextSeatId(IDS, { a: { solved: true } }, [])).toBe('b');
    expect(nextSeatId(IDS, {}, ['a', 'b'])).toBe('c');
  });

  it('is null once nobody is left to take one', () => {
    expect(nextSeatId(IDS, { a: {}, b: {}, c: {} }, [])).toBeNull();
    expect(nextSeatId([], {}, [])).toBeNull();
  });

  // Chosen mode makes turn order worth money: every verdict is public, so the
  // last seat has heard (N-1) x cap answers about clauses they may declare and
  // the first heard none. Rotating spreads that across the session.
  it('rotates the opening seat with the round number, wrapping', () => {
    expect(startRound(IDS, { round: 0 }).seatId).toBe('a');
    expect(startRound(IDS, { round: 1 }).seatId).toBe('b');
    expect(startRound(IDS, { round: 2 }).seatId).toBe('c');
    expect(startRound(IDS, { round: 3 }).seatId).toBe('a');
  });

  // One name each, in order, from wherever the round opened — which is the
  // whole shape of a round now rather than the shape of one turn.
  it('still reaches everybody in turn when it starts partway round', () => {
    let s = startRound(IDS, { round: 1, cap: MIN_CAP });
    const seen = [];
    for (let i = 0; i < IDS.length; i++) {
      seen.push(s.seatId);
      s = withNames(s, 1);
    }
    expect(seen).toEqual(['b', 'c', 'a']);
  });

  // Passing 0 has to reproduce plain roster order exactly, or every existing
  // caller quietly changed behaviour.
  it('is plain roster order at startAt 0', () => {
    expect(nextSeatId(IDS, {}, [], 0)).toBe('a');
    expect(nextSeatId(IDS, {}, [], -1)).toBe('c');
  });
});

describe('judgeIdFor (dealt mode)', () => {
  it('is the next active player after the hot seat, wrapping', () => {
    const s = startRound(IDS);
    expect(judgeIdFor(s, IDS)).toBe('b');
    expect(judgeIdFor({ ...s, seatId: 'c' }, IDS)).toBe('a');
  });

  // The reason a departed judge needs no reconciliation effect, no one-shot and
  // no write: the role simply moves on the next render.
  it('steps over a departed judge with no state change at all', () => {
    const s = startRound(IDS);
    expect(judgeIdFor(s, IDS, ['b'])).toBe('c');
  });

  it('is null when nobody is left to answer', () => {
    const s = startRound(IDS);
    expect(judgeIdFor(s, IDS, ['b', 'c'])).toBeNull();
    expect(judgeIdFor({ seatId: null }, IDS)).toBeNull();
  });

  it('never names the hot seat as their own judge', () => {
    for (const seatId of IDS) {
      expect(judgeIdFor({ seatId }, IDS)).not.toBe(seatId);
    }
  });
});

describe('requiredJudges', () => {
  it('is the derived judge, for either kind of pending', () => {
    const s0 = startRound(IDS);
    const named = apply(s0, proposeName(s0, 'a', 'Nezuko'));
    expect(requiredJudges(named, IDS)).toEqual(['b']);
    const declared = apply(s0, declareCategory(s0, 'a', 'wears glasses'));
    expect(requiredJudges(declared, IDS)).toEqual(['b']);
  });

  it('is empty with nothing pending', () => {
    expect(requiredJudges(startRound(IDS), IDS)).toEqual([]);
    expect(requiredJudges(null, IDS)).toEqual([]);
  });
});

describe('proposing a name', () => {
  it('parks in the pending slot rather than joining the trail', () => {
    const s0 = startRound(IDS);
    const s = apply(s0, proposeName(s0, 'a', 'Nezuko'));
    expect(s.phase).toBe('judging');
    expect(s.pending).toEqual({ kind: 'proposal', text: 'Nezuko', verdicts: {} });
    // Not yet information — nobody has answered it.
    expect(trailFor(s, 'a')).toEqual([]);
    expect(proposalsUsed(s, 'a')).toBe(0);
  });

  it('cleans the text the way every other typed field is cleaned', () => {
    const s0 = startRound(IDS);
    expect(apply(s0, proposeName(s0, 'a', '  Edward   Elric ')).pending.text)
      .toBe('Edward Elric');
    expect(apply(s0, proposeName(s0, 'a', 'x'.repeat(200))).pending.text.length)
      .toBe(MAX_PROPOSAL_LEN);
  });

  it('refuses from anyone but the hot seat', () => {
    const s0 = startRound(IDS);
    expect(proposeName(s0, 'b', 'Nezuko').patch).toEqual({});
  });

  it('refuses a second name while one is pending, and refuses empty', () => {
    const s0 = startRound(IDS);
    const s1 = apply(s0, proposeName(s0, 'a', 'Nezuko'));
    expect(proposeName(s1, 'a', 'Mikasa').patch).toEqual({});
    expect(proposeName(s0, 'a', '   ').patch).toEqual({});
  });

  it('refuses once the cap is spent', () => {
    const s = withLaps(startRound(IDS, { cap: MIN_CAP }), MIN_CAP);
    expect(proposalsLeft(s, 'a')).toBe(0);
    expect(proposeName({ ...s, phase: 'naming' }, 'a', 'one more').patch).toEqual({});
  });

  // Nothing can be named until every clause exists to be judged against.
  it('refuses while the table is still picking', () => {
    const s = startRound(IDS, { source: 'table' });
    expect(proposeName(s, 'a', 'Nezuko').patch).toEqual({});
    expect(declareCategory(s, 'a', 'wears glasses').patch).toEqual({});
  });
});

describe('judging a name', () => {
  it('records a yes and a no identically, because both are information', () => {
    const s0 = startRound(IDS);
    const pending = apply(s0, proposeName(s0, 'a', 'Nezuko'));
    const yes = ruleAll(pending, true);
    expect(trailFor(yes, 'a')).toEqual([{ text: 'Nezuko', verdicts: { b: true } }]);
    const no = withNames(s0, 1);
    expect(trailFor(no, 'a')).toEqual([{ text: 'name 0', verdicts: { b: false } }]);
    expect(proposalsUsed(no, 'a')).toBe(1);
  });

  it('returns to naming with names still left', () => {
    const s = withLaps(startRound(IDS, { cap: 5 }), 2);
    expect(s.phase).toBe('naming');
    expect(s.pending).toBeNull();
    expect(proposalsLeft(s, 'a')).toBe(3);
  });

  // THE ONE-LINE STATEMENT OF THE WHOLE ROTATION. A settled name is not the end
  // of anything except that player's go.
  it('hands the seat to the next player on every settled name', () => {
    let s = startRound(IDS, { cap: 10 });
    const seats = [];
    for (let i = 0; i < 4; i++) {
      seats.push(s.seatId);
      s = withNames(s, 1);
    }
    // Wraps, and comes back round rather than parking on whoever opened.
    expect(seats).toEqual(['a', 'b', 'c', 'a']);
    // Four names spread as 2/1/1 rather than banked against whoever opened.
    expect(proposalsUsed(s, 'a')).toBe(2);
    expect(proposalsUsed(s, 'b')).toBe(1);
    expect(proposalsUsed(s, 'c')).toBe(1);
  });

  // A round that ran out still has to write a result, because `results` is what
  // seatFrom reads as "has finished".
  it('ends the player’s round — with a result — on their last name', () => {
    const s = withLaps(startRound(IDS, { cap: MIN_CAP }), MIN_CAP);
    expect(s.phase).toBe('turnEnd');
    expect(s.results.a).toEqual({ solved: false, guess: '', used: MIN_CAP });
    // …and only theirs. Everyone else is still playing.
    expect(s.results.b).toBeUndefined();
  });

  // The tail of a round: once everybody else has finished, there is nobody to
  // hand the go to, so the last player simply keeps naming.
  it('keeps the seat on the last player still in the round', () => {
    const done = { solved: false, guess: '', used: 0 };
    const s0 = {
      ...startRound(IDS, { cap: 10 }), seatId: 'c', results: { a: done, b: done },
    };
    const s1 = withNames(s0, 2);
    expect(s1.seatId).toBe('c');
    expect(proposalsUsed(s1, 'c')).toBe(2);
  });

  it('ignores a verdict when nothing is pending', () => {
    expect(judge(startRound(IDS), 'b', true, ['b']).patch).toEqual({});
    expect(judge({ phase: 'judging', pending: null, seatId: 'a' }, 'b', true, ['b']).patch)
      .toEqual({});
  });

  it('refuses a judge who was not asked, and one who already answered', () => {
    const s0 = startRound(IDS);
    const s1 = apply(s0, proposeName(s0, 'a', 'Nezuko'));
    // 'c' is not the derived judge this turn.
    expect(judge(s1, 'c', true, ['b']).patch).toEqual({});
    // A judge who has answered cannot answer again, even with a second judge
    // still owed — the list shape requiredJudges keeps.
    const once = apply(s1, judge(s1, 'b', true, ['b', 'c']));
    expect(judge(once, 'b', false, ['b', 'c']).patch).toEqual({});
  });

  it('treats any non-true verdict as a no rather than as a crash', () => {
    const s0 = startRound(IDS);
    const s1 = apply(s0, proposeName(s0, 'a', 'Nezuko'));
    expect(apply(s1, judge(s1, 'b', undefined, ['b'])).trails.a[0].verdicts.b).toBe(false);
  });
});

// The half of the game the two-player example is about: everyone answers every
// name, each against their own clause.
describe('the table picking each category', () => {
  it('records THAT a clause was locked in for a player and never what', () => {
    const s0 = startRound(IDS, { source: 'table' });
    const s1 = apply(s0, recordPick(s0, 'a'));
    expect(hasPicked(s1, 'a')).toBe(true);
    expect(JSON.stringify(s1)).not.toMatch(/categor|glasses/i);
    // Idempotent, so a double tap or two devices locking at once costs nothing.
    expect(recordPick(s1, 'a').patch).toEqual({});
  });

  // One target at a time, the AniGuess way, in roster order from the round.
  it('picks for one player at a time, in roster order', () => {
    let s = startRound(IDS, { source: 'table' });
    expect(pickingFor(s, IDS)).toBe('a');
    s = apply(s, recordPick(s, 'a'));
    expect(pickingFor(s, IDS)).toBe('b');
    s = apply(s, recordPick(s, 'b'));
    expect(pickingFor(s, IDS)).toBe('c');
  });

  // Who looks away first moves between rounds, like the opening seat.
  it('starts from a different player each round', () => {
    expect(pickingFor(startRound(IDS, { source: 'table', round: 1 }), IDS)).toBe('b');
    expect(pickingFor(startRound(IDS, { source: 'table', round: 5 }), IDS)).toBe('c');
  });

  // A target who closes their tab must not wedge the table on their pick.
  it('skips a player who has left', () => {
    const s = startRound(IDS, { source: 'table' });
    expect(pickingFor(s, IDS, ['a'])).toBe('b');
  });

  it('is nobody outside the picking phase, or once everyone has one', () => {
    expect(pickingFor(startRound(IDS, { source: 'random' }), IDS)).toBeNull();
    let s = startRound(IDS, { source: 'table' });
    for (const id of IDS) s = apply(s, recordPick(s, id));
    expect(pickingFor(s, IDS)).toBeNull();
  });

  // The active roster, so a closed tab cannot hold the table on the opening
  // screen forever.
  it('opens the first go once everyone STILL HERE has a clause', () => {
    let s = startRound(IDS, { source: 'table' });
    s = apply(s, recordPick(s, 'a'));
    s = apply(s, recordPick(s, 'b'));
    expect(everyonePicked(s, IDS)).toBe(false);
    expect(beginNaming(s, IDS).patch).toEqual({});
    expect(everyonePicked(s, ['a', 'b'])).toBe(true);
    expect(apply(s, beginNaming(s, ['a', 'b'])).phase).toBe('naming');
  });

  it('is never vacuously ready with an empty table', () => {
    expect(everyonePicked(startRound(IDS, { source: 'table' }), [])).toBe(false);
  });

  // The seat is chosen before anybody has a clause, so a seat who leaves during
  // the pick still has to be replaced — without opening a go early.
  it('replaces a departed seat without leaving the picking phase', () => {
    const s0 = startRound(IDS, { source: 'table' });
    const s1 = apply(s0, skipDepartedSeat(s0, IDS, ['a']));
    expect(s1.seatId).toBe('b');
    expect(s1.phase).toBe('picking');
  });

  // After the pick, the round is exactly the random one.
  it('plays the same game once the picking is done', () => {
    const s0 = tableRound();
    expect(s0.phase).toBe('naming');
    const named = apply(s0, proposeName(s0, 'a', 'Nezuko'));
    expect(requiredJudges(named, IDS)).toEqual(['b']);
  });
});

describe('declaring the category', () => {
  it('goes through the same pending slot, because it needs the same human', () => {
    const s0 = startRound(IDS);
    const s1 = apply(s0, declareCategory(s0, 'a', 'wears glasses'));
    expect(s1.phase).toBe('judging');
    expect(s1.pending).toEqual({ kind: 'declaration', text: 'wears glasses', verdicts: {} });
  });

  it('ends the declarer’s round when the judge says yes', () => {
    const s = withLaps(startRound(IDS, { cap: 10 }), 3);
    expect(s.seatId).toBe('a');
    const declared = apply(s, declareCategory(s, 'a', 'wears glasses'));
    const done = ruleAll(declared, true);
    expect(done.phase).toBe('turnEnd');
    expect(done.results.a).toEqual({ solved: true, guess: 'wears glasses', used: 3 });
  });

  // The whole point of the softened rule: a miss used to end the round, which
  // was fine when a turn was an uninterrupted block and is a spectator sport now
  // that the seat moves every name.
  it('costs names rather than the round when the judge says no', () => {
    const s0 = startRound(IDS, { cap: 10 });
    const s1 = apply(s0, declareCategory(s0, 'a', 'is blond'));
    const done = ruleAll(s1, false);
    expect(done.phase).toBe('naming');
    expect(done.results.a).toBeUndefined();
    expect(proposalsUsed(done, 'a')).toBe(WRONG_DECLARATION_COST);
    // …and it still hands the go on, exactly as a name does.
    expect(done.seatId).toBe('b');
  });

  // The floor under the softened rule. Without it a player one name from the
  // cap could guess for free, which is the strategy the old whole-turn cost
  // existed to price.
  it('ends the round when the miss is what spends the cap', () => {
    const s0 = startRound(IDS, { cap: MIN_CAP });
    const s1 = apply(s0, declareCategory(s0, 'a', 'is blond'));
    const done = ruleAll(s1, false);
    expect(done.phase).toBe('turnEnd');
    expect(done.results.a).toEqual({ solved: false, guess: 'is blond', used: MIN_CAP });
    expect(finalScores(done, IDS).a).toBe(0);
  });

  // A miss is stored in the trail, which is what makes it cost anything at all.
  it('records the miss in the trail', () => {
    const s0 = startRound(IDS, { cap: 10 });
    const done = ruleAll(apply(s0, declareCategory(s0, 'a', 'is blond')), false);
    expect(trailFor(done, 'a')).toEqual([
      { text: 'is blond', kind: 'declaration', verdicts: { b: false } },
    ]);
  });

  it('allows a blind declaration with no names spent', () => {
    const s0 = startRound(IDS);
    const s1 = apply(s0, declareCategory(s0, 'a', 'is blond'));
    expect(ruleAll(s1, true).results.a.used).toBe(0);
  });

  it('refuses from anyone but the hot seat, and refuses empty', () => {
    const s0 = startRound(IDS);
    expect(declareCategory(s0, 'b', 'wears glasses').patch).toEqual({});
    expect(declareCategory(s0, 'a', '  ').patch).toEqual({});
  });

});

describe('passing', () => {
  it('ends the turn unsolved, from the hot seat only', () => {
    const s0 = withLaps(startRound(IDS), 2);
    expect(passTurn(s0, 'b').patch).toEqual({});
    const done = apply(s0, passTurn(s0, 'a'));
    expect(done.phase).toBe('turnEnd');
    expect(done.results.a).toEqual({ solved: false, guess: '', used: 2 });
  });

  it('works while a ruling is pending, so a stuck judge cannot trap the seat', () => {
    const s0 = startRound(IDS);
    const s1 = apply(s0, proposeName(s0, 'a', 'Nezuko'));
    const done = apply(s1, passTurn(s1, 'a'));
    expect(done.phase).toBe('turnEnd');
    expect(done.pending).toBeNull();
  });
});

// nextTurn is now the RARE half of the rotation: the seat moves on every name
// inside settlePending, and this only picks it up after somebody has finished.
describe('picking the rotation up after somebody finishes', () => {
  it('moves to the next player who has not finished', () => {
    const s0 = withLaps(startRound(IDS, { cap: MIN_CAP }), MIN_CAP);
    const s1 = apply(s0, nextTurn(s0, IDS));
    expect(s1.seatId).toBe('b');
    expect(s1.phase).toBe('naming');
  });

  it('ends the round when everyone has finished', () => {
    let s = startRound(IDS, { cap: MIN_CAP });
    for (let i = 0; i < IDS.length; i++) {
      s = withNames(s, MIN_CAP * IDS.length);
      s = apply(s, nextTurn(s, IDS));
    }
    expect(s.phase).toBe('roundEnd');
    expect(roundComplete(s, IDS)).toBe(true);
  });

  it('steps over a player who left rather than offering them the seat', () => {
    const s0 = withLaps(startRound(IDS, { cap: MIN_CAP }), MIN_CAP);
    expect(apply(s0, nextTurn(s0, IDS, ['b'])).seatId).toBe('c');
  });

  it('only fires at a turn end', () => {
    expect(nextTurn(startRound(IDS), IDS).patch).toEqual({});
  });

  // Counts the active roster, not results.length: a player who left mid-round
  // will never finish and would hold the round open forever.
  it('is complete once everyone STILL HERE has finished', () => {
    const s = withLaps(startRound(IDS, { cap: MIN_CAP }), MIN_CAP);
    expect(roundComplete(s, IDS)).toBe(false);
    expect(roundComplete(s, ['a'])).toBe(true);
  });
});

// What a screen draws the rotation from. Derived, so it cannot fall out of step
// with the round it describes.
describe('turnOrder', () => {
  it('is roster order, which IS seat order', () => {
    const s = withNames(startRound(IDS, { cap: 5 }), 1);
    expect(turnOrder(s, IDS).map((r) => r.playerId)).toEqual(IDS);
    expect(turnOrder(s, IDS).find((r) => r.isSeat).playerId).toBe('b');
    expect(turnOrder(s, IDS)[0]).toMatchObject({ used: 1, left: 4, done: false });
  });

  it('separates a player who solved from one who merely finished', () => {
    let s = tableRound({ cap: 10 });
    s = ruleAll(apply(s, declareCategory(s, 'a', 'wears glasses')), true);
    s = apply(s, nextTurn(s, IDS));
    const rows = Object.fromEntries(turnOrder(s, IDS, ['c']).map((r) => [r.playerId, r]));
    expect(rows.a).toMatchObject({ done: true, solved: true });
    expect(rows.b).toMatchObject({ done: false, solved: false, isSeat: true });
    expect(rows.c).toMatchObject({ done: false, away: true });
  });
});

describe('skipDepartedSeat', () => {
  it('records the abandoned turn and moves on', () => {
    const s0 = withLaps(startRound(IDS), 2);
    const s1 = apply(s0, skipDepartedSeat(s0, IDS, ['a']));
    expect(s1.seatId).toBe('b');
    expect(s1.phase).toBe('naming');
    // Recorded rather than skipped, so a flicker of presence cannot hand them
    // the seat a second time.
    expect(s1.results.a).toEqual({ solved: false, guess: '', used: 2 });
  });

  it('ends the round when the departure was the last seat left', () => {
    const s0 = startRound(IDS);
    const s1 = apply(s0, skipDepartedSeat(s0, IDS, ['a', 'b', 'c']));
    expect(s1.phase).toBe('roundEnd');
  });

  it('does nothing when the hot seat is still here', () => {
    const s0 = startRound(IDS);
    expect(skipDepartedSeat(s0, IDS, ['b']).patch).toEqual({});
    expect(skipDepartedSeat(s0, IDS, []).patch).toEqual({});
  });

  // A departed JUDGE is judgeIdFor's problem in dealt mode and settlePending's
  // in chosen mode. Neither is this function's.
  it('does not fire for a departed judge', () => {
    const s0 = startRound(IDS);
    expect(skipDepartedSeat(s0, IDS, ['b']).patch).toEqual({});
    expect(judgeIdFor(s0, IDS, ['b'])).toBe('c');
  });
});

describe('scoreTurn', () => {
  it('pays nothing for an unsolved turn', () => {
    expect(scoreTurn({ solved: false, used: 1, cap: 10 })).toBe(0);
    expect(scoreTurn({})).toBe(0);
  });

  it('pays more the fewer names were spent', () => {
    const scores = [0, 1, 2, 3, 4].map((used) => scoreTurn({ solved: true, used, cap: 10 }));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i], `used ${i}`).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  // The ceiling: a lucky blind declaration must not outscore somebody who
  // actually worked the trail, so 0 and 1 names pay the same. It is also what
  // makes first-claim-wins load-bearing rather than decorative.
  it('caps a blind solve at what a one-name solve pays', () => {
    expect(scoreTurn({ solved: true, used: 0, cap: 10 })).toBe(10);
    expect(scoreTurn({ solved: true, used: 1, cap: 10 })).toBe(10);
    expect(scoreTurn({ solved: true, used: 3, cap: 10 })).toBe(9);
  });

  // The softened curve: a point per two names, never under half the cap, so
  // one quick solve does not decide the game on its own.
  it('costs a point per two names, down to half the cap', () => {
    expect([1, 2, 3, 4, 5, 9, 10].map((used) => scoreTurn({ solved: true, used, cap: 10 }))).toEqual([10, 10, 9, 9, 8, 6, 6]);
    expect(scoreTurn({ solved: true, used: 99, cap: 10 })).toBe(5);
  });

  // The floor: solving on the last name still beat not solving at all.
  it('never pays a solve less than an unsolved turn', () => {
    expect(scoreTurn({ solved: true, used: 10, cap: 10 })).toBeGreaterThan(0);
    expect(scoreTurn({ solved: true, used: 99, cap: 10 })).toBeGreaterThan(0);
  });
});

describe('the round result', () => {
  it('scores only players who had a turn', () => {
    const s = { cap: 10, results: { a: { solved: true, used: 3 }, b: { solved: false, used: 10 } } };
    expect(finalScores(s, IDS)).toEqual({ a: 9, b: 0 });
  });

  // Both score zero; drawing them the same way would accuse somebody whose tab
  // closed of playing badly.
  it('separates a missed turn from a turn nobody got', () => {
    const s = { cap: 10, trails: {}, results: { a: { solved: false, guess: '', used: 4 } } };
    const [first, second] = explainRound(s, ['a', 'b']);
    expect(first.took).toBe(true);
    expect(first.solved).toBe(false);
    expect(second.took).toBe(false);
    expect(second.points).toBe(0);
  });

  it('carries each player their own category, handed in by the caller', () => {
    const s = { cap: 10, trails: {}, results: { a: { solved: true, used: 1 } } };
    const [row] = explainRound(s, ['a'], { a: 'glasses' });
    expect(row.category).toBe('glasses');
  });

  // The published value has to win, because it is the only source that works on
  // EVERY device: the seat's own device is denied the clause.
  it('prefers a published clause to whatever this device happens to hold', () => {
    const s = { cap: 10, trails: {}, results: { a: { solved: true, used: 1, category: 'villain' } } };
    expect(explainRound(s, ['a'], { a: 'glasses' })[0].category).toBe('villain');
  });

  // Picking somebody's clause earns nothing — only the solver scores.
  it('pays only the solver', () => {
    const results = { a: { solved: true, used: 3 }, b: { solved: false, used: 10 } };
    expect(finalScores({ source: 'table', cap: 10, results }, IDS)).toEqual({ a: 9, b: 0 });
  });

  it('adds a round onto the running totals', () => {
    expect(applyRoundScores({ a: 5 }, { a: 3, b: 2 })).toEqual({ a: 8, b: 2 });
    expect(applyRoundScores({ a: 5 }, null)).toEqual({ a: 5 });
  });
});

describe('verdictsOf', () => {
  // Three stored shapes have to read as one, or every screen branches.
  it('flattens a map, a map of one, and a pre-attribution scalar', () => {
    expect(verdictsOf({ text: 'x', verdicts: { b: true, c: false } })).toEqual([
      { judgeId: 'b', verdict: true },
      { judgeId: 'c', verdict: false },
    ]);
    expect(verdictsOf({ text: 'x', verdicts: { b: false } }))
      .toEqual([{ judgeId: 'b', verdict: false }]);
    expect(verdictsOf({ text: 'x', verdict: true }))
      .toEqual([{ judgeId: null, verdict: true }]);
    expect(verdictsOf({ text: 'x' })).toEqual([]);
    expect(verdictsOf(null)).toEqual([]);
  });
});

describe('normalizers', () => {
  // RTDB drops null elements, so a partly-stored trail comes back sparse and a
  // mostly-empty one comes back keyed by index. Array.map SKIPS HOLES, which is
  // why this uses a plain loop.
  it('reads a trail back from all three shapes RTDB serves', () => {
    const dense = [{ text: 'x', verdicts: { b: true } }, { text: 'y', verdicts: { b: false } }];
    expect(normalizeTrail(dense)).toEqual(dense);

    const sparse = [];
    sparse[0] = dense[0];
    sparse[3] = dense[1];
    expect(normalizeTrail(sparse)).toEqual(dense);

    expect(normalizeTrail({ 0: dense[0], 3: { text: 'y' } }))
      .toEqual([dense[0], { text: 'y', verdicts: {} }]);

    expect(normalizeTrail(undefined)).toEqual([]);
  });

  // A room mid-round across a deploy: the previous build stored one
  // unattributed boolean per name, and dropping it would show ten names nobody
  // appears to have answered.
  it('carries a pre-attribution verdict through untouched', () => {
    expect(normalizeTrail([{ text: 'x', verdict: true }]))
      .toEqual([{ text: 'x', verdicts: {}, verdict: true }]);
  });

  // A miss weighs WRONG_DECLARATION_COST names, and that lives on the entry —
  // so an entry that came back as a plain name would silently refund the
  // penalty. A `targetId` from the build that had "pick your own" is dropped.
  it('carries a miss’s kind back off the wire', () => {
    expect(normalizeTrail([
      { text: 'is blond', kind: 'declaration', targetId: 'c', verdicts: { c: false } },
      { text: 'Nezuko', verdicts: { b: true } },
    ])).toEqual([
      { text: 'is blond', kind: 'declaration', verdicts: { c: false } },
      { text: 'Nezuko', verdicts: { b: true } },
    ]);
    // …and a kind it has never heard of is simply not one.
    expect(normalizeTrail([{ text: 'x', kind: 'nonsense', verdicts: {} }]))
      .toEqual([{ text: 'x', verdicts: {} }]);
  });

  it('never invents a trail entry, which would count against the cap', () => {
    expect(normalizeTrail([null, { text: '' }, 'nonsense', { verdicts: { b: true } }]))
      .toEqual([]);
  });

  // CLAUDE.md's "rebuilding a keyed collection from the ACTIVE roster deletes
  // departed players' data" trap. These normalizers keep every key found and
  // invent none, so it cannot bite.
  it('keeps a departed player’s trail and result through a rewrite', () => {
    const trails = normalizeTrails({ gone: [{ text: 'x', verdicts: { b: true } }] });
    expect(trails.gone).toHaveLength(1);
    const results = normalizeResults({ gone: { solved: true, guess: 'g', used: 2 } });
    expect(results.gone).toEqual({ solved: true, guess: 'g', used: 2 });
  });

  it('repairs a result missing every field rather than dropping it', () => {
    expect(normalizeResults({ a: {} }).a).toEqual({ solved: false, guess: '', used: 0 });
    expect(normalizeResults({ a: null })).toEqual({});
  });

  it('drops a pending ruling that cannot be acted on', () => {
    expect(normalizePending({ kind: 'proposal', text: 'x' }))
      .toEqual({ kind: 'proposal', text: 'x', verdicts: {} });
    expect(normalizePending({ kind: 'declaration', text: 'x', verdicts: { c: true } }))
      .toEqual({ kind: 'declaration', text: 'x', verdicts: { c: true } });
    expect(normalizePending({ kind: 'nonsense', text: 'x' })).toBeNull();
    expect(normalizePending({ kind: 'proposal', text: '' })).toBeNull();
    expect(normalizePending(undefined)).toBeNull();
  });

  // Rebuilt from named fields, so a stray key from an older build cannot ride
  // in — and a field the hook writes but this forgets is silently dropped.
  it('rebuilds the round from named fields only', () => {
    const g = normalizeGame({ round: 2, cap: 7, seatId: 'a', phase: 'naming', stray: 'nope' });
    expect(g.stray).toBeUndefined();
    expect(g).toEqual({
      round: 2, cap: 7, source: 'random', seatId: 'a', phase: 'naming',
      pending: null, picked: {}, trails: {}, results: {}, lastPlayed: null,
    });
  });

  // The opposite of the pref's default, on purpose: the only round that can
  // reach here without a source is one already in flight from the build before
  // this field existed, and its clauses were dealt.
  it('reads a round written before sources existed as a random one', () => {
    expect(normalizeGame({ round: 0, seatId: 'a' }).source).toBe('random');
    expect(normalizeGame({ round: 0, seatId: 'a', source: 'nonsense' }).source).toBe('random');
    expect(normalizeGame({ round: 0, seatId: 'a', source: 'table' }).source).toBe('table');
    // The removed mode's fields do not ride back in.
    const old = normalizeGame({ round: 0, seatId: 'a', mode: 'chosen', reveal: { a: 'x' } });
    expect(old.mode).toBeUndefined();
    expect(old.reveal).toBeUndefined();
  });

  it('survives everything RTDB drops on the way back', () => {
    const g = normalizeGame({ round: 0, seatId: 'a' });
    expect(g.trails).toEqual({});
    expect(g.results).toEqual({});
    expect(g.picked).toEqual({});
    expect(g.pending).toBeNull();
    expect(g.cap).toBe(DEFAULT_CAP);
    expect(g.phase).toBe('naming');
    expect(normalizeGame(null)).toBeNull();
  });

  it('round-trips a real mid-turn round through JSON, which is the online path', () => {
    let s = startRound(IDS, { cap: 6 });
    s = withNames(s, 2);
    s = apply(s, proposeName(s, s.seatId, 'Nezuko'));
    expect(normalizeGame(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('round-trips a table-picked round carrying picks and a solve', () => {
    let s = tableRound({ cap: 6 });
    s = withLaps(s, 1, true);
    const declared = apply(s, declareCategory(s, 'a', 'wears glasses'));
    s = ruleAll(declared, true);
    expect(normalizeGame(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});
