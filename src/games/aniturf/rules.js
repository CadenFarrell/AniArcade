// AniTurf's whole game as pure functions: no React, no storage, no network.
// Both hooks (local useState, online RTDB) apply these patches, which is what
// keeps a claim, a scorch and a sprung trap meaning the same thing on one couch
// and across six phones.
//
// The board is 25 characters in a 5×5 grid, indexed row-major (i = row*5+col).
// Red crosses LEFT to RIGHT, Blue crosses TOP to BOTTOM, and squares connect
// orthogonally only. That pairing is the game: on a square grid with 4-way
// adjacency, any left-right route and any top-bottom route must share a square,
// so every board has crossroads both teams need and only one can hold.
//
// Each team's FOOTING is the secret: the squares it may stand on, known only to
// its clue-giver. A claim on footing sticks; anything else is scorched to
// rubble for both teams. Traps are the other team's secret: planted on squares
// the planter guesses the other team's route must cross.
//
// marks[i] is the public board, one of:
//   null     open
//   'red' / 'blue'  claimed
//   'miss'   scorched by a wrong claim — rubble, impassable to both
//   'trap'   scorched by a sprung trap — rubble too, marked apart so the table
//            can see where a trap was
import { characterNameKey } from '../../shared/utils/character';

export const SIZE = 5;
export const CELLS = SIZE * SIZE;
export const TEAMS = ['red', 'blue'];
export const TEAM_NAMES = { red: 'Red', blue: 'Blue' };
// Decoy squares on every key: footing that touches no square of the route, so
// a lone hit proves nothing about which way the route runs (see makeFooting).
export const DECOYS = 2;
export const MIN_TEAM = 2; // a clue-giver and at least one guesser
export const MIN_PLAYERS = MIN_TEAM * 2;
export const MAX_CLUE = 9;
export const MAX_TRAPS = 3;
export const MAX_CLUE_LENGTH = 24;

export const other = (team) => (team === 'red' ? 'blue' : 'red');
export const rowOf = (i) => Math.floor(i / SIZE);
export const colOf = (i) => i % SIZE;
const at = (r, c) => r * SIZE + c;
const ALL = Array.from({ length: CELLS }, (_, i) => i);

export function neighbors(i) {
  const r = rowOf(i);
  const c = colOf(i);
  const out = [];
  if (r > 0) out.push(at(r - 1, c));
  if (r < SIZE - 1) out.push(at(r + 1, c));
  if (c > 0) out.push(at(r, c - 1));
  if (c < SIZE - 1) out.push(at(r, c + 1));
  return out;
}

// A team's two goal edges. Either one is a place to start: a route is just a
// connected run touching both, and forcing every team to grow from one fixed
// side would make half the board's first claims pointless.
const startEdge = (team, i) => (team === 'red' ? colOf(i) === 0 : rowOf(i) === 0);
const endEdge = (team, i) => (team === 'red' ? colOf(i) === SIZE - 1 : rowOf(i) === SIZE - 1);
export const onEdge = (team, i) => startEdge(team, i) || endEdge(team, i);

// --- routes -----------------------------------------------------------------

/**
 * How many routes across the board, sharing no square, run through `cells` (a
 * Set or array of indices) for `team` — counted up to `cap`, since nothing
 * asks past two. Max-flow with each square split into an in and an out of
 * capacity one, which is Menger's theorem doing the work: two square-disjoint
 * routes exist exactly when no single square cuts every route.
 */
