import { describe, expect, it } from 'vitest';
import {
  PICK_POINTS, REASON_POINTS, currentSet, endGame, nextRound, normalizeDeal, normalizeGame,
  outAwards, settleIfComplete, standings, startGame, stillToPick, submitPick,
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
    expect(g).toEqual({ order: ['p1', 'p2'], scores: { p1: 3 }, rounds: 2, round: 0, phase: 'picking', picks: {}, log: [] });
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

describe('the game log and its awards', () => {
  const players = [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Ben' }];

  it('logs each revealed round on the way to the next, the last one included', () => {
    const base = { ...startGame(['p1', 'p2'], { sets: [{}, {}] }), phase: 'revealed' };
    const picks = { p1: { card: 'a', reason: 0, correct: true, reasonRight: true }, p2: { card: 'b', reason: 1, correct: false, reasonRight: false } };
    const one = { ...base, picks, ...nextRound({ ...base, picks }).patch };
    expect(one.log).toEqual([{ round: 0, got: ['p1'], reasons: ['p1'], picks: { p1: 'a', p2: 'b' } }]);
    const two = nextRound({ ...one, phase: 'revealed', picks: {} }).patch;
    expect(two.phase).toBe('finished');
    expect(two.log).toHaveLength(2);
    expect(normalizeGame({ log: { 0: { round: 1 } } }).log).toEqual([{ round: 1, got: [], reasons: [] }]);
    expect(normalizeGame({ log: [{ round: 1, picks: { p1: 'a' } }] }).log[0].picks).toEqual({ p1: 'a' });
  });

  it('names a clear leader, and drops a tie', () => {
    const log = [{ got: ['p1', 'p2'], reasons: ['p1'] }, { got: ['p1'], reasons: ['p1'] }];
    expect(outAwards(log, players).map((a) => [a.title, a.player.id])).toEqual([['Sharpest eye', 'p1'], ['Mind reader', 'p1']]);
    expect(outAwards([{ got: ['p1', 'p2'] }, { got: ['p1', 'p2'] }], players)).toEqual([]);
  });

  it('names the lone wolf, the streak and the contrarian, and roasts the fooled and the reasonless', () => {
    const three = [...players, { id: 'p3', name: 'Cat' }];
    const line = (got, picks, reasons = []) => ({ got, reasons, picks });
    const log = [
      line(['p1'], { p1: 'odd', p2: 'x', p3: 'y' }),
      line(['p1'], { p1: 'odd', p2: 'x', p3: 'x' }),
      line(['p1', 'p3'], { p1: 'odd', p2: 'z', p3: 'odd' }),
      line(['p3'], { p1: 'w', p2: 'v', p3: 'odd' }, ['p3']),
    ];
    const t = Object.fromEntries(outAwards(log, three, { reasonsOn: true }).map((a) => [a.title, [a.player.id, a.detail]]));
    expect(t['Lone wolf']).toEqual(['p1', 'The only one who saw it, 2 times']);
    expect(t['Hot streak']).toEqual(['p1', '3 rounds in a row']);
    expect(t.Contrarian).toEqual(['p2', 'Picked a card nobody else touched, 3 times']);
    expect(t['Fooled again']).toEqual(['p2', 'Picked wrong 4 times']);
    expect(t['Right for the wrong reason']).toEqual(['p1', 'Found it 3 times, never knew why']);
  });
});
