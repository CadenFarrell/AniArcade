import { describe, expect, it } from 'vitest';
import * as rules from './rules';

const { CELLS, DECOYS } = rules;

// A seeded generator, so a failing footing is a replayable one.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const at = (r, c) => r * 5 + c;
const row = (r) => [0, 1, 2, 3, 4].map((c) => at(r, c));
const col = (c) => [0, 1, 2, 3, 4].map((r) => at(r, c));
const board = Array.from({ length: CELLS }, (_, i) => ({ id: `c${i}`, name: `Char ${i}`, series: 'Show' }));

function game(overrides = {}) {
  return {
    ...rules.startGame({
      board,
      teams: { red: ['r1', 'r2'], blue: ['b1', 'b2'] },
      clueGivers: { red: 'r1', blue: 'b1' },
      startTeam: 'red',
      traps: 2,
    }),
    phase: 'guess',
    clue: { team: 'red', word: 'x', number: 3 },
    claimsLeft: 3,
    ...overrides,
  };
}

describe('geometry', () => {
  it('connects squares orthogonally', () => {
    expect(rules.neighbors(0).sort()).toEqual([1, 5]);
    expect(rules.neighbors(12).sort((a, b) => a - b)).toEqual([7, 11, 13, 17]);
    expect(rules.neighbors(24).sort()).toEqual([19, 23]);
  });

  it('gives red the side edges and blue the top and bottom', () => {
    expect(rules.onEdge('red', at(2, 0))).toBe(true);
    expect(rules.onEdge('red', at(2, 4))).toBe(true);
    expect(rules.onEdge('red', at(0, 2))).toBe(false);
    expect(rules.onEdge('blue', at(0, 2))).toBe(true);
    expect(rules.onEdge('blue', at(4, 2))).toBe(true);
    expect(rules.onEdge('blue', at(2, 0))).toBe(false);
  });
});

describe('routeCount', () => {
  it('counts square-disjoint routes across', () => {
    expect(rules.routeCount(row(1), 'red')).toBe(1);
    expect(rules.routeCount([...row(1), ...row(3)], 'red')).toBe(2);
    // A column crossing a row adds squares but no second way across.
    expect(rules.routeCount([...row(2), ...col(2)], 'red')).toBe(1);
    expect(rules.routeCount(row(1), 'blue')).toBe(0);
    expect(rules.routeCount(col(0), 'blue')).toBe(1);
  });

  it('sees that a single bottleneck square caps the count at one', () => {
    // Rows 1 and 3 on the left half, funnelled through (2,2), rows again after.
    const cells = [at(1, 0), at(1, 1), at(1, 2), at(3, 0), at(3, 1), at(3, 2), at(2, 2), at(2, 3), at(2, 4)];
    expect(rules.routeCount(cells, 'red')).toBe(1);
  });

  it('a red route and a blue route always share a square', () => {
    for (let seed = 1; seed < 60; seed++) {
      const red = rules.makeFooting('red', seeded(seed));
      const blue = rules.makeFooting('blue', seeded(seed + 1000));
      expect(red.some((i) => blue.includes(i))).toBe(true);
    }
  });
});

describe('makeFooting', () => {
  // Red's view of a key: Blue's is the transpose, so test Blue turned back.
  const asRed = (team, cells) => (team === 'red' ? cells : cells.map((i) => at(i % 5, Math.floor(i / 5))));

  it.each(['red', 'blue'])('deals %s one winding route across plus decoys that touch nothing', (team) => {
    for (let seed = 1; seed <= 300; seed++) {
      const footing = rules.makeFooting(team, seeded(seed));
      const set = new Set(footing);
      expect(set.size).toBe(footing.length);
      expect(footing.every((i) => i >= 0 && i < CELLS)).toBe(true);
      expect(rules.routeCount(footing, team, 1)).toBe(1);
      // Exactly DECOYS squares stand alone, touching no other footing square.
      const lone = footing.filter((i) => !rules.neighbors(i).some((n) => set.has(n)));
      expect(lone).toHaveLength(DECOYS);
      // Never a whole straight line: the route bends at least once.
      const red = new Set(asRed(team, footing));
      for (let r = 0; r < 5; r++) expect(row(r).every((i) => red.has(i))).toBe(false);
    }
  });

  it('is a replay for one seed', () => {
    expect(rules.makeFooting('red', seeded(7))).toEqual(rules.makeFooting('red', seeded(7)));
  });
});

