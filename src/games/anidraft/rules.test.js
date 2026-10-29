import { describe, expect, it } from 'vitest';
import * as rules from './rules';
import { ROLE_DECK, dealRoles } from './roles';

const { ROLES_PER_ROUND } = rules;
const ids = ['a', 'b', 'c'];
const card = (i) => ({ key: `k${i}`, name: `Hero ${i}`, series: 'Show', imageUrl: '' });
const boardOf = (n, from = 0) => Array.from({ length: n }, (_, i) => card(from + i));
const ROLES = ['captain', 'rival', 'healer', 'comic', 'boss'];

const start = (over = {}) => rules.startGame({
  ids, rounds: 2, board: boardOf(rules.boardSize(ids.length)), roles: ROLES, ...over,
});
const apply = (g, { patch }) => ({ ...g, ...patch });

// Every pick of the round, each picker taking the first free card into their
// first open slot — the rules' own autoPick order, made as real picks.
function draftAll(game) {
  let g = game;
  while (g.phase === 'draft') {
    const by = rules.currentPicker(g);
    const taken = rules.takenBy(g);
    const next = g.board.find((c) => !taken.has(c.key));
    g = apply(g, rules.makePick(g, by, next.key, rules.openSlots(g, by)[0]));
  }
  return g;
}

describe('the snake', () => {
  it('runs forward then back, five laps, starting one seat on each round', () => {
    expect(rules.pickOrder(ids, 0).slice(0, 6)).toEqual(['a', 'b', 'c', 'c', 'b', 'a']);
    expect(rules.pickOrder(ids, 0)).toHaveLength(ids.length * ROLES_PER_ROUND);
    expect(rules.pickOrder(ids, 1).slice(0, 4)).toEqual(['b', 'c', 'a', 'a']);
  });

  it('deals a board half as big again as the picks', () => {
    expect(rules.boardSize(3)).toBe(23);
    expect(rules.boardSize(8)).toBe(60);
  });
});

describe('picking', () => {
  it('takes a free card into an open slot, only on your pick', () => {
    const g = start();
    expect(rules.makePick(g, 'b', 'k0', 0).patch).toEqual({});
    const after = apply(g, rules.makePick(g, 'a', 'k0', 2));
    expect(rules.teamSlots(after, 'a')[2].key).toBe('k0');
    expect(rules.currentPicker(after)).toBe('b');
    // The card is gone, and a filled slot is closed.
    expect(rules.makePick(after, 'b', 'k0', 0).patch).toEqual({});
    expect(rules.makePick(after, 'b', 'nope', 0).patch).toEqual({});
    expect(rules.openSlots(after, 'a')).toEqual([0, 1, 3, 4]);
  });

  it('opens the vote once every team is full', () => {
    const g = draftAll(start());
    expect(g.phase).toBe('vote');
    for (const id of ids) expect(rules.openSlots(g, id)).toEqual([]);
    expect(g.picks).toHaveLength(15);
  });

  it('reshuffles the roles only before the first pick', () => {
    const g = start();
    const other = ['mentor', 'spy', 'genius', 'cook', 'mascot'];
    expect(apply(g, rules.reshuffleRoles(g, other)).roles).toEqual(other);
    const picked = apply(g, rules.makePick(g, 'a', 'k0', 0));
    expect(rules.reshuffleRoles(picked, other).patch).toEqual({});
  });

  it('picks for a player only when they have gone or their clock ran out', () => {
    const g = start({ pickClock: 30, now: 1000 });
    expect(rules.autoPick(g, { now: 2000, activeIds: ids }).patch).toEqual({});
    // Their clock ran out.
    const late = apply(g, rules.autoPick(g, { now: 31_000, activeIds: ids, forPick: 0 }));
    expect(late.picks[0]).toMatchObject({ by: 'a', card: 'k0', slot: 0, auto: true });
    // The next picker has gone, clock or no clock; and a second device's
    // auto-pick for the same moment aborts.
    const gone = apply(late, rules.autoPick(late, { now: 31_001, activeIds: ['a', 'c'], forPick: 1 }));
    expect(gone.picks[1]).toMatchObject({ by: 'b', card: 'k1', auto: true });
    expect(rules.autoPick(gone, { now: 31_002, activeIds: ['a', 'c'], forPick: 1 }).patch).toEqual({});
  });
});

