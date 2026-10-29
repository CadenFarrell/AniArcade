// AniDraft's rules: pure functions over the game state, no React, no storage,
// no network. Each move returns `{ patch }`; an empty patch means "refused",
// which the online hook relies on to abort its transaction.
//
// Every player is a team. A round deals five roles (Captain, Final Boss, …)
// and one shared board of characters from the table's lists; the table
// snake-drafts the board, each pick going into one of the picker's open role
// slots. Then everyone votes, role by role, for the best pick in that role —
// never their own — and each role's most-voted team scores a point.
//
//   game: { rounds, pool, pickClock, order, scores, votesWon, round, phase,
//           roles, shuffles, board, picks, pickAt, ballots, shown, used, log }
//
//   phase: 'draft' → 'vote' → 'reveal' → (next round: 'draft' …) → 'finished'
//
// **Nothing here is hidden.** The board, every pick and every team are the
// table's to see, which is what lets one phone in the middle play the draft.
// Ballots sit in the game too (online in `state/`, as AniFake's votes do):
// screens show who has voted, never what, until the vote closes. A player who
// reads the room's raw data mid-vote learns how others voted on teams they
// cannot change by then — there is nothing left to protect.
//
// **The board is dealt outside.** Drawing it needs the players' lists, so the
// caller deals (deal.js) and hands the cards in: startGame and nextRound take
// a board, reshuffleRoles takes the new roles. The rules only check them.
//
// **Time.** Nothing here reads a clock. The online pick clock is `pickAt` (when
// the current pick began, server time) plus `pickClock` seconds; locally the
// clock is off and `now` is null.

export const MIN_PLAYERS = 3;
// Eight teams of five is a 60-card board — already a long scroll on a phone —
// and an eight-way ballot per role.
export const MAX_PLAYERS = 8;
export const ROLES_PER_ROUND = 5;
/**
 * How much bigger the board is than the picks it has to cover. At 1.0 the
 * last picker takes whatever is left; at 1.5 there is still a choice at the
 * end, and a card someone was saving can still be sniped.
 */
export const BOARD_FACTOR = 1.5;

export const picksPerRound = (teams) => teams * ROLES_PER_ROUND;
export const boardSize = (teams) => Math.ceil(BOARD_FACTOR * picksPerRound(teams));

const changed = (game, next) => {
  const patch = {};
  for (const [k, v] of Object.entries(next)) if (game[k] !== v) patch[k] = v;
  return { patch };
};

// ── The draft ────────────────────────────────────────────────────────────

/**
 * The round's picking order, one entry per pick: a snake over the seats,
 * forward then back, ROLES_PER_ROUND laps. The first seat moves one place a
 * round, so the first pick — and the last, which follows it in reverse — goes
 * round the table.
 */
export function pickOrder(order, round) {
  const n = order.length;
  if (!n) return [];
  const start = round % n;
  const seats = [...order.slice(start), ...order.slice(0, start)];
  const seq = [];
  for (let lap = 0; lap < ROLES_PER_ROUND; lap++) seq.push(...(lap % 2 === 0 ? seats : [...seats].reverse()));
  return seq;
}

/** Whose pick it is, or null outside the draft. */
export const currentPicker = (game) => (game.phase === 'draft'
  ? pickOrder(game.order, game.round)[game.picks.length] ?? null
  : null);

/** Which pick of the round this is, 1-based, and how many there are. */
export const pickNo = (game) => ({ n: game.picks.length + 1, of: picksPerRound(game.order.length) });

const cardOf = (game, key) => game.board.find((c) => c.key === key) ?? null;

/** Who took each board card so far: key → player id. */
export function takenBy(game) {
  return new Map(game.picks.map((p) => [p.card, p.by]));
}

/** A player's five role slots, in role order: the card drafted into each, or null. */
export function teamSlots(game, id) {
  const slots = Array(ROLES_PER_ROUND).fill(null);
  for (const p of game.picks) if (p.by === id && p.slot >= 0 && p.slot < ROLES_PER_ROUND) slots[p.slot] = cardOf(game, p.card);
  return slots;
}

/** The slot indexes a player still has to fill. */
export const openSlots = (game, id) => teamSlots(game, id).flatMap((c, i) => (c ? [] : [i]));

/** When the current pick's clock runs out, or null when there is none. */
export const pickEndsAt = (game) => (game.phase === 'draft' && game.pickClock > 0 && game.pickAt != null
  ? game.pickAt + game.pickClock * 1000 : null);

