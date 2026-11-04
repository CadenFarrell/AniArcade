import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { assignShards, lastCosts, parseShard, shardGames } from './shard.js';

const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const games = IDS.map((id) => ({ id }));

describe('parseShard', () => {
  it('reads i/N and refuses anything out of range', () => {
    expect(parseShard('2/3')).toEqual({ index: 1, count: 3 });
    expect(parseShard('0/3')).toBeNull();
    expect(parseShard('4/3')).toBeNull();
    expect(parseShard('')).toBeNull();
    expect(parseShard(undefined)).toBeNull();
  });
});

describe('assignShards', () => {
  it('puts every game in exactly one shard', () => {
    for (const n of [1, 2, 3, 5, 9]) {
      const parts = Array.from({ length: n }, (_, i) => shardGames(games, 'x', `${i + 1}/${n}`).map((g) => g.id));
      expect(parts.flat().sort()).toEqual(IDS);
    }
  });

  it('balances by cost, longest first', () => {
    const shardOf = assignShards(IDS, { a: 100, b: 10, c: 10, d: 10, e: 10, f: 10, g: 10 }, 2);
    // The one long game alone; the six short ones together.
    expect(IDS.filter((id) => shardOf[id] === shardOf.a)).toEqual(['a']);
  });

  it('treats a game with no known cost as typical', () => {
    const shardOf = assignShards(['a', 'b', 'new'], { a: 50, b: 50 }, 2);
    expect(new Set(Object.values(shardOf)).size).toBe(2);
    expect(shardOf.new).toBeDefined();
  });

  it('comes out the same every time', () => {
    const w = { a: 3, b: 3, c: 3, d: 1 };
    expect(assignShards(IDS, w, 3)).toEqual(assignShards(IDS, w, 3));
  });
});

describe('lastCosts', () => {
  it('averages a game\'s runs and skips what is missing or broken', () => {
    const dir = mkdtempSync(`${tmpdir()}/shard-`);
    mkdirSync(`${dir}/online`);
    writeFileSync(`${dir}/online/a.json`, JSON.stringify({ runs: [{ ms: 100 }, { ms: 300 }] }));
    writeFileSync(`${dir}/online/b.json`, '{ half-written');
    expect(lastCosts('online', ['a', 'b', 'c'], dir)).toEqual({ a: 200 });
  });
});