export function routeCount(cells, team, cap = 2) {
  const open = cells instanceof Set ? cells : new Set(cells);
  // Node ids: square i is in = 2i, out = 2i+1; source and sink after them.
  const S = CELLS * 2;
  const T = S + 1;
  const cap2 = new Map(); // "u,v" -> residual capacity
  const adj = Array.from({ length: T + 1 }, () => []);
  // Every edge here joins a distinct ordered pair (in→out within a square,
  // out→in between squares, source→in, out→sink), so its reverse is only ever
  // the residual, which starts empty.
  const edge = (u, v) => {
    adj[u].push(v);
    adj[v].push(u);
    cap2.set(`${u},${v}`, 1);
    cap2.set(`${v},${u}`, 0);
  };
  for (const i of open) {
    edge(2 * i, 2 * i + 1);
    if (startEdge(team, i)) edge(S, 2 * i);
    if (endEdge(team, i)) edge(2 * i + 1, T);
    for (const n of neighbors(i)) if (open.has(n)) edge(2 * i + 1, 2 * n);
  }
  let flow = 0;
  while (flow < cap) {
    const prev = new Map([[S, S]]);
    const queue = [S];
    while (queue.length && !prev.has(T)) {
      const u = queue.shift();
      for (const v of adj[u]) {
        if (!prev.has(v) && (cap2.get(`${u},${v}`) ?? 0) > 0) { prev.set(v, u); queue.push(v); }
      }
    }
    if (!prev.has(T)) break;
    for (let v = T; v !== S; v = prev.get(v)) {
      const u = prev.get(v);
      cap2.set(`${u},${v}`, cap2.get(`${u},${v}`) - 1);
      cap2.set(`${v},${u}`, (cap2.get(`${v},${u}`) ?? 0) + 1);
    }
    flow += 1;
  }
  return flow;
}

/** Whether `team`'s claims already join its two edges — the win. */
export function connected(marks, team) {
  return routeCount(ALL.filter((i) => marks[i] === team), team, 1) >= 1;
}

/**
 * Whether `team` can still win: a route across through its footing that
 * nothing has blocked — every square on it is footing, and is open or already
 * the team's own. Only the device holding the footing can ask this, which is
 * why online the clue-giver's device is the one that reroutes its own team or
 * declares it cut.
 */
export function routeAlive(footing, marks, team) {
  const usable = (footing ?? []).filter((i) => marks[i] == null || marks[i] === team);
  return routeCount(usable, team, 1) >= 1;
}

// --- dealing a key ----------------------------------------------------------

const pickFrom = (list, rng) => list[Math.floor(rng() * list.length)];

// The most squares a route runs straight before it must bend. Two: a key's
// straight runs were what made the game guessable without clues (makeFooting).
const MAX_RUN = 2;

// One winding route across, left to right: a start row, then a step right per
// column, bending up or down one or two rows before a step about half the time
// and always after MAX_RUN straight steps. Never in the first column, where a
// bend would only move the start.
function walk(rng) {
  let r = Math.floor(rng() * SIZE);
  const cells = [at(r, 0)];
  let run = 0;
  for (let c = 0; c < SIZE - 1; c++) {
    if (c > 0 && (run >= MAX_RUN || rng() < 0.5)) {
      const d = pickFrom([-2, -1, 1, 2].filter((m) => r + m >= 0 && r + m < SIZE), rng);
      for (let k = 1; k <= Math.abs(d); k++) cells.push(at(r + Math.sign(d) * k, c));
      r += d;
      run = 0;
    }
    cells.push(at(r, c + 1));
    run += 1;
  }
  return cells;
}

// Blue's board is Red's turned on its diagonal: generating left-to-right and
// transposing keeps one generator for both teams.
const transpose = (i) => at(colOf(i), rowOf(i));

// DECOYS open squares, each touching nothing else on the key — the route or
// another decoy, since two decoys side by side read as a stub of route.
function addDecoys(set, marks, rng) {
  for (let k = 0; k < DECOYS; k++) {
    const spare = ALL.filter((i) => marks[i] == null && !set.has(i) && !neighbors(i).some((n) => set.has(n)));
    if (!spare.length) break;
    set.add(spare[Math.floor(rng() * spare.length)]);
  }
  return set;
}