describe('the vote', () => {
  const voted = (ballots) => {
    let g = draftAll(start());
    for (const [voter, choices] of Object.entries(ballots)) g = apply(g, rules.castBallot(g, voter, choices));
    return g;
  };

  it('refuses a vote for your own team, a short ballot and a second ballot', () => {
    const g = draftAll(start());
    expect(rules.castBallot(g, 'a', ['a', 'b', 'b', 'b', 'b']).patch).toEqual({});
    expect(rules.castBallot(g, 'a', ['b', 'b']).patch).toEqual({});
    const once = apply(g, rules.castBallot(g, 'a', ['b', 'b', 'c', 'c', 'b']));
    expect(rules.castBallot(once, 'a', ['c', 'c', 'c', 'c', 'c']).patch).toEqual({});
    expect(rules.pendingVoters(once)).toEqual(['b', 'c']);
  });

  it('scores each role to its most-voted team, every tied team included', () => {
    const g = voted({
      a: ['b', 'b', 'c', 'b', 'c'],
      b: ['c', 'a', 'a', 'a', 'c'],
      c: ['b', 'a', 'a', 'b', 'a'],
    });
    expect(rules.everyoneVoted(g)).toBe(true);
    const closed = apply(g, rules.closeVote(g));
    expect(closed.phase).toBe('reveal');
    // Role 0: b 2. Role 1: a 2. Role 2: a 2. Role 3: b 2. Role 4: c 2.
    expect(closed.scores).toEqual({ a: 2, b: 2, c: 1 });
    expect(closed.votesWon).toEqual({ a: 6, b: 5, c: 4 });
    const entry = rules.lastEntry(closed);
    expect(entry.tally[0]).toEqual({ a: 0, b: 2, c: 1 });
    expect(entry.teams.a).toHaveLength(ROLES_PER_ROUND);

    const tie = { a: 1, b: 1, c: 1 };
    expect(rules.winnersOf(tie, ids)).toEqual(ids);
    expect(rules.winnersOf({ a: 0, b: 0, c: 0 }, ids)).toEqual([]);
  });

  it('closes without a voter who left, counting only the ballots in', () => {
    const g = voted({ a: ['b', 'b', 'b', 'b', 'b'], b: ['a', 'a', 'a', 'a', 'a'] });
    expect(rules.closeVote(g).patch).toEqual({});
    const closed = apply(g, rules.closeVote(g, ['a', 'b']));
    expect(closed.scores).toEqual({ a: 5, b: 5, c: 0 });
  });
});