describe('connected / routeAlive', () => {
  it('wins only on an unbroken run between both edges', () => {
    const marks = Array(CELLS).fill(null);
    row(2).slice(0, 4).forEach((i) => { marks[i] = 'red'; });
    expect(rules.connected(marks, 'red')).toBe(false);
    marks[at(2, 4)] = 'red';
    expect(rules.connected(marks, 'red')).toBe(true);
    expect(rules.connected(marks, 'blue')).toBe(false);
  });

  it('blocks a route on rubble and on the other team, not on its own claims', () => {
    const footing = row(2);
    const marks = Array(CELLS).fill(null);
    marks[at(2, 0)] = 'red';
    expect(rules.routeAlive(footing, marks, 'red')).toBe(true);
    marks[at(2, 2)] = 'blue';
    expect(rules.routeAlive(footing, marks, 'red')).toBe(false);
    marks[at(2, 2)] = 'miss';
    expect(rules.routeAlive(footing, marks, 'red')).toBe(false);
    marks[at(2, 2)] = null;
    expect(rules.routeAlive([...row(2), ...row(4)], marks, 'red')).toBe(true);
  });
});

describe('canClaim', () => {
  it('opens a team its own edges and squares touching its territory', () => {
    const g = game();
    expect(rules.canClaim(g, 'red', at(2, 0))).toBe(true);
    expect(rules.canClaim(g, 'red', at(2, 1))).toBe(false);
    g.marks[at(2, 0)] = 'red';
    expect(rules.canClaim(g, 'red', at(2, 1))).toBe(true);
    expect(rules.canClaim(g, 'red', at(2, 0))).toBe(false);
    g.marks[at(3, 0)] = 'miss';
    expect(rules.canClaim(g, 'red', at(3, 0))).toBe(false);
  });
});

describe('validClue', () => {
  const cast = [{ name: 'Levi Ackerman' }, { name: 'Ōtsutsuki Kaguya' }];
  it('takes one word that is not a name on the board', () => {
    expect(rules.validClue('Titan', cast).ok).toBe(true);
    expect(rules.validClue('  ninja ', cast).ok).toBe(true);
  });
  it('refuses blanks, phrases and board names (folded)', () => {
    expect(rules.validClue('', cast).ok).toBe(false);
    expect(rules.validClue('big sword', cast).reason).toMatch(/one word/i);
    expect(rules.validClue('levi', cast).reason).toMatch(/Levi Ackerman/);
    expect(rules.validClue('otsutsuki', cast).ok).toBe(false);
    expect(rules.validClue('LeviAckerman', cast).ok).toBe(false);
    expect(rules.validClue('x'.repeat(30), cast).ok).toBe(false);
  });
});