/**
 * A team's secret footing: one winding route across, plus DECOYS squares that
 * lead nowhere.
 *
 * It used to be two near-straight routes with no square in common, filled to
 * twelve squares, and that made the key guessable without hearing a clue: with
 * half the board footing and the routes running straight, the square straight
 * ahead of a footing square was footing 81% of the time, and a team pushing in
 * a straight line crossed in about 3 turns. One winding route plus decoys
 * measured 6.9 turns for the same clue-blind push; rules.test.js's
 * 'guessability' block pins the property.
 *
 * Two routes were there to stop a crossroads being a coin toss — with one route
 * each, whoever took the first shared square cut the other team off. A cut team
 * now gets a detour instead (rerouteFooting), so losing a crossroads costs time
 * rather than the game.
 */
export function makeFooting(team, rng = Math.random) {
  // A bend that doubles back can still fill a whole row (across, down, across,
  // up, across) — a straight line by another name, so it is dealt again.
  let route = walk(rng);
  const fullRow = (cells) => Array.from({ length: SIZE }, (_, r) => r)
    .some((r) => ALL.slice(r * SIZE, (r + 1) * SIZE).every((i) => cells.includes(i)));
  for (let attempt = 0; attempt < 50 && fullRow(route); attempt++) route = walk(rng);
  const cells = [...addDecoys(new Set(route), Array(CELLS).fill(null), rng)];
  return (team === 'red' ? cells : cells.map(transpose)).sort((x, y) => x - y);
}

// The cheapest route across for `team` through squares `usable(i)` allows. A
// square in `free` (the team's own claims, squares already on its key) costs
// nothing and any other open square one plus a little jitter, so a new route
// reuses what the team holds and knows, by a way nobody could predict.
function cheapestRoute(team, usable, rng, free) {
  const cost = ALL.map((i) => (free.has(i) ? 0 : 1 + rng() * 0.5));
  const dist = new Map();
  const prev = new Map();
  const done = new Set();
  for (const i of ALL) if (usable(i) && startEdge(team, i)) dist.set(i, cost[i]);
  while (true) {
    let u = null;
    for (const [i, d] of dist) if (!done.has(i) && (u == null || d < dist.get(u))) u = i;
    if (u == null) return null;
    if (endEdge(team, u)) {
      const path = [u];
      while (prev.has(path[0])) path.unshift(prev.get(path[0]));
      return path;
    }
    done.add(u);
    for (const n of neighbors(u)) {
      if (!usable(n) || done.has(n)) continue;
      const d = dist.get(u) + cost[n];
      if (!dist.has(n) || d < dist.get(n)) { dist.set(n, d); prev.set(n, u); }
    }
  }
}

/**
 * A detour for a team whose route has just been cut: its key so far (`keep`)
 * plus the cheapest route across through squares still open, reusing the
 * team's claims and existing footing wherever it can. Nothing on the key is
 * taken away — a clue already given may point at a square still there — so a
 * detour only ever adds squares. Null when no route across exists at all: then
 * the team really is cut off, and loses.
 *
 * Run by whoever holds the key: the one device locally, the team's clue-giver's
 * own phone online. It never touches the room — the key changes in secrets/,
 * and the clue-giver is told on their next clue screen.
 */
export function rerouteFooting(game, team, keep = [], rng = Math.random) {
  const { marks } = game;
  const open = (i) => marks[i] == null || marks[i] === team;
  const set = new Set([...(game.claimOrder?.[team] ?? []), ...keep]);
  const path = cheapestRoute(team, open, rng, new Set([...set].filter(open)));
  if (!path) return null;
  path.forEach((i) => set.add(i));
  return [...set].sort((x, y) => x - y);
}

/**
 * The detour notice a clue-giver should see: the squares just added, plus any
 * an earlier detour added that they have not been shown yet (one since their
 * team's last clue). `at` is the log length when it happened.
 */
export function nextDetour(game, team, prev, added) {
  const lastClue = game.log.findLastIndex((e) => e.kind === 'clue' && e.team === team);
  const unseen = prev && prev.at - 1 > lastClue ? prev.squares : [];
  return { squares: [...new Set([...unseen, ...added])], at: game.log.length };
}

/**
 * A replacement key for a team whose clue-giver left mid-game, made on the new
 * clue-giver's device. The old key is gone with the old device (secrets/ is
 * read-gated to its owner), so this deals one that agrees with everything the
 * table has SEEN — every square the team claimed is footing, nothing it
 * scorched is — as a route through open squares plus fresh decoys. A team the
 * board has already cut off gets only its claims; routeAlive says so on the
 * next check, and the team loses.
 */
