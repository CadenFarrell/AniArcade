import { describe, expect, it } from 'vitest';
import * as rules from './rules';

const { HINT_COST, MAX_BID, TILES, WRONG_BONUS } = rules;

const card = (key, name, extra = {}) => ({ key, name, series: 'Show', imageUrl: `https://img/${key}.jpg`, choices: [], hints: {}, ...extra });

// Three rounds' cards plus one spare.
const deal = {
  answerStyle: 'choice',
  hintsOn: true,
  rounds: 3,
  cards: [
    card('levi ackerman', 'Levi Ackerman', { hints: { studio: 'WIT Studio', year: '2013' } }),
    card('spike spiegel', 'Spike Spiegel'),
    card('rem', 'Rem'),
    card('frieren', 'Frieren'),
  ],
};

const ids = ['a', 'b', 'c'];
const apply = (g, { patch }) => ({ ...g, ...patch });
const start = () => rules.startGame(ids, deal);

// Bid `a` n, everyone else passes: the shortest road to a peek.
function peekFor(n, game = start()) {
  let g = apply(game, rules.placeBid(game, game.turnId, n, ids));
  while (g.phase === 'bidding') g = apply(g, rules.pass(g, g.turnId, ids));
  return g;
}

describe('bidding', () => {
  it('opens with the first seat, who cannot pass', () => {
    const g = start();
    expect(g.turnId).toBe('a');
    expect(rules.pass(g, 'a', ids).patch).toEqual({});
  });

  it('only takes a bid from the player whose turn it is, inside the range', () => {
    const g = start();
    expect(rules.placeBid(g, 'b', 5, ids).patch).toEqual({});
    expect(rules.placeBid(g, 'a', 0, ids).patch).toEqual({});
    expect(rules.placeBid(g, 'a', MAX_BID + 1, ids).patch).toEqual({});
    expect(rules.placeBid(g, 'a', 2.5, ids).patch).toEqual({});
    expect(apply(g, rules.placeBid(g, 'a', MAX_BID, ids)).bid).toEqual({ by: 'a', n: MAX_BID });
  });

  it('makes every later bid go lower, and hands the turn round the table', () => {
    let g = apply(start(), rules.placeBid(start(), 'a', 8, ids));
    expect(g.turnId).toBe('b');
    expect(rules.placeBid(g, 'b', 8, ids).patch).toEqual({});
    g = apply(g, rules.placeBid(g, 'b', 6, ids));
    expect(g.turnId).toBe('c');
    g = apply(g, rules.pass(g, 'c', ids));
    // Back to the opener, who was outbid and may go lower still.
    expect(g.turnId).toBe('a');
    g = apply(g, rules.placeBid(g, 'a', 5, ids));
    // c passed and sits out; b is next.
    expect(g.turnId).toBe('b');
    g = apply(g, rules.pass(g, 'b', ids));
    expect(g.phase).toBe('peeking');
    expect(g.bid).toEqual({ by: 'a', n: 5 });
  });

  it('closes at once on a bid of one — nobody can go lower', () => {
    const g = apply(start(), rules.placeBid(start(), 'a', 1, ids));
    expect(g.phase).toBe('peeking');
  });
});

describe('peeking', () => {
  it('spends the bid on tiles, then moves to the answer', () => {
    let g = peekFor(2);
    expect(rules.budgetLeft(g)).toBe(2);
    expect(rules.uncoverTile(g, 'b', 0).patch).toEqual({}); // not the bidder
    g = apply(g, rules.uncoverTile(g, 'a', 5));
    expect(rules.uncoverTile(g, 'a', 5).patch).toEqual({}); // already open
    expect(rules.uncoverTile(g, 'a', TILES).patch).toEqual({});
    g = apply(g, rules.uncoverTile(g, 'a', 6));
    expect(g.uncovered).toEqual([5, 6]);
    expect(g.phase).toBe('answering');
  });

  it('sells a hint for HINT_COST tiles, once, only when the card has one', () => {
    let g = peekFor(3);
    expect(rules.takeHint(g, deal, 'a', 'format').patch).toEqual({}); // not on this card
    g = apply(g, rules.takeHint(g, deal, 'a', 'studio'));
    expect(g.hintsTaken).toEqual(['studio']);
    expect(rules.budgetLeft(g)).toBe(3 - HINT_COST);
    expect(rules.takeHint(g, deal, 'a', 'studio').patch).toEqual({});
    // One tile left is not enough for the year.
    expect(rules.takeHint(g, deal, 'a', 'year').patch).toEqual({});
  });

  it('refuses hints when the deal has them switched off', () => {
    const off = { ...deal, hintsOn: false };
    expect(rules.takeHint(peekFor(5), off, 'a', 'studio').patch).toEqual({});
  });

  it('lets the bidder stop early', () => {
    const g = apply(peekFor(6), rules.nameNow(peekFor(6), 'a'));
    expect(g.phase).toBe('answering');
  });
});

