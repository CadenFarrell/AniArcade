import { describe, expect, it } from 'vitest';
import {
  GROUP_POINTS, PICK_POINTS, REASON_POINTS, gradeSort, currentSet, endGame, nextRound, normalizeDeal, normalizeGame,
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

  const three = [...players, { id: 'p3', name: 'Cat' }];
  const names = { odd: 'Levi', x: 'Rem', y: 'Emilia', z: 'Ram', w: 'Subaru', v: 'Beatrice' };
  const opts = { reasonsOn: true, nameOf: (r, key) => names[key] ?? '', oddOf: () => 'Levi' };
  const titles = (log) => Object.fromEntries(outAwards(log, three, opts).map((a) => [a.title, [a.player.id, a.detail]]));
  const line = (got, picks, reasons = []) => ({ got, reasons, picks });

  it('names the lone wolf, the streak, full marks and the perfect game', () => {
    const log = [
      line(['p1'], { p1: 'odd', p2: 'x', p3: 'y' }, ['p1']),
      line(['p1', 'p3'], { p1: 'odd', p2: 'x', p3: 'odd' }, ['p1', 'p3']),
      line(['p1', 'p3'], { p1: 'odd', p2: 'z', p3: 'odd' }, ['p3']),
    ];
    const t = titles(log);
    expect(t['Lone wolf']).toEqual(['p1', 'The only one who spotted Levi']);
    expect(t['Hot streak']).toEqual(['p1', '3 rounds in a row']);
    expect(t['Perfect game']).toEqual(['p1', 'Found the odd one out all 3 rounds']);
    expect(t['Full marks']).toBeUndefined(); // p1 once, p3 once
    expect(outAwards([{ got: ['p1', 'p2'] }, { got: ['p1', 'p2'] }], players)).toEqual([]);
  });

  it('names against the grain, and roasts the herd, the contrarian, the fooled and the blind spot', () => {
    const four = [...three, { id: 'p4', name: 'Dan' }];
    const t = Object.fromEntries(outAwards([
      line(['p1'], { p1: 'odd', p2: 'x', p3: 'x', p4: 'x' }),
      line(['p1', 'p3', 'p4'], { p1: 'odd', p2: 'y', p3: 'odd', p4: 'odd' }),
      line(['p3'], { p1: 'w', p2: 'v', p3: 'odd', p4: 'w' }),
    ], four, opts).map((a) => [a.title, [a.player.id, a.detail]]));
    expect(t['Against the grain']).toEqual(['p1', 'Picked Levi while everyone else fell for Rem']);
    expect(t['Herd mentality']).toBeUndefined(); // p2, p3 and p4 all did
    expect(t['Blind spot']).toEqual(['p2', 'The only one who missed Levi']);
    expect(t['Fooled again']).toEqual(['p2', 'Picked wrong 3 times']);
    expect(t.Contrarian).toEqual(['p2', 'Picked a card nobody else touched, 2 times']);
  });

  it('roasts the reasonless', () => {
    const log = [
      line(['p1'], { p1: 'odd', p2: 'x' }),
      line(['p1'], { p1: 'odd', p2: 'x' }),
      line(['p1', 'p2'], { p1: 'odd', p2: 'odd' }, ['p2']),
    ];
    expect(titles(log)['Right for the wrong reason']).toEqual(['p1', 'Found it 3 times, never knew why']);
  });
});

// "Groups of four": a board of eight in two groups keeps the cases readable;
// the rules never assume four groups.
const board = () => ({
  groups: [
    { kind: 'studio', sentence: 'All animated by MAPPA', keys: ['a', 'b', 'c', 'd'], reason: 2 },
    { kind: 'year', sentence: 'All from shows that first aired in 2006', keys: ['e', 'f', 'g', 'h'], reason: 0 },
  ],
  cards: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((key) => ({ key, name: key.toUpperCase(), series: '', imageUrl: '', note: '' })),
  reasons: ['All from shows that first aired in 2006', 'All male characters', 'All animated by MAPPA'],
});
const BOARDS = { mode: 'groups', rounds: 1, reasonsOn: true, sets: [board()] };
const RIGHT = { groups: [['h', 'g', 'f', 'e'], ['b', 'a', 'd', 'c']], reasons: [0, 2] };

