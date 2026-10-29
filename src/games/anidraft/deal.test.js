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
    let shared = 0;
    for (let i = 0; i < 200; i++) {
      const [first] = dealBoard(players, { size: 1 }, () => Math.random());
      if (first.name === 'Naruto Uzumaki' || first.name === 'Sasuke Uchiha') shared += 1;
    }
    // Two of 62 characters, each with twice the weight: about 6% by chance
    // alone, so well over that means the weight is doing its job.
    expect(shared).toBeGreaterThan(8);
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