describe('answering and scoring', () => {
  it('pays 16 minus the bid for a right name, however many tiles were left', () => {
    const g = peekFor(4);
    const done = apply(g, rules.submitAnswer(g, deal, 'a', 'Levi Ackerman', ids));
    expect(done.phase).toBe('revealed');
    expect(done.scores).toEqual({ a: TILES - 4, b: 0, c: 0 });
    expect(done.result).toMatchObject({ by: 'a', correct: true, points: TILES - 4 });
  });

  it('accepts the name with its words in either order, and without diacritics', () => {
    const g = peekFor(4);
    expect(rules.names(rules.currentCard(g, deal), 'ackerman levi')).toBe(true);
    expect(rules.names({ key: 'frieren', name: 'Frīeren' }, 'Frieren')).toBe(true);
    expect(rules.names(rules.currentCard(g, deal), 'Levi')).toBe(false);
  });

  it('pays everyone else still here for a miss or a pass', () => {
    const g = peekFor(4);
    const miss = apply(g, rules.submitAnswer(g, deal, 'a', 'Eren', ['a', 'b']));
    expect(miss.scores).toEqual({ a: 0, b: WRONG_BONUS, c: 0 });
    const blank = apply(g, rules.submitAnswer(g, deal, 'a', '', ids));
    expect(blank.result.correct).toBe(false);
    expect(blank.scores).toEqual({ a: 0, b: WRONG_BONUS, c: WRONG_BONUS });
  });

  it('only takes the answer from the bidder', () => {
    expect(rules.submitAnswer(peekFor(4), deal, 'b', 'Levi Ackerman', ids).patch).toEqual({});
  });
});

describe('rounds', () => {
  it('rotates the opener and moves to the next card', () => {
    let g = peekFor(4);
    g = apply(g, rules.submitAnswer(g, deal, 'a', 'x', ids));
    g = apply(g, rules.nextRound(g, ids));
    expect(g).toMatchObject({ round: 1, cardIndex: 1, phase: 'bidding', turnId: 'b', bid: null, uncovered: [] });
  });

  it('skips the opener who is not here', () => {
    let g = apply(peekFor(4), rules.submitAnswer(peekFor(4), deal, 'a', 'x', ids));
    g = apply(g, rules.nextRound(g, ['a', 'c']));
    expect(g.turnId).toBe('c');
  });

  it('finishes after the last round', () => {
    let g = start();
    for (let r = 0; r < deal.rounds; r++) {
      g = peekFor(4, g);
      g = apply(g, rules.submitAnswer(g, deal, g.bid.by, '', ids));
      g = apply(g, rules.nextRound(g, ids));
    }
    expect(g.phase).toBe('finished');
  });
});

describe('a portrait that will not load', () => {
  it('swaps in the spare and starts the bidding over', () => {
    const bidding = apply(start(), rules.placeBid(start(), 'a', 6, ids));
    const g = apply(bidding, rules.skipCard(bidding, deal, ids));
    expect(g).toMatchObject({ cardIndex: 3, nextSpare: 4, bid: null, turnId: 'a', phase: 'bidding' });
  });

  it('is refused once a tile is open', () => {
    const g = apply(peekFor(4), rules.uncoverTile(peekFor(4), 'a', 0));
    expect(rules.skipCard(g, deal, ids).patch).toEqual({});
  });

  it('voids the round when no spare is left', () => {
    let g = start();
    g = apply(g, rules.skipCard(g, deal, ids));
    g = apply(g, rules.skipCard(g, deal, ids));
    expect(g.phase).toBe('revealed');
    expect(g.result.void).toBe('broken');
    expect(g.scores).toEqual({ a: 0, b: 0, c: 0 });
  });
});

describe('departures', () => {
  it('passes for a bidder whose turn it is and who has gone', () => {
    const g = apply(start(), rules.placeBid(start(), 'a', 8, ids));
    const settled = apply(g, rules.settleIfComplete(g, ['a', 'c']));
    expect(settled.passed.b).toBe(true);
    expect(settled.turnId).toBe('c');
  });

  it('moves the opening turn on when the opener has gone before bidding', () => {
    const settled = apply(start(), rules.settleIfComplete(start(), ['b', 'c']));
    expect(settled.turnId).toBe('b');
    expect(settled.bid).toBeNull();
  });

  it('voids the round when the bidder leaves mid-peek', () => {
    const g = peekFor(4);
    const settled = apply(g, rules.settleIfComplete(g, ['b', 'c']));
    expect(settled.phase).toBe('revealed');
    expect(settled.result).toMatchObject({ by: 'a', void: 'left', points: 0 });
  });

  it('does nothing while everyone it is waiting on is here', () => {
    expect(rules.settleIfComplete(peekFor(4), ids).patch).toEqual({});
  });
});

describe('repair', () => {
  it('rebuilds what Realtime Database drops', () => {
    const raw = {
      order: { 0: 'a', 1: 'b' },
      scores: { a: '4' },
      phase: 'peeking',
      bid: { by: 'a', n: 5 },
      uncovered: [3, , 7], // eslint-disable-line no-sparse-arrays
      round: 1,
    };
    const g = rules.normalizeGame(raw);
    expect(g.order).toEqual(['a', 'b']);
    expect(g.scores).toEqual({ a: 4 });
    expect(g.uncovered).toEqual([3, 7]);
    expect(g.hintsTaken).toEqual([]);
    expect(g.passed).toEqual({});
    expect(g.result).toBeNull();
  });

  it('keeps every card at its own index', () => {
    const d = rules.normalizeDeal({ rounds: 2, cards: { 0: card('x', 'X'), 1: { name: 'broken' }, 2: card('y', 'Y') } });
    expect(d.cards).toHaveLength(3);
    expect(d.cards[1]).toBeNull();
    expect(d.cards[2].key).toBe('y');
  });
});
