// Splits one playtest layer's games across parallel processes.
//
// `npm run playtest` used to play every game in ONE vitest process, one after
// another: ~36 minutes of real time online (2026-11-04), and one heap holding
// everything every run left behind until it ran out. run.js now starts N
// processes, each with PLAYTEST_SHARD="i/N", and each process plays only the
// games this file hands it. Separate processes rather than vitest workers
// because the layer is one test file (each run owns the whole document), and
// vitest parallelises files, not the tests inside one.
//
// Every shard computes the split independently, so it must come out the same
// in all of them: it reads only the registry order and the report on disk,
// and run.js does not write the report until every shard has finished. Every
// registered game lands in exactly one shard — including one with no
// strategy, which then fails there on purpose, as it would unsharded.
import { existsSync, readFileSync } from 'node:fs';
import { REPORT_DIR } from '../report.js';

// "2/3" → { index: 1, count: 3 }; null for anything else (no sharding).
export function parseShard(spec) {
  const m = /^(\d+)\/(\d+)$/.exec(String(spec ?? '').trim());
  if (!m) return null;
  const index = Number(m[1]) - 1;
  const count = Number(m[2]);
  return count >= 1 && index >= 0 && index < count ? { index, count } : null;
}

// Longest first, each onto the least-loaded shard (LPT): close to the best
// split for a dozen jobs, and deterministic — ties go to registry order and
// the lowest shard. A game with no known cost is assumed typical (the median),
// and with no report at all every game costs the same, which is a plain
// round-robin.
export function assignShards(ids, weights, count) {
  const known = ids.map((id) => weights[id]).filter((w) => w > 0).sort((a, b) => a - b);
  const typical = known.length ? known[Math.floor(known.length / 2)] : 1;
  const cost = (id) => (weights[id] > 0 ? weights[id] : typical);
  const order = ids.map((id, i) => ({ id, i, w: cost(id) })).sort((a, b) => b.w - a.w || a.i - b.i);
  const loads = Array.from({ length: count }, () => 0);
  const shardOf = {};
  for (const { id, w } of order) {
    let best = 0;
    for (let s = 1; s < count; s++) if (loads[s] < loads[best]) best = s;
    shardOf[id] = best;
    loads[best] += w;
  }
  return shardOf;
}

// A game's cost is its last sweep's mean run length on this layer, from
// playtest-report/<layer>/<game>.json. Mean rather than total: a one-seed
// replay appends to the file, and a total would then rank a game by how often
// it had been debugged.
export function lastCosts(layer, ids, dir = REPORT_DIR) {
  const out = {};
  for (const id of ids) {
    const file = `${dir}/${layer}/${id}.json`;
    if (!existsSync(file)) continue;
    try {
      const runs = JSON.parse(readFileSync(file, 'utf8')).runs ?? [];
      const ms = runs.map((r) => r.ms).filter((x) => x > 0);
      if (ms.length) out[id] = ms.reduce((a, b) => a + b, 0) / ms.length;
    } catch { /* a half-written report: treat the game as typical */ }
  }
  return out;
}

// The games this process plays: all of them, unless PLAYTEST_SHARD says which
// slice. Kept in registry order within the slice.
export function shardGames(games, layer, spec = process.env.PLAYTEST_SHARD) {
  const shard = parseShard(spec);
  if (!shard || shard.count === 1) return games;
  const ids = games.map((g) => g.id);
  const shardOf = assignShards(ids, lastCosts(layer, ids), shard.count);
  return games.filter((g) => shardOf[g.id] === shard.index);
}

// The heap after a run, in MB, recorded on the run so a slice whose memory
// keeps climbing shows in the report rather than only as a crash.
export const heapMB = () => Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