describe('a turn', () => {
  it('needs both traps planted before the first clue', () => {
    let g = { ...game(), phase: 'plant' };
    g = { ...g, ...rules.plant(g, 'red').patch };
    expect(g.phase).toBe('plant');
    g = { ...g, ...rules.plant(g, 'blue').patch };
    expect(g.phase).toBe('clue');
  });

  it('opens guessing on a valid clue from the team on turn only', () => {
    const g = { ...game(), phase: 'clue', clue: null, claimsLeft: 0 };
    expect(rules.giveClue(g, 'blue', 'ninja', 2).patch).toEqual({});
    expect(rules.giveClue(g, 'red', 'two words', 2).patch).toEqual({});
    expect(rules.giveClue(g, 'red', 'ninja', 0).patch).toEqual({});
    const { patch } = rules.giveClue(g, 'red', 'ninja', 2);
    expect(patch).toMatchObject({ phase: 'guess', claimsLeft: 2, claimsMade: 0 });
    expect(patch.log.at(-1)).toMatchObject({ kind: 'clue', word: 'ninja', number: 2 });
  });

  it('claims footing and plays on while the clue allows', () => {
    const g = game();
    const { patch, outcome } = rules.resolveClaim(g, { cell: at(2, 0), footing: true });
    expect(outcome).toBe('claim');
    expect(patch.marks[at(2, 0)]).toBe('red');
    expect(patch.claimsLeft).toBe(2);
    expect(patch.claimOrder.red).toEqual([at(2, 0)]);
  });

  it('ends the turn after the last claim the clue allows', () => {
    const g = game({ claimsLeft: 1 });
    const { patch } = rules.resolveClaim(g, { cell: at(2, 0), footing: true });
    expect(patch).toMatchObject({ phase: 'clue', turn: 'blue', clue: null, claimsLeft: 0 });
  });

  it('scorches a miss for both teams and passes the turn', () => {
    const g = game();
    const { patch, outcome } = rules.resolveClaim(g, { cell: at(0, 0), footing: false });
    expect(outcome).toBe('miss');
    expect(patch.marks[at(0, 0)]).toBe('miss');
    expect(patch.turn).toBe('blue');
    expect(rules.canClaim({ ...g, ...patch }, 'blue', at(0, 0))).toBe(false);
  });

  it('a sprung trap scorches the square and takes back the newest claim', () => {
    let g = game();
    g = { ...g, ...rules.resolveClaim(g, { cell: at(2, 0), footing: true }).patch };
    g = { ...g, ...rules.resolveClaim(g, { cell: at(2, 1), footing: true }).patch };
    const { patch, outcome } = rules.resolveClaim(g, { cell: at(2, 2), footing: true, trapped: true });
    expect(outcome).toBe('trap');
    expect(patch.marks[at(2, 2)]).toBe('trap');
    expect(patch.marks[at(2, 1)]).toBe(null);
    expect(patch.marks[at(2, 0)]).toBe('red');
    expect(patch.claimOrder.red).toEqual([at(2, 0)]);
    expect(patch.turn).toBe('blue');
    expect(patch.log.at(-1)).toMatchObject({ kind: 'trap', undone: at(2, 1) });
  });

  it('a trap on a team with no claims takes nothing back', () => {
    const { patch } = rules.resolveClaim(game(), { cell: at(2, 0), footing: true, trapped: true });
    expect(patch.marks[at(2, 0)]).toBe('trap');
    expect(patch.log.at(-1).undone).toBe(null);
  });

  it('wins the moment a claim joins both edges', () => {
    const g = game({ claimsLeft: 9 });
    row(1).slice(0, 4).forEach((i) => { g.marks[i] = 'red'; });
    const { patch } = rules.resolveClaim(g, { cell: at(1, 4), footing: true });
    expect(patch).toMatchObject({ phase: 'over', winner: 'red', loser: 'blue', winBy: 'connect' });
  });

  it('refuses a claim that is not open to the team', () => {
    expect(rules.resolveClaim(game(), { cell: at(2, 2), footing: true }).patch).toEqual({});
  });

  it('lets the guessers stop only after a claim', () => {
    let g = game();
    expect(rules.canStop(g, 'red')).toBe(false);
    g = { ...g, ...rules.resolveClaim(g, { cell: at(2, 0), footing: true }).patch };
    expect(rules.canStop(g, 'red')).toBe(true);
    expect(rules.stopGuessing(g, 'red').patch).toMatchObject({ turn: 'blue', phase: 'clue' });
  });

  it('lets a boxed-in team stop without a claim', () => {
    const g = game();
    [...col(0), ...col(4)].forEach((i) => { g.marks[i] = 'miss'; });
    expect(rules.canStop(g, 'red')).toBe(true);
  });
});

describe('the online claim handshake', () => {
  it('queues one claim at a time, then marks footing, then resolves', () => {
    let g = game();
    const req = rules.requestClaim(g, 'red', at(2, 0), 'r2').patch;
    expect(req.pending).toMatchObject({ cell: at(2, 0), team: 'red', seq: 1, footing: false });
    g = { ...g, ...req };
    expect(rules.requestClaim(g, 'red', at(3, 0), 'r2').patch).toEqual({});
    expect(rules.markFooting(g, 99).patch).toEqual({});
    g = { ...g, ...rules.markFooting(g, 1).patch };
    expect(g.pending.footing).toBe(true);
    g = { ...g, ...rules.resolveClaim(g, { cell: at(2, 0), footing: true, by: 'r2' }).patch };
    expect(g.pending).toBe(null);
    expect(g.marks[at(2, 0)]).toBe('red');
  });

  it('refuses a claim from the team not on turn', () => {
    expect(rules.requestClaim(game(), 'blue', at(0, 2), 'b2').patch).toEqual({});
  });
});

describe('ending', () => {
  it('a cut team loses', () => {
    expect(rules.declareCut(game(), 'red').patch).toMatchObject({ phase: 'over', winner: 'blue', winBy: 'cut' });
    expect(rules.declareCut({ ...game(), phase: 'over' }, 'red').patch).toEqual({});
  });

  it('banks a win for every player on the winning team', () => {
    const g = { ...game(), winner: 'blue' };
    expect(rules.applyWin({ r1: 2, b1: 1 }, g)).toEqual({ r1: 2, b1: 2, b2: 1 });
  });
});