export function rebuildFooting(game, team, rng = Math.random) {
  const route = rerouteFooting(game, team, [], rng);
  if (!route) return [...(game.claimOrder?.[team] ?? [])].sort((x, y) => x - y);
  return [...addDecoys(new Set(route), game.marks, rng)].sort((x, y) => x - y);
}

// --- teams ------------------------------------------------------------------

/**
 * The teams from the seat order plus whatever each player chose. A player who
 * has not chosen joins the smaller side so far, so a table that never touches
 * the teams card is split evenly in seat order — and adding a player never
 * reshuffles anyone seated before them.
 */
export function splitTeams(ids, chosen = {}) {
  const teams = { red: [], blue: [] };
  for (const id of ids) {
    const pick = chosen?.[id] === 'red' || chosen?.[id] === 'blue'
      ? chosen[id]
      : (teams.red.length <= teams.blue.length ? 'red' : 'blue');
    teams[pick].push(id);
  }
  return teams;
}

/** Seats alternate Red, Blue, Red… — the setup screen's starting split. */
export function assignTeams(ids) {
  return {
    red: ids.filter((_, i) => i % 2 === 0),
    blue: ids.filter((_, i) => i % 2 === 1),
  };
}

export function teamOf(game, id) {
  if (game?.teams?.red?.includes(id)) return 'red';
  if (game?.teams?.blue?.includes(id)) return 'blue';
  return null;
}

/** Whether a split can start: two a side, so each team has a guesser. */
export function teamsReady(teams) {
  for (const team of TEAMS) {
    if ((teams?.[team]?.length ?? 0) < MIN_TEAM) {
      return { ok: false, reason: `${TEAM_NAMES[team]} needs ${MIN_TEAM} players.` };
    }
  }
  return { ok: true, reason: null };
}

/**
 * The clue-giver each team plays with: the chosen one when they are still on
 * the team, else its first seat. A chosen giver who moved teams must not stay
 * the other side's giver.
 */
export function resolveGivers(teams, chosen = {}) {
  const out = {};
  for (const team of TEAMS) {
    const ids = teams?.[team] ?? [];
    out[team] = ids.includes(chosen?.[team]) ? chosen[team] : (ids[0] ?? null);
  }
  return out;
}

/** Play again: the role moves to the next seat on each team. */
export function rotateGivers(teams, givers) {
  const out = {};
  for (const team of TEAMS) {
    const ids = teams?.[team] ?? [];
    const at0 = ids.indexOf(givers?.[team]);
    out[team] = ids.length ? ids[(at0 + 1) % ids.length] : null;
  }
  return out;
}

/** Who moves first: a coin flip, seeded by whatever `rng` the caller has. */
export const pickStartTeam = (rng = Math.random) => TEAMS[Math.floor(rng() * TEAMS.length)];

/** How many traps a team plants: the setting, plus one for moving second. */
export function trapsFor(traps, team, startTeam) {
  if (!traps) return 0;
  return traps + (team === startTeam ? 0 : 1);
}

// --- clues ------------------------------------------------------------------

/**
 * Whether a clue is one word and not a name on the board. A clue that IS a
 * character's name ("Levi: 1") is the one move that needs no skill, and the
 * table should not have to police it — so any word of any board name, folded
 * the way character names fold, is refused with the reason.
 */
export function validClue(word, board = []) {
  const w = String(word ?? '').trim();
  if (!w) return { ok: false, reason: 'Type a one-word clue.' };
  if (/\s/.test(w)) return { ok: false, reason: 'One word only.' };
  if (w.length > MAX_CLUE_LENGTH) return { ok: false, reason: 'That clue is too long.' };
  const key = characterNameKey(w).replace(/[^\p{L}\p{N}]/gu, '');
  if (!key) return { ok: false, reason: 'Type a one-word clue.' };
  for (const ch of board) {
    const words = characterNameKey(ch?.name ?? '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (words.includes(key) || words.join('') === key) {
      return { ok: false, reason: `“${w}” is part of ${ch.name}'s name.` };
    }
  }
  return { ok: true, reason: null };
}

