import { describe, expect, it } from 'vitest';
import { BOARD_TIERS, boardColumns, columnsFor, lastRow } from './boardLayout';
import { games } from './registry';

describe('board columns', () => {
  it('fills whole rows when some count in range divides the roster', () => {
    expect(boardColumns(12)).toEqual({ base: 2, sm: 4, md: 4, lg: 6, xl: 6 });
    expect(boardColumns(14)).toEqual({ base: 2, sm: 4, md: 5, lg: 5, xl: 7 });
  });

  // The roster this was written for: the old fixed 2/4/6 left one game alone
  // on its last row at every width.
  it('lays 13 out as 7+6 on a desktop and 5+5+3 on a laptop or tablet', () => {
    expect(boardColumns(13)).toEqual({ base: 2, sm: 4, md: 5, lg: 5, xl: 7 });
  });

  it('puts a roster smaller than a tier on one row', () => {
    expect(boardColumns(3)).toEqual({ base: 2, sm: 3, md: 3, lg: 3, xl: 3 });
    expect(boardColumns(1)).toEqual({ base: 1, sm: 1, md: 1, lg: 1, xl: 1 });
  });

  it('prefers more columns when the last row comes out the same', () => {
    // 13 at 3 or 4 across both leave one; 4 is a row fewer.
    expect(columnsFor(13, { min: 3, max: 4 })).toBe(4);
  });

  // The rule's whole promise: a lone tile on the last row only where every
  // count the tier allows would leave one.
  it('leaves a lone last tile only where no allowed count avoids it', () => {
    for (let n = 2; n <= 40; n += 1) {
      for (const tier of BOARD_TIERS) {
        const c = columnsFor(n, tier);
        expect(c).toBeLessThanOrEqual(tier.max);
        if (lastRow(n, c) !== 1) continue;
        for (let alt = tier.min; alt <= Math.min(tier.max, n); alt += 1) {
          expect(lastRow(n, alt), `${n} games, ${tier.tier}: ${alt} across avoids a lone tile`).toBe(1);
        }
      }
    }
  });
});

// The guard on the real roster. A phone is 2 across, so an odd count always
// leaves one centred tile there; a tablet or wider must never. If a new game
// makes one, this fails so the layout gets a decision (another column count for
// a tier, a wider shell) instead of a stray tile shipping.
describe('the registry on the board', () => {
  it('leaves no lone tile on a tablet or wider', () => {
    const cols = boardColumns(games.length);
    for (const tier of ['md', 'lg', 'xl']) {
      expect(lastRow(games.length, cols[tier]), `${games.length} games at ${tier}, ${cols[tier]} across`)
        .toBeGreaterThan(Math.min(1, games.length - 1));
    }
  });
});