describe('teams', () => {
  it('alternates seats and needs two a side', () => {
    const teams = rules.assignTeams(['a', 'b', 'c', 'd', 'e']);
    expect(teams).toEqual({ red: ['a', 'c', 'e'], blue: ['b', 'd'] });
    expect(rules.teamsReady(teams).ok).toBe(true);
    expect(rules.teamsReady({ red: ['a', 'b', 'c'], blue: ['d'] }).reason).toMatch(/Blue needs 2/);
  });

  it('splits unchosen players evenly and honours a choice', () => {
    expect(rules.splitTeams(['a', 'b', 'c', 'd'])).toEqual({ red: ['a', 'c'], blue: ['b', 'd'] });
    expect(rules.splitTeams(['a', 'b', 'c', 'd'], { a: 'blue' })).toEqual({ red: ['b', 'c'], blue: ['a', 'd'] });
    expect(rules.splitTeams(['a', 'b', 'c'], { c: 'red' }).red).toContain('c');
  });

  it('keeps a chosen clue-giver only while they are on the team', () => {
    const teams = { red: ['a', 'c'], blue: ['b', 'd'] };
    expect(rules.resolveGivers(teams, { red: 'c', blue: 'a' })).toEqual({ red: 'c', blue: 'b' });
  });

  it('rotates the clue-giver round each team', () => {
    const teams = { red: ['a', 'c', 'e'], blue: ['b', 'd'] };
    expect(rules.rotateGivers(teams, { red: 'e', blue: 'b' })).toEqual({ red: 'a', blue: 'd' });
  });

  it('gives the second team one extra trap, and none when traps are off', () => {
    expect(rules.trapsFor(2, 'red', 'red')).toBe(2);
    expect(rules.trapsFor(2, 'blue', 'red')).toBe(3);
    expect(rules.trapsFor(0, 'blue', 'red')).toBe(0);
  });
});

describe('promoteGiver', () => {
  it('hands the role to the next teammate here and moves the key stamp on', () => {
    const g = { ...game(), teams: { red: ['r1', 'r2', 'r3'], blue: ['b1', 'b2'] } };
    const { patch } = rules.promoteGiver(g, 'red', ['r2', 'r3', 'b1', 'b2']);
    expect(patch.clueGivers.red).toBe('r2');
    expect(patch.keyStamp.red).toBe(2);
    expect(patch.log.at(-1)).toMatchObject({ kind: 'migrate', from: 'r1', to: 'r2' });
  });

  it('forfeits a team that would be left with nobody to guess', () => {
    const { patch } = rules.promoteGiver(game(), 'red', ['r2', 'b1', 'b2']);
    expect(patch).toMatchObject({ phase: 'over', winner: 'blue', winBy: 'forfeit' });
  });

  it('says traps were lost only once they had been planted', () => {
    const g = { ...game(), teams: { red: ['r1', 'r2', 'r3'], blue: ['b1', 'b2'] } };
    expect(rules.promoteGiver(g, 'red', ['r2', 'r3']).patch.log.at(-1).trapsLost).toBe(true);
    expect(rules.promoteGiver({ ...g, phase: 'plant' }, 'red', ['r2', 'r3']).patch.log.at(-1).trapsLost).toBe(false);
    expect(rules.promoteGiver({ ...g, traps: 0 }, 'red', ['r2', 'r3']).patch.log.at(-1).trapsLost).toBe(false);
  });

  it('un-plants a team whose giver left before planting', () => {
    const g = { ...game(), phase: 'plant', teams: { red: ['r1', 'r2', 'r3'], blue: ['b1', 'b2'] }, planted: { red: true, blue: false } };
    expect(rules.promoteGiver(g, 'red', ['r2', 'r3']).patch.planted.red).toBe(false);
  });
});

describe('rebuildFooting', () => {
  it('agrees with the board: every claim in, every scorch out, still crossable', () => {
    for (let seed = 1; seed < 80; seed++) {
      const rng = seeded(seed);
      const g = game();
      g.marks[at(2, 0)] = 'red';
      g.marks[at(2, 1)] = 'red';
      g.claimOrder.red = [at(2, 0), at(2, 1)];
      g.marks[at(2, 2)] = 'miss';
      g.marks[at(1, 1)] = 'blue';
      const footing = rules.rebuildFooting(g, 'red', rng);
      expect(footing).toContain(at(2, 0));
      expect(footing).toContain(at(2, 1));
      expect(footing).not.toContain(at(2, 2));
      expect(footing).not.toContain(at(1, 1));
      expect(rules.routeAlive(footing, g.marks, 'red')).toBe(true);
    }
  });

  it('deals no route at all to a team the board has already cut off', () => {
    const g = game();
    col(2).forEach((i) => { g.marks[i] = 'blue'; });
    expect(rules.routeAlive(rules.rebuildFooting(g, 'red', seeded(3)), g.marks, 'red')).toBe(false);
  });
});

