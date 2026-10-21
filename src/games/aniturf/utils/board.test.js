import { describe, expect, it } from 'vitest';
import { boardPool, drawBoard } from './board';

function player(id, names, extra = {}) {
  return {
    id,
    name: id,
    animeList: [{ title: `${id} show`, characters: names.map((name) => ({ name, ...extra[name] })) }],
  };
}

const names = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix} ${i}`);

describe('drawBoard', () => {
  it('needs 25 characters and says how many it found', () => {
    const r = drawBoard([player('a', names('Hero', 20))]);
    expect(r).toEqual({ board: [], enough: false, available: 20 });
  });

  it('deals 25 distinct characters, one per folded name', () => {
    const a = player('a', [...names('Hero', 20), 'Émilia', 'Emilia']);
    const b = player('b', names('Side', 10));
    const { board, enough } = drawBoard([a, b], { rng: () => 0.42 });
    expect(enough).toBe(true);
    expect(board).toHaveLength(25);
    expect(new Set(board.map((c) => c.id)).size).toBe(25);
    expect(Object.keys(board[0]).sort()).toEqual(['id', 'imageUrl', 'name', 'series']);
  });

  it('leans toward characters more of the table holds', () => {
    const shared = names('Shared', 25);
    const a = player('a', [...shared, ...names('OnlyA', 40)]);
    const b = player('b', [...shared, ...names('OnlyB', 40)]);
    // Fifty-slot window: all 25 shared characters rank first, so on any shuffle
    // most of the board is shared.
    let sharedSeen = 0;
    for (let s = 0; s < 20; s++) {
      let x = s + 1;
      const rng = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
      sharedSeen += drawBoard([a, b], { rng }).board.filter((c) => c.name.startsWith('Shared')).length;
    }
    expect(sharedSeen / 20).toBeGreaterThan(9);
  });

  it('shared-only keeps characters everyone holds', () => {
    const shared = names('Shared', 24);
    const a = player('a', [...shared, 'Extra']);
    const b = player('b', shared);
    expect(boardPool([a, b], { sharedOnly: true })).toHaveLength(24);
    expect(drawBoard([a, b], { sharedOnly: true }).enough).toBe(false);
    expect(drawBoard([a, b]).enough).toBe(true);
  });
});