describe('the reveal and the next round', () => {
  const revealed = () => {
    let g = draftAll(start());
    g = apply(g, rules.castBallot(g, 'a', ['b', 'b', 'b', 'b', 'b']));
    g = apply(g, rules.castBallot(g, 'b', ['a', 'c', 'c', 'c', 'c']));
    g = apply(g, rules.castBallot(g, 'c', ['b', 'b', 'b', 'b', 'b']));
    return apply(g, rules.closeVote(g));
  };

  it('turns the roles over one at a time, and the scores follow them', () => {
    let g = revealed();
    expect(rules.revealedScores(g)).toEqual({ a: 0, b: 0, c: 0 });
    g = apply(g, rules.revealNext(g, 0));
    expect(rules.revealedScores(g)).toEqual({ a: 0, b: 1, c: 0 });
    // Two phones pressing at once turn over one role.
    expect(rules.revealNext(g, 0).patch).toEqual({});
    for (let i = 1; i < ROLES_PER_ROUND; i++) g = apply(g, rules.revealNext(g, i));
    expect(rules.revealDone(g)).toBe(true);
    expect(rules.revealedScores(g)).toEqual(g.scores);
  });

  it('opens a new round with a new board, then finishes after the last', () => {
    let g = revealed();
    for (let i = 0; i < ROLES_PER_ROUND; i++) g = apply(g, rules.revealNext(g, i));
    const board = boardOf(rules.boardSize(3), 100);
    g = apply(g, rules.nextRound(g, { board, roles: ROLES }));
    expect(g).toMatchObject({ round: 1, phase: 'draft', picks: [], ballots: {}, shown: 0 });
    expect(rules.currentPicker(g)).toBe('b');
    expect(g.used).toContain('k100');
    expect(rules.draftedKeys(g)).toContain('k0');

    g = draftAll(g);
    for (const v of ids) g = apply(g, rules.castBallot(g, v, Array(ROLES_PER_ROUND).fill(ids.find((x) => x !== v))));
    g = apply(g, rules.closeVote(g));
    for (let i = 0; i < ROLES_PER_ROUND; i++) g = apply(g, rules.revealNext(g, i));
    expect(apply(g, rules.nextRound(g, { board, roles: ROLES })).phase).toBe('finished');
  });

  it('ends early when the lists cannot fill a board', () => {
    let g = revealed();
    for (let i = 0; i < ROLES_PER_ROUND; i++) g = apply(g, rules.revealNext(g, i));
    expect(rules.nextRound(g, { board: boardOf(4), roles: ROLES }).patch).toEqual({ phase: 'finished' });
    expect(rules.startGame({ ids, board: boardOf(4), roles: ROLES }).phase).toBe('finished');
  });
});

describe('standings', () => {
  it('ranks by roles won, then votes, sharing a place only when both are level', () => {
    const players = ids.map((id) => ({ id, name: id }));
    const ranked = rules.standings(players, { scores: { a: 3, b: 3, c: 1 }, votesWon: { a: 7, b: 9, c: 9 } });
    expect(ranked.map((p) => [p.id, p.position])).toEqual([['b', 1], ['a', 2], ['c', 3]]);
    const level = rules.standings(players, { scores: { a: 2, b: 2, c: 2 }, votesWon: { a: 5, b: 5, c: 4 } });
    expect(level.map((p) => p.position)).toEqual([1, 1, 3]);
  });
});

describe('normalizeGame', () => {
  it('repairs what RTDB drops without moving anything to the wrong role', () => {
    let g = draftAll(start());
    for (const v of ids) g = apply(g, rules.castBallot(g, v, Array(ROLES_PER_ROUND).fill(ids.find((x) => x !== v))));
    g = apply(g, rules.closeVote(g));
    // RTDB's shapes: an empty object gone, a ballot as an index-keyed object,
    // the log's tally with an all-zero count dropped to nothing.
    const stored = JSON.parse(JSON.stringify(g));
    stored.ballots.a = { ...stored.ballots.a };
    delete stored.used;
    stored.log[0].tally = { 1: stored.log[0].tally[1] };
    const back = rules.normalizeGame(stored);
    expect(back.ballots.a).toEqual(g.ballots.a);
    expect(back.used).toEqual([]);
    expect(back.log[0].tally).toHaveLength(ROLES_PER_ROUND);
    expect(back.log[0].tally[0]).toEqual({ a: 0, b: 0, c: 0 });
    expect(back.log[0].tally[1]).toEqual(g.log[0].tally[1]);
    expect(rules.normalizeGame(null)).toBeNull();
  });
});

describe('the role deck', () => {
  it('has distinct ids and deals five different roles, avoiding the last deal when it can', () => {
    expect(new Set(ROLE_DECK.map((r) => r.id)).size).toBe(ROLE_DECK.length);
    const roles = dealRoles(ROLES_PER_ROUND);
    expect(new Set(roles).size).toBe(ROLES_PER_ROUND);
    const again = dealRoles(ROLES_PER_ROUND, Math.random, roles);
    expect(again.some((r) => roles.includes(r))).toBe(false);
  });
});
