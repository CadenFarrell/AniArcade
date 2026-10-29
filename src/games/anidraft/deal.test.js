import { describe, expect, it } from 'vitest';
import { dealBoard, draftPool, firstDeal, roundDeal } from './deal';
import * as rules from './rules';

const show = (title, names, role = 'MAIN', pictured = true) => ({
  title,
  characters: names.map((name) => ({ name, role, imageUrl: pictured ? `https://x/${name}.jpg` : '' })),
});
const names = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix} ${i}`);

const players = [
  { id: 'a', animeList: [show('Naruto', ['Naruto Uzumaki', 'Sasuke Uchiha']), show('Big A', names('Alpha', 20))] },
  { id: 'b', animeList: [show('Naruto', ['Naruto Uzumaki', 'Sasuke Uchiha']), show('Big B', names('Beta', 20))] },
  { id: 'c', animeList: [show('Side', ['Extra Person'], 'SUPPORTING'), show('Big C', names('Gamma', 20))] },
];

describe('draftPool', () => {
  it('keeps main characters, or everyone when nobody is marked main', () => {
    expect(draftPool(players, 'main').map((c) => c.entry.name)).not.toContain('Extra Person');
    expect(draftPool(players, 'all').map((c) => c.entry.name)).toContain('Extra Person');
    const nobodyMain = [{ id: 'x', animeList: [show('Side', ['Extra Person'], 'SUPPORTING')] }];
    expect(draftPool(nobodyMain, 'main')).toHaveLength(1);
  });
});

describe('dealBoard', () => {
  it('deals distinct cards, as many as asked for', () => {
    const board = dealBoard(players, { size: 23 });
    expect(board).toHaveLength(23);
    expect(new Set(board.map((c) => c.key)).size).toBe(23);
    expect(board[0]).toMatchObject({ key: expect.any(String), name: expect.any(String), series: expect.any(String) });
  });

  it('favours characters more of the table holds', () => {
    // The one draw's rng swept evenly over [0, 1), not sampled: a sample of
    // Math.random once landed on the threshold and failed CI by luck. Swept,
    // the count IS the weight share, to within a grid step either side.
    const N = 1280;
    let shared = 0;
    for (let i = 0; i < N; i++) {
      const [first] = dealBoard(players, { size: 1 }, () => (i + 0.5) / N);
      if (first.name === 'Naruto Uzumaki' || first.name === 'Sasuke Uchiha') shared += 1;
    }
    // Two of 62 mains, held by two players each: weight 2 × 2 against the
    // rest's 1 × 2, so 8 of 128 — twice their 2-in-62 share unweighted.
    expect(Math.abs(shared - (N * 8) / 128)).toBeLessThanOrEqual(1);
    expect(shared).toBeGreaterThan((N * 2) / 62 + 10);
  });

  it('deals nothing used again until the lists run short, and never a drafted one', () => {
    const pool = draftPool(players).map((c) => c.entry.id);
    const used = pool.slice(0, 50);
    const board = dealBoard(players, { size: 12, used });
    expect(board.every((c) => !used.includes(c.key))).toBe(true);
    // 12 fresh are all that is left: the rest are topped up from the used, never the drafted.
    const drafted = pool.slice(0, 10);
    const topped = dealBoard(players, { size: 30, used, drafted });
    expect(topped).toHaveLength(30);
    expect(topped.some((c) => drafted.includes(c.key))).toBe(false);
  });
});

describe('a game’s deals', () => {
  it('feeds startGame and nextRound a board they accept', () => {
    const ids = players.map((p) => p.id);
    const deal = firstDeal(players);
    expect(deal.board).toHaveLength(rules.boardSize(3));
    expect(deal.roles).toHaveLength(rules.ROLES_PER_ROUND);
    const game = rules.startGame({ ids, rounds: 2, ...deal });
    expect(game.phase).toBe('draft');
    const next = roundDeal(players, game);
    expect(next.board.some((c) => game.used.includes(c.key))).toBe(false);
    expect(next.roles.some((r) => game.roles.includes(r))).toBe(false);
  });
});