function roundStart(round, board, roles, now) {
  return {
    round,
    phase: 'draft',
    roles,
    shuffles: 0,
    board,
    picks: [],
    pickAt: now,
    ballots: {},
    shown: 0,
  };
}

const validBoard = (board, teams) => Array.isArray(board) && board.length >= picksPerRound(teams);

/**
 * A new game. `board` and `roles` are the first round's, dealt by the caller;
 * `now` starts the first pick's clock (null locally).
 */
export function startGame({ ids, rounds = 3, pool = 'main', pickClock = 0, board, roles, now = null }) {
  const zero = Object.fromEntries(ids.map((id) => [id, 0]));
  const game = {
    rounds,
    pool,
    pickClock,
    order: ids,
    scores: zero,
    votesWon: { ...zero },
    log: [],
    used: (board ?? []).map((c) => c.key),
    ...roundStart(0, board ?? [], roles ?? [], now),
  };
  return validBoard(board, ids.length) ? game : { ...game, phase: 'finished' };
}

/** New roles for the round — only before anyone has picked, so no pick was made for a role that vanished. */
export function reshuffleRoles(game, roles) {
  if (game.phase !== 'draft' || game.picks.length > 0) return { patch: {} };
  if (!Array.isArray(roles) || roles.length !== ROLES_PER_ROUND) return { patch: {} };
  return { patch: { roles, shuffles: game.shuffles + 1 } };
}

function withPick(game, pick, now) {
  const picks = [...game.picks, pick];
  const done = picks.length >= pickOrder(game.order, game.round).length;
  return { patch: { picks, pickAt: done ? null : now, phase: done ? 'vote' : 'draft' } };
}

/**
 * `by` drafts board card `card` into their role slot `slot`. Refused when it
 * is not their pick, the card is gone (or was never on the board) or the slot
 * is already filled.
 */
export function makePick(game, by, card, slot, { now = null } = {}) {
  if (game.phase !== 'draft' || currentPicker(game) !== by) return { patch: {} };
  if (!cardOf(game, card) || takenBy(game).has(card)) return { patch: {} };
  if (!Number.isInteger(slot) || !openSlots(game, by).includes(slot)) return { patch: {} };
  return withPick(game, { by, card, slot, auto: false }, now);
}

/**
 * A pick made for the picker: the first card left on the board into their
 * first open slot. Only for a reason — the picker has gone (not in
 * `activeIds`) or their clock has run out at `now` — so a device racing a
 * slow picker cannot pick over them. `forPick` pins it to one pick: a second
 * device's auto-pick for the same moment aborts instead of taking the next
 * player's go.
 *
 * Deterministic rather than random, so a transaction that reruns picks the
 * same card. The board is dealt in random order, so "first" is no better a
 * card than any other.
 */
export function autoPick(game, { now = null, activeIds = null, forPick = null } = {}) {
  if (game.phase !== 'draft') return { patch: {} };
  if (forPick != null && game.picks.length !== forPick) return { patch: {} };
  const by = currentPicker(game);
  if (!by) return { patch: {} };
  const gone = Boolean(activeIds) && !activeIds.includes(by);
  const ends = pickEndsAt(game);
  const late = now != null && ends != null && now >= ends;
  if (!gone && !late) return { patch: {} };
  const taken = takenBy(game);
  const card = game.board.find((c) => !taken.has(c.key));
  const slot = openSlots(game, by)[0];
  if (!card || slot == null) return { patch: {} };
  return withPick(game, { by, card: card.key, slot, auto: true }, now);
}

// ── The vote ─────────────────────────────────────────────────────────────

/** Who votes: everyone seated, narrowed to who is here online. */
export const voters = (game, activeIds = null) => (activeIds ? game.order.filter((id) => activeIds.includes(id)) : game.order);

/**
 * `voter`'s whole ballot at once: one team id per role, in role order, never
 * their own. Final once cast, like AniFake's castVote: the vote closes the
 * moment the last ballot lands, so a ballot that could still change would
 * race that close, and online the screen says who has voted.
 */
export function castBallot(game, voter, choices) {
  if (game.phase !== 'vote' || !game.order.includes(voter) || game.ballots[voter]) return { patch: {} };
  if (!Array.isArray(choices) || choices.length !== ROLES_PER_ROUND) return { patch: {} };
  if (choices.some((id) => id === voter || !game.order.includes(id))) return { patch: {} };
  return { patch: { ballots: { ...game.ballots, [voter]: [...choices] } } };
}

