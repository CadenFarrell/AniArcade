import { describe, expect, it } from 'vitest';
import {
  PICK_POINTS, REASON_POINTS, currentSet, endGame, nextRound, normalizeDeal, normalizeGame,
  settleIfComplete, standings, startGame, stillToPick, submitPick,
} from './rules';

const set = (odd = 'z') => ({
  kind: 'studio',
  sentence: 'All animated by MAPPA',
  odd,
  cards: ['a', 'b', 'c', 'd', 'e', 'z'].map((key) => ({ key, name: key.toUpperCase(), series: '', imageUrl: '', note: '' })),
  reasons: ['All animated by Bones', 'All animated by MAPPA', 'All male characters'],
  reason: 1,
});
const DEAL = { rounds: 2, size: 6, reasonsOn: true, sets: [set(), set('a')] };
const IDS = ['p1', 'p2', 'p3'];

const apply = (game, { patch }) => ({ ...game, ...patch });

describe('picking', () => {
  it('waits for every active player, then grades and scores', () => {
    let g = startGame(IDS, DEAL);
    g = apply(g, submitPick(g, DEAL, 'p1', { card: 'z', reason: 1 }, IDS));
    g = apply(g, submitPick(g, DEAL, 'p2', { card: 'z', reason: 0 }, IDS));
    expect(g.phase).toBe('picking');
    expect(stillToPick(g, IDS)).toEqual(['p3']);
    g = apply(g, submitPick(g, DEAL, 'p3', { card: 'b', reason: 1 }, IDS));
    expect(g.phase).toBe('revealed');
    expect(g.scores).toEqual({ p1: PICK_POINTS + REASON_POINTS, p2: PICK_POINTS, p3: 0 });
    expect(g.picks.p3).toMatchObject({ correct: false, reasonRight: false, delta: 0 });
  });

  it('never pays a right reason beside a wrong pick', () => {
    let g = startGame(['p1'], DEAL);
    g = apply(g, submitPick(g, DEAL, 'p1', { card: 'a', reason: 1 }, ['p1']));
    expect(g.scores.p1).toBe(0);
  });

  it('refuses a second pick, a card not dealt, a missing reason, and a stranger', () => {
    let g = startGame(IDS, DEAL);
    expect(submitPick(g, DEAL, 'p1', { card: 'q', reason: 1 }, IDS).patch).toEqual({});
    expect(submitPick(g, DEAL, 'p1', { card: 'z' }, IDS).patch).toEqual({});
    expect(submitPick(g, DEAL, 'p1', { card: 'z', reason: 9 }, IDS).patch).toEqual({});
    expect(submitPick(g, DEAL, 'pX', { card: 'z', reason: 1 }, IDS).patch).toEqual({});
    g = apply(g, submitPick(g, DEAL, 'p1', { card: 'z', reason: 1 }, IDS));
    expect(submitPick(g, DEAL, 'p1', { card: 'a', reason: 0 }, IDS).patch).toEqual({});
  });

  it('takes no reason when reasons are off', () => {
    const deal = { ...DEAL, reasonsOn: false };
    let g = startGame(['p1'], deal);
    g = apply(g, submitPick(g, deal, 'p1', { card: 'z' }, ['p1']));
    expect(g.scores.p1).toBe(PICK_POINTS);
    expect(g.picks.p1.reason).toBe(-1);
  });
});

describe('departures', () => {
  it('settles when the last player everyone waited on leaves', () => {
    let g = startGame(IDS, DEAL);
    g = apply(g, submitPick(g, DEAL, 'p1', { card: 'z', reason: 1 }, IDS));
    g = apply(g, submitPick(g, DEAL, 'p2', { card: 'a', reason: 1 }, IDS));
    expect(settleIfComplete(g, DEAL, IDS).patch).toEqual({});
    g = apply(g, settleIfComplete(g, DEAL, ['p1', 'p2']));
    expect(g.phase).toBe('revealed');
    expect(g.scores.p1).toBe(PICK_POINTS + REASON_POINTS);
  });

  it('never reveals a round nobody picked in', () => {
    const g = startGame(IDS, DEAL);
    expect(settleIfComplete(g, DEAL, []).patch).toEqual({});
  });

  it('ends the game on request, once', () => {
    const g = apply(startGame(IDS, DEAL), endGame(startGame(IDS, DEAL)));
    expect(g.phase).toBe('finished');
    expect(endGame(g).patch).toEqual({});
  });
});

describe('advancing', () => {
  it('moves to the next set, then finishes', () => {
    let g = startGame(['p1'], DEAL);
    expect(nextRound(g).patch).toEqual({});
    g = apply(g, submitPick(g, DEAL, 'p1', { card: 'z', reason: 1 }, ['p1']));
    g = apply(g, nextRound(g));
    expect(g).toMatchObject({ round: 1, phase: 'picking', picks: {} });
    expect(currentSet(g, DEAL).odd).toBe('a');
    g = apply(g, submitPick(g, DEAL, 'p1', { card: 'a', reason: 1 }, ['p1']));
    g = apply(g, nextRound(g));
    expect(g.phase).toBe('finished');
    expect(g.scores.p1).toBe(2 * (PICK_POINTS + REASON_POINTS));
  });
});

describe('repair', () => {
  it('rebuilds what RTDB drops: empty picks, arrays as objects', () => {
    const g = normalizeGame({ order: { 0: 'p1', 1: 'p2' }, scores: { p1: '3' }, rounds: 2, round: 0, phase: 'picking' });
    expect(g).toEqual({ order: ['p1', 'p2'], scores: { p1: 3 }, rounds: 2, round: 0, phase: 'picking', picks: {} });
    expect(normalizeGame({ picks: { p1: { card: 'z', reason: 0 }, p2: { nope: 1 } } }).picks)
      .toEqual({ p1: { card: 'z', reason: 0 } });
    const d = normalizeDeal({ rounds: 1, sets: { 0: { ...set(), cards: { 0: { key: 'a' } }, reasons: null } } });
    expect(d.sets[0].cards).toEqual([{ key: 'a', name: '', series: '', imageUrl: '', note: '' }]);
    expect(d.sets[0].reasons).toEqual([]);
    expect(d.reasonsOn).toBe(true);
  });

  it('ranks ties together', () => {
    const r = standings([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { a: 3, b: 5, c: 3 });
    expect(r.map((p) => [p.id, p.position])).toEqual([['b', 1], ['a', 2], ['c', 2]]);
  });
});