// --- the game ---------------------------------------------------------------

const emptyMarks = () => Array(CELLS).fill(null);

/**
 * A new game. `teams` and `clueGivers` are settled by the setup screen;
 * `startTeam` is the caller's coin flip, so a seeded run replays.
 */
export function startGame({ board, teams, clueGivers, startTeam = 'red', traps = 2, round = 1 }) {
  return {
    board,
    teams: { red: [...teams.red], blue: [...teams.blue] },
    clueGivers: { ...clueGivers },
    startTeam,
    turn: startTeam,
    phase: 'plant', // plant | clue | guess | over
    traps,
    marks: emptyMarks(),
    claimOrder: { red: [], blue: [] },
    planted: { red: false, blue: false },
    clue: null,
    claimsLeft: 0,
    claimsMade: 0,
    log: [],
    winner: null,
    winBy: null, // connect | cut | forfeit
    loser: null,
    round,
    // Bumped when a team's clue-giver changes hands, so the key the old one held
    // (still sitting in secrets/) stops matching — the stamp, never a clear.
    keyStamp: { red: 1, blue: 1 },
    pending: null,
    seq: 0,
  };
}

/** A clue-giver has read the key and planted their traps. */
export function plant(game, team) {
  if (game.phase !== 'plant' || game.planted[team]) return { patch: {} };
  const planted = { ...game.planted, [team]: true };
  return {
    patch: {
      planted,
      ...(planted.red && planted.blue ? { phase: 'clue' } : {}),
    },
  };
}

export function giveClue(game, team, word, number, by = null) {
  if (game.phase !== 'clue' || game.turn !== team) return { patch: {} };
  if (!validClue(word, game.board).ok) return { patch: {} };
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1 || n > MAX_CLUE) return { patch: {} };
  const clue = { team, word: String(word).trim(), number: n, by: by ?? null };
  return {
    patch: {
      phase: 'guess',
      clue,
      claimsLeft: n,
      claimsMade: 0,
      log: [...game.log, { kind: 'clue', ...clue }],
    },
  };
}

/** Whether `team` may claim square `i` right now. */
export function canClaim(game, team, i) {
  const { marks } = game;
  if (marks[i] != null) return false;
  return onEdge(team, i) || neighbors(i).some((n) => marks[n] === team);
}

export const claimable = (game, team) => ALL.filter((i) => canClaim(game, team, i));

/**
 * Online only: a guesser asks to claim a square. Nobody on the guesser's side
 * of the network knows whether it is footing, so the claim waits in `pending`
 * for the two devices that do — see useAniTurfRoom. One at a time, which is
 * what stops two teammates' taps racing each other into two resolutions.
 */
export function requestClaim(game, team, cell, by) {
  if (game.phase !== 'guess' || game.turn !== team || game.pending) return { patch: {} };
  if (game.claimsLeft < 1 || !canClaim(game, team, cell)) return { patch: {} };
  const seq = game.seq + 1;
  return { patch: { seq, pending: { cell, team, by: by ?? null, seq, footing: false } } };
}

/** Online only: the active clue-giver's device confirms the square is footing. */
export function markFooting(game, seq) {
  const p = game.pending;
  if (!p || p.seq !== seq || p.footing) return { patch: {} };
  return { patch: { pending: { ...p, footing: true } } };
}

const endTurn = (game, team) => ({
  turn: other(team),
  phase: 'clue',
  clue: null,
  claimsLeft: 0,
  claimsMade: 0,
  pending: null,
});

/**
 * A claim lands. `footing` and `trapped` are the two secret answers — whether
 * the square is the claiming team's footing, and whether the other team trapped
 * it — supplied by whoever holds them (the one device locally; two different
 * devices online).
 *
 *   footing, not trapped → claimed; play on while the clue allows
 *   footing, trapped     → scorched, the team's NEWEST claim is taken back,
 *                          turn over
 *   not footing          → scorched for both teams, turn over
 *
 * A trap fires only on footing because a square that is not footing ends the
 * turn anyway — so a trap is a bet on where the other team's route must run.
 */