export const hasVoted = (game, id) => Boolean(game.ballots[id]);
export const everyoneVoted = (game, activeIds = null) => {
  const list = voters(game, activeIds);
  return list.length > 0 && list.every((id) => game.ballots[id]);
};
export const pendingVoters = (game, activeIds = null) => voters(game, activeIds).filter((id) => !game.ballots[id]);

/** One role's count: team id → votes, every team listed (0 for none). */
export function tallyRole(game, roleIndex) {
  const counts = Object.fromEntries(game.order.map((id) => [id, 0]));
  for (const choices of Object.values(game.ballots)) {
    const target = choices?.[roleIndex];
    if (target in counts) counts[target] += 1;
  }
  return counts;
}

/**
 * Who won a role: every team on the most votes, so a tie scores all of them.
 * A role nobody voted on (every voter gone) has no winner.
 */
export function winnersOf(counts, order) {
  const max = Math.max(0, ...order.map((id) => counts?.[id] ?? 0));
  return max > 0 ? order.filter((id) => (counts?.[id] ?? 0) === max) : [];
}

/**
 * Once every voter here has voted: count each role, score it, and file the
 * round in the log for the reveal and the recap. Counts whatever ballots are
 * in, so a voter who left before voting is simply not counted.
 */
export function closeVote(game, activeIds = null) {
  if (game.phase !== 'vote' || !everyoneVoted(game, activeIds)) return { patch: {} };
  const tally = game.roles.map((_, i) => tallyRole(game, i));
  const scores = { ...game.scores };
  const votesWon = { ...game.votesWon };
  tally.forEach((counts) => {
    for (const id of winnersOf(counts, game.order)) scores[id] = (scores[id] ?? 0) + 1;
    for (const id of game.order) votesWon[id] = (votesWon[id] ?? 0) + counts[id];
  });
  const entry = {
    round: game.round,
    roles: game.roles,
    teams: Object.fromEntries(game.order.map((id) => [id, teamSlots(game, id)])),
    tally,
  };
  return { patch: { phase: 'reveal', shown: 0, scores, votesWon, log: [...game.log, entry] } };
}

// ── The reveal ───────────────────────────────────────────────────────────

/** The round just voted on, as the log filed it. */
export const lastEntry = (game) => game.log[game.log.length - 1] ?? null;

/**
 * Show the next role's result. `from` is how many were showing when the
 * button was pressed, so two phones pressing at once reveal one role, not two.
 */
export function revealNext(game, from) {
  if (game.phase !== 'reveal' || game.shown !== from || game.shown >= ROLES_PER_ROUND) return { patch: {} };
  return { patch: { shown: game.shown + 1 } };
}

export const revealDone = (game) => game.phase === 'reveal' && game.shown >= ROLES_PER_ROUND;

/**
 * The scores as far as the reveal has got: closeVote already counted every
 * role, so the roles not shown yet are taken back off. The score row would
 * otherwise give the round away before the first role is turned over.
 */
export function revealedScores(game) {
  const entry = lastEntry(game);
  if (game.phase !== 'reveal' || !entry) return game.scores;
  const out = { ...game.scores };
  entry.tally.forEach((counts, i) => {
    if (i >= game.shown) for (const id of winnersOf(counts, game.order)) out[id] = (out[id] ?? 0) - 1;
  });
  return out;
}
export const isLastRound = (game) => game.round + 1 >= game.rounds;

/**
 * From a finished reveal to the next round's draft, with the board and roles
 * the caller dealt for it — or to the end, after the last round or when the
 * lists cannot fill another board.
 */
export function nextRound(game, { board, roles, now = null } = {}) {
  if (!revealDone(game)) return { patch: {} };
  if (isLastRound(game) || !validBoard(board, game.order.length) || roles?.length !== ROLES_PER_ROUND) {
    return { patch: { phase: 'finished' } };
  }
  return changed(game, {
    ...game,
    ...roundStart(game.round + 1, board, roles, now),
    used: [...game.used, ...board.map((c) => c.key).filter((k) => !game.used.includes(k))],
  });
}

/** Every card drafted this game, so a later board never deals it again. */
export function draftedKeys(game) {
  const keys = new Set(game.picks.map((p) => p.card));
  for (const e of game.log) for (const slots of Object.values(e.teams)) for (const c of slots) if (c) keys.add(c.key);
  return [...keys];
}

/** Online, below two players here nobody is left to vote on anyone else's team. */
export const enoughPlayers = (game, activeIds) => voters(game, activeIds).length >= 2;

export function endGame(game) {
  if (game.phase === 'finished') return { patch: {} };
  return { patch: { phase: 'finished' } };
}