describe('sorting a board', () => {
  it('grades groups as sets, whatever their order, and pays reasons only beside a right group', () => {
    expect(gradeSort(board(), RIGHT, true)).toEqual({
      groupsRight: 2, reasonsRight: 2, correct: true, reasonRight: true, delta: 2 * GROUP_POINTS + 2 * REASON_POINTS,
    });
    const swapped = { groups: [['a', 'b', 'c', 'e'], ['d', 'f', 'g', 'h']], reasons: [2, 0] };
    expect(gradeSort(board(), swapped, true)).toMatchObject({ groupsRight: 0, reasonsRight: 0, correct: false, delta: 0 });
    const halfWhy = { ...RIGHT, reasons: [1, 2] };
    expect(gradeSort(board(), halfWhy, true)).toMatchObject({ correct: true, reasonRight: false, reasonsRight: 1 });
  });

  it('waits for every sort, then reveals', () => {
    let g = startGame(['p1', 'p2'], BOARDS);
    g = apply(g, submitPick(g, BOARDS, 'p1', RIGHT, ['p1', 'p2']));
    expect(g.phase).toBe('picking');
    g = apply(g, submitPick(g, BOARDS, 'p2', { groups: [['a', 'b', 'c', 'e'], ['d', 'f', 'g', 'h']], reasons: [0, 1] }, ['p1', 'p2']));
    expect(g.phase).toBe('revealed');
    expect(g.scores).toEqual({ p1: 2 * GROUP_POINTS + 2 * REASON_POINTS, p2: 0 });
  });

  it('refuses a sort that is not a partition of the board, or lacks a reason', () => {
    const g = startGame(['p1'], BOARDS);
    const bad = [
      { groups: [['a', 'b', 'c', 'd']], reasons: [2] }, // a group short
      { groups: [['a', 'b', 'c', 'd'], ['a', 'f', 'g', 'h']], reasons: [2, 0] }, // a card twice
      { groups: [['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'z']], reasons: [2, 0] }, // a card not dealt
      { groups: [['a', 'b', 'c'], ['d', 'e', 'f', 'g', 'h']], reasons: [2, 0] }, // wrong sizes
      { groups: RIGHT.groups, reasons: [0] }, // a reason missing
      { groups: RIGHT.groups, reasons: [0, 7] }, // a reason not on offer
    ];
    for (const pick of bad) expect(submitPick(g, BOARDS, 'p1', pick, ['p1']).patch).toEqual({});
    const off = { ...BOARDS, reasonsOn: false };
    expect(submitPick(g, off, 'p1', { groups: RIGHT.groups }, ['p1']).patch.phase).toBe('revealed');
  });

  it('logs a board as sorted counts, and the awards speak of boards', () => {
    const deal = { ...BOARDS, rounds: 2, sets: [board(), board()] };
    let g = startGame(['p1', 'p2'], deal);
    for (let r = 0; r < 2; r++) {
      g = apply(g, submitPick(g, deal, 'p1', RIGHT, ['p1', 'p2']));
      g = apply(g, submitPick(g, deal, 'p2', { groups: [['a', 'b', 'c', 'e'], ['d', 'f', 'g', 'h']], reasons: [2, 0] }, ['p1', 'p2']));
      g = apply(g, nextRound(g));
    }
    expect(g.phase).toBe('finished');
    expect(g.log[0]).toEqual({ round: 0, got: ['p1'], reasons: ['p1'], sorted: { p1: 2, p2: 0 } });
    expect(g.log[0].picks).toBeUndefined();
    const players = [{ id: 'p1', name: 'Ada' }, { id: 'p2', name: 'Bo' }];
    const awards = outAwards(g.log, players, { reasonsOn: true });
    const lone = awards.find((a) => a.title === 'Lone wolf');
    expect(lone.detail).toMatch(/2 boards/);
    expect(awards.find((a) => a.title === 'Perfect game').detail).toBe('Sorted all 2 boards');
    expect(awards.find((a) => a.title === 'Full marks').detail).toMatch(/every group and every reason/i);
    expect(awards.map((a) => a.title)).not.toContain('Contrarian');
  });

  it('repairs a board and a sort that RTDB returned as objects', () => {
    const raw = {
      mode: 'groups', rounds: 1, reasonsOn: true,
      sets: { 0: { ...board(), groups: { 0: { ...board().groups[0], keys: { 0: 'a', 1: 'b', 2: 'c', 3: 'd' } }, 1: board().groups[1] } } },
    };
    const deal = normalizeDeal(raw);
    expect(deal.mode).toBe('groups');
    expect(deal.sets[0].groups[0].keys).toEqual(['a', 'b', 'c', 'd']);
    const game = normalizeGame({
      order: ['p1'], scores: { p1: 0 }, rounds: 1, round: 0, phase: 'picking',
      picks: { p1: { groups: { 0: { 0: 'a', 1: 'b', 2: 'c', 3: 'd' }, 1: ['e', 'f', 'g', 'h'] } } },
      log: [{ round: 0, got: ['p1'], sorted: { p1: 2, p2: 0 } }],
    });
    expect(game.picks.p1).toEqual({ groups: [['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']], reasons: [] });
    expect(game.log[0].sorted).toEqual({ p1: 2, p2: 0 });
    expect(normalizeDeal({ rounds: 1, sets: [] }).mode).toBe('odd');
  });
});