export function resolveClaim(game, { cell, footing, trapped = false, by = null }) {
  const team = game.turn;
  if (game.phase !== 'guess' || !canClaim(game, team, cell)) return { patch: {}, outcome: null };
  const marks = [...game.marks];
  const claimOrder = { red: [...game.claimOrder.red], blue: [...game.claimOrder.blue] };
  let outcome;
  let undone = null;
  if (!footing) {
    marks[cell] = 'miss';
    outcome = 'miss';
  } else if (trapped) {
    marks[cell] = 'trap';
    outcome = 'trap';
    undone = claimOrder[team].pop() ?? null;
    if (undone != null) marks[undone] = null;
  } else {
    marks[cell] = team;
    claimOrder[team].push(cell);
    outcome = 'claim';
  }
  const base = {
    marks,
    claimOrder,
    pending: null,
    log: [...game.log, { kind: outcome, team, cell, by: by ?? null, undone }],
  };

  if (outcome !== 'claim') return { patch: { ...base, ...endTurn(game, team) }, outcome };
  if (connected(marks, team)) {
    return {
      patch: { ...base, phase: 'over', winner: team, loser: other(team), winBy: 'connect', claimsLeft: 0 },
      outcome,
    };
  }
  const claimsLeft = game.claimsLeft - 1;
  if (claimsLeft <= 0) return { patch: { ...base, ...endTurn(game, team) }, outcome };
  return { patch: { ...base, claimsLeft, claimsMade: game.claimsMade + 1 }, outcome };
}

/**
 * The guessers stop. After at least one claim, as a clue is worth at least
 * one — unless there is nothing left they could claim, when stopping is the
 * only move there is.
 */
export function canStop(game, team) {
  if (game.phase !== 'guess' || game.turn !== team || game.pending) return false;
  return game.claimsMade > 0 || claimable(game, team).length === 0;
}

export function stopGuessing(game, team) {
  if (!canStop(game, team)) return { patch: {} };
  return { patch: { ...endTurn(game, team), log: [...game.log, { kind: 'stop', team }] } };
}

/**
 * A team can no longer cross at all — not even by a detour (rerouteFooting
 * found none): it loses on the spot. A single move only ever cuts one team off
 * — a claim or a scorch hurts the other side, a sprung trap hurts the mover —
 * so there is never a board where both are cut at once, and a team with no
 * route left could never win by playing on.
 */
export function declareCut(game, team) {
  if (game.phase === 'over') return { patch: {} };
  return { patch: { phase: 'over', winner: other(team), loser: team, winBy: 'cut', pending: null } };
}

export function forfeit(game, team) {
  if (game.phase === 'over') return { patch: {} };
  return { patch: { phase: 'over', winner: other(team), loser: team, winBy: 'forfeit', pending: null } };
}

/** Who on `team` is still here to guess — everyone present but its clue-giver. */
export function guessersLeft(game, team, activeIds) {
  return (game.teams[team] ?? []).filter((id) => activeIds.includes(id) && id !== game.clueGivers[team]);
}

/**
 * Online only: a team's clue-giver has gone for good. The next teammate still
 * here takes the role, the team's key stamp moves on (their device deals a new
 * key that agrees with the board — rebuildFooting), and the traps the old giver
 * planted go with them: they lived on a device that is no longer in the room.
 * A team left with nobody to guess forfeits instead.
 */