// ── Results ──────────────────────────────────────────────────────────────

/**
 * Players best-first: roles won, then votes received across the game. A place
 * is shared only when both are level — the votes are the tie-break the scores
 * alone would leave a draw.
 */
export function standings(players, game) {
  const roles = (p) => game.scores?.[p.id] ?? 0;
  const votes = (p) => game.votesWon?.[p.id] ?? 0;
  const sorted = [...players].sort((a, b) => roles(b) - roles(a) || votes(b) - votes(a));
  let place = 0;
  let last = null;
  return sorted.map((p, i) => {
    const key = `${roles(p)}:${votes(p)}`;
    if (key !== last) { place = i + 1; last = key; }
    return { ...p, total: roles(p), votes: votes(p), position: place };
  });
}

// ── Repair ───────────────────────────────────────────────────────────────
//
// RTDB drops empty objects and arrays and can return an array as an object
// keyed by index, so every value from a room passes through these first. Named
// fields only.

const numberOr = (v, fallback) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback);
const str = (v) => (typeof v === 'string' ? v : null);

export function listOf(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((v) => v != null);
  if (typeof raw === 'object') {
    return Object.keys(raw)
      .filter((k) => Number.isInteger(Number(k)))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => raw[k])
      .filter((v) => v != null);
  }
  return [];
}

// A fixed-length list read by index, for the ones whose POSITION is the
// meaning (a team's slots, the tally per role): listOf would close the gap a
// dropped entry leaves and shift every later one into the wrong role. Works on
// an array, a sparse one and an index-keyed object alike (anirank's
// normalizeBoard is the same loop).
const slotsOf = (raw, n, fn) => Array.from({ length: n }, (_, i) => fn(raw?.[i]));

export function normalizeCard(raw) {
  if (!raw || typeof raw !== 'object' || !str(raw.name) || !str(raw.key)) return null;
  return { key: raw.key, name: raw.name, series: str(raw.series) ?? '', imageUrl: str(raw.imageUrl) ?? '' };
}

const counts = (raw) => {
  const out = {};
  for (const [id, n] of Object.entries(raw ?? {})) out[id] = numberOr(n, 0);
  return out;
};

function normalizeEntry(e, order) {
  if (!e || typeof e !== 'object') return null;
  const roles = slotsOf(e.roles, ROLES_PER_ROUND, (r) => str(r) ?? 'wildcard');
  const teams = {};
  for (const [id, slots] of Object.entries(e.teams ?? {})) teams[id] = slotsOf(slots, ROLES_PER_ROUND, normalizeCard);
  // Every team listed in every count, zeros included, whatever RTDB kept.
  const tally = slotsOf(e.tally, ROLES_PER_ROUND, (c) => ({ ...Object.fromEntries(order.map((id) => [id, 0])), ...counts(c) }));
  return { round: numberOr(e.round, 0), roles, teams, tally };
}

export function normalizeGame(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const order = listOf(raw.order).filter((id) => typeof id === 'string');
  const ballots = {};
  for (const [id, choices] of Object.entries(raw.ballots ?? {})) {
    const list = slotsOf(choices, ROLES_PER_ROUND, (c) => str(c));
    if (list.every(Boolean)) ballots[id] = list;
  }
  const phases = ['draft', 'vote', 'reveal', 'finished'];
  return {
    rounds: numberOr(raw.rounds, 1),
    pool: raw.pool === 'all' ? 'all' : 'main',
    pickClock: numberOr(raw.pickClock, 0),
    order,
    scores: counts(raw.scores),
    votesWon: counts(raw.votesWon),
    round: numberOr(raw.round, 0),
    phase: phases.includes(raw.phase) ? raw.phase : 'draft',
    roles: listOf(raw.roles).filter((r) => typeof r === 'string'),
    shuffles: numberOr(raw.shuffles, 0),
    board: listOf(raw.board).map(normalizeCard).filter(Boolean),
    picks: listOf(raw.picks)
      .filter((p) => p && typeof p === 'object' && str(p.by) && str(p.card))
      .map((p) => ({ by: p.by, card: p.card, slot: numberOr(p.slot, -1), auto: p.auto === true })),
    pickAt: numberOr(raw.pickAt, null),
    ballots,
    shown: numberOr(raw.shown, 0),
    used: listOf(raw.used).filter((k) => typeof k === 'string'),
    log: listOf(raw.log).map((e) => normalizeEntry(e, order)).filter(Boolean),
  };
}