describe('rerouteFooting', () => {
  it('adds a detour around a cut and takes nothing away', () => {
    for (let seed = 1; seed < 60; seed++) {
      const g = game();
      const key = row(2);
      g.marks[at(2, 0)] = 'red';
      g.claimOrder.red = [at(2, 0)];
      g.marks[at(2, 2)] = 'blue'; // Blue took a crossroads: row 2 is cut
      expect(rules.routeAlive(key, g.marks, 'red')).toBe(false);
      const next = rules.rerouteFooting(g, 'red', key, seeded(seed));
      expect(key.every((i) => next.includes(i))).toBe(true);
      expect(next).not.toContain(at(2, 2) + 100); // sanity: only real squares
      expect(rules.routeAlive(next, g.marks, 'red')).toBe(true);
      // The cheapest way round is short: claims and the old key cost nothing.
      expect(next.length - key.length).toBeLessThanOrEqual(4);
    }
  });

  it('returns null when the board leaves no way across', () => {
    const g = game();
    col(2).forEach((i) => { g.marks[i] = 'miss'; });
    expect(rules.rerouteFooting(g, 'red', row(2), seeded(1))).toBe(null);
  });

  it('merges a detour the clue-giver has not seen yet into the next notice', () => {
    const g = { ...game(), log: [{ kind: 'clue', team: 'red' }, { kind: 'claim' }, { kind: 'miss' }] };
    const first = rules.nextDetour({ ...g, log: g.log.slice(0, 2) }, 'red', null, [3]);
    expect(rules.nextDetour(g, 'red', first, [8]).squares).toEqual([3, 8]);
    // After the team's next clue, the old detour has been shown.
    const later = { ...g, log: [...g.log, { kind: 'clue', team: 'red' }, { kind: 'claim' }] };
    expect(rules.nextDetour(later, 'red', first, [9]).squares).toEqual([9]);
  });
});

// The reason the key is one winding route rather than two straight ones: a
// team that ignores every clue and pushes in a straight line must not cross
// quickly. Simulated, seeded, against the real generator and rules. Two
// straight routes crossed in ~3 turns; this design measured ~6.9.
describe('guessability', () => {
  it('a clue-blind straight-line push takes many turns', () => {
    const rng = seeded(99);
    const pick = (a) => a[Math.floor(rng() * a.length)];
    let turns = 0;
    let ahead = 0;
    let aheadOf = 0;
    const N = 400;
    for (let n = 0; n < N; n++) {
      const key = new Set(rules.makeFooting('red', rng));
      for (const i of key) if (i % 5 < 4) { aheadOf += 1; if (key.has(i + 1)) ahead += 1; }
      const g = game();
      let t = 1;
      for (; t < 40; t++) {
        let miss = false;
        for (let k = 0; k < 9 && !miss; k++) {
          const open = rules.claimable(g, 'red');
          const mine = g.marks.flatMap((m, i) => (m === 'red' ? [i] : []));
          const straight = mine.map((i) => i + 1).filter((i) => i % 5 !== 0 && open.includes(i));
          const side = mine.flatMap((i) => rules.neighbors(i)).filter((i) => open.includes(i));
          const cell = pick(straight.length ? straight : side.length ? side : open);
          if (key.has(cell)) g.marks[cell] = 'red'; else { g.marks[cell] = 'miss'; miss = true; }
        }
        if (rules.connected(g.marks, 'red')) break;
      }
      turns += t;
    }
    expect(ahead / aheadOf).toBeLessThan(0.7);
    expect(turns / N).toBeGreaterThan(5);
  });
});

describe('normalizeGame', () => {
  it('rebuilds what RTDB dropped', () => {
    const g = rules.normalizeGame({ board: { 0: board[0] }, teams: { red: ['a'] }, marks: { 3: 'red', 7: 'miss' } });
    expect(g.marks).toHaveLength(CELLS);
    expect(g.marks[3]).toBe('red');
    expect(g.marks[7]).toBe('miss');
    expect(g.marks[0]).toBe(null);
    expect(g.claimOrder).toEqual({ red: [], blue: [] });
    expect(g.teams.blue).toEqual([]);
    expect(g.planted).toEqual({ red: false, blue: false });
    expect(g.log).toEqual([]);
    expect(g.pending).toBe(null);
  });

  it('reads a sparse marks array without skipping holes', () => {
    const sparse = [];
    sparse[24] = 'blue';
    sparse[0] = 'red';
    const g = rules.normalizeGame({ marks: sparse });
    expect(g.marks[0]).toBe('red');
    expect(g.marks[24]).toBe('blue');
    expect(g.marks[12]).toBe(null);
  });
});