export function promoteGiver(game, team, activeIds) {
  if (game.phase === 'over') return { patch: {} };
  const from = game.clueGivers[team];
  const heir = (game.teams[team] ?? []).find((id) => id !== from && activeIds.includes(id));
  const guessers = (game.teams[team] ?? []).filter((id) => id !== from && id !== heir && activeIds.includes(id));
  if (!heir || !guessers.length) return forfeit(game, team);
  return {
    patch: {
      clueGivers: { ...game.clueGivers, [team]: heir },
      keyStamp: { ...game.keyStamp, [team]: (game.keyStamp[team] ?? 1) + 1 },
      ...(game.phase === 'plant' ? { planted: { ...game.planted, [team]: false } } : {}),
      // Whether traps went with the old giver: only once they were planted —
      // an heir crowned during planting plants their own.
      log: [...game.log, {
        kind: 'migrate', team, from, to: heir,
        trapsLost: game.phase !== 'plant' && trapsFor(game.traps, team, game.startTeam) > 0,
      }],
    },
  };
}

/**
 * Once the game is over a key is a secret no more: each team's clue-giver
 * publishes theirs — footing and the traps they planted — so the results can
 * show where both routes really ran. Online only the owner can (secrets/ is
 * read-gated), so each publishes its own, AniFake's publishCard pattern; a
 * team whose clue-giver has gone simply stays unrevealed.
 */
export function publishKey(game, team, { footing, traps = [] }) {
  if (game.phase !== 'over' || game.reveal?.[team]) return { patch: {} };
  return { patch: { reveal: { ...(game.reveal ?? {}), [team]: { footing: [...footing], traps: [...traps] } } } };
}

/** Banks a finished game: every player on the winning team scores a win. */
export function applyWin(totals, game) {
  const next = { ...totals };
  if (!game?.winner) return next;
  for (const id of game.teams[game.winner] ?? []) next[id] = (next[id] ?? 0) + 1;
  return next;
}

// --- RTDB repair ------------------------------------------------------------

function toArray(raw) {
  if (Array.isArray(raw)) return raw.filter((x) => x != null);
  if (!raw || typeof raw !== 'object') return [];
  return Object.keys(raw)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => raw[k])
    .filter((x) => x != null);
}

/**
 * The 25 marks from whatever RTDB hands back. A board with gaps comes back in
 * one of three shapes — dense, sparse (holes where nulls were), or an object
 * keyed by index once it is mostly empty — and an all-open board not at all.
 * A plain index loop, never .map, because map skips holes. Same repair as
 * anirank/rules.js's normalizeBoard.
 */
export function normalizeMarks(raw) {
  const out = emptyMarks();
  if (!raw || typeof raw !== 'object') return out;
  for (let i = 0; i < CELLS; i++) {
    const v = raw[i] ?? raw[String(i)];
    out[i] = v == null ? null : v;
  }
  return out;
}

/** Repairs a stored game at every point it enters a hook. */
export function normalizeGame(raw) {
  if (!raw) return null;
  return {
    ...raw,
    board: toArray(raw.board),
    teams: { red: toArray(raw.teams?.red), blue: toArray(raw.teams?.blue) },
    clueGivers: { red: raw.clueGivers?.red ?? null, blue: raw.clueGivers?.blue ?? null },
    marks: normalizeMarks(raw.marks),
    claimOrder: { red: toArray(raw.claimOrder?.red), blue: toArray(raw.claimOrder?.blue) },
    planted: { red: Boolean(raw.planted?.red), blue: Boolean(raw.planted?.blue) },
    keyStamp: { red: raw.keyStamp?.red ?? 1, blue: raw.keyStamp?.blue ?? 1 },
    clue: raw.clue ?? null,
    claimsLeft: raw.claimsLeft ?? 0,
    claimsMade: raw.claimsMade ?? 0,
    traps: raw.traps ?? 0,
    log: toArray(raw.log),
    winner: raw.winner ?? null,
    winBy: raw.winBy ?? null,
    loser: raw.loser ?? null,
    pending: raw.pending ? { ...raw.pending, footing: Boolean(raw.pending.footing) } : null,
    reveal: raw.reveal ? Object.fromEntries(TEAMS.filter((t) => raw.reveal[t]).map((t) => [t, {
      footing: toArray(raw.reveal[t].footing),
      traps: toArray(raw.reveal[t].traps),
    }])) : null,
    seq: raw.seq ?? 0,
  };
}
