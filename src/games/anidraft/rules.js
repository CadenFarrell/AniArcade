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

import { award, clearBest, clearLeader, tally as countIds, times } from '../../shared/utils/awards';
import { roleOf } from './roles';

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
/**
 * The optional line a picker types with a pick ("why them?"), which the
 * voters see on the ballot. One phone line, not an essay: the ballot is a
 * grid of cards, and the argument is meant to be said at the table anyway.
 */
export const MAX_WHY = 60;

/** A typed reason as it is stored: one line, trimmed, capped — or null for none. */
export function cleanWhy(text) {
  const line = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_WHY).trim();
  return line || null;
}

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

/**
 * A player's five role slots, in role order: the card drafted into each, or
 * null. A pick's typed reason rides on its card (`why`), so the ballot reads
 * it from here and closeVote files it in the log with the team, for the reveal.
 */
export function teamSlots(game, id) {
  const slots = Array(ROLES_PER_ROUND).fill(null);
  for (const p of game.picks) {
    if (p.by !== id || p.slot < 0 || p.slot >= ROLES_PER_ROUND) continue;
    const card = cardOf(game, p.card);
    slots[p.slot] = card && p.why ? { ...card, why: p.why } : card;
  }
  return slots;
}

/**
 * A team as the log files it: teamSlots, each card also stamped with its
 * overall pick number this round (`pick`, from 1) and `auto` when the clock
 * made it — for the awards, since `picks` is gone with the next round.
 */
function loggedSlots(game, id) {
  return teamSlots(game, id).map((card, slot) => {
    if (!card) return card;
    const at = game.picks.findIndex((p) => p.by === id && p.slot === slot);
    if (at < 0) return card;
    return { ...card, pick: at + 1, ...(game.picks[at].auto ? { auto: true } : {}) };
  });
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
 * is already filled. `why` is the picker's optional reason (cleanWhy); a pick
 * without one stores no field at all, since RTDB keeps no nulls anyway.
 */
export function makePick(game, by, card, slot, { now = null, why = null } = {}) {
  if (game.phase !== 'draft' || currentPicker(game) !== by) return { patch: {} };
  if (!cardOf(game, card) || takenBy(game).has(card)) return { patch: {} };
  if (!Number.isInteger(slot) || !openSlots(game, by).includes(slot)) return { patch: {} };
  const line = cleanWhy(why);
  return withPick(game, { by, card, slot, auto: false, ...(line ? { why: line } : {}) }, now);
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
    teams: Object.fromEntries(game.order.map((id) => [id, loggedSlots(game, id)])),
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
  const card = { key: raw.key, name: raw.name, series: str(raw.series) ?? '', imageUrl: str(raw.imageUrl) ?? '' };
  // A drafted card in the log carries its pick's reason (teamSlots), its pick
  // number and whether the clock made it (loggedSlots).
  const why = cleanWhy(str(raw.why));
  const pick = Number.isInteger(raw.pick) && raw.pick > 0 ? raw.pick : null;
  return {
    ...card,
    ...(why ? { why } : {}),
    ...(pick ? { pick } : {}),
    ...(raw.auto === true ? { auto: true } : {}),
  };
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
      .map((p) => {
        const pick = { by: p.by, card: p.card, slot: numberOr(p.slot, -1), auto: p.auto === true };
        const why = cleanWhy(str(p.why));
        return why ? { ...pick, why } : pick;
      }),
    pickAt: numberOr(raw.pickAt, null),
    ballots,
    shown: numberOr(raw.shown, 0),
    used: listOf(raw.used).filter((k) => typeof k === 'string'),
    log: listOf(raw.log).map((e) => normalizeEntry(e, order)).filter(Boolean),
  };
}

// ── The draft's story ────────────────────────────────────────────────────

/**
 * The final screen's superlatives, from the log: five good, five roasts, each
 * a clear leader or nothing (a tie drops it rather than picking by seat). The
 * card (shared/utils/awards.js's pickAwards) shows two of each.
 *
 * Built from the tallies alone, never the ballots: the reveal shows how many
 * votes each team drew, not who cast them, so no award may say who voted for
 * whom. Entries from before `pick`/`auto` were logged skip the awards that
 * need them.
 *
 *   Unanimous           a card that took every vote for its role
 *   People’s champ      the card that drew the most votes in the game
 *   Dynasty             the most roles won in one round (3+)
 *   Silver tongue       a role won with a "why" line, quoted
 *   Steal of the draft  the latest pick to win a role (after the first lap)
 *   Benchwarmer         a whole team without one vote in a round (roast)
 *   First-round bust    an opening-lap pick that drew no votes (roast)
 *   Hot take            a "why" line that drew no votes, quoted (roast)
 *   Bridesmaid          the most roles lost by a single vote (2+, roast)
 *   Autopilot           the most picks the clock made for them (2+, roast)
 */
export function draftAwards(log = [], players = []) {
  const byId = (id) => players.find((p) => p.id === id) ?? null;
  const entries = (log ?? []).filter(Boolean);
  const out = [];
  // Every drafted card with its role, its votes and whether it won.
  const cards = entries.flatMap((e) => {
    const order = Object.keys(e.teams ?? {});
    return order.flatMap((by) => (e.teams[by] ?? []).map((card, slot) => {
      if (!card) return null;
      const counts = e.tally?.[slot] ?? {};
      const total = Object.values(counts).reduce((a, n) => a + n, 0);
      const top = Math.max(0, ...Object.values(counts));
      return {
        by, card, slot, round: e.round, role: roleOf(e.roles?.[slot]).name, top,
        votes: counts[by] ?? 0, total, won: winnersOf(counts, order).includes(by), seats: order.length,
      };
    }).filter(Boolean));
  });
  const latest = (list, id) => list.filter((c) => c.by === id).at(-1);

  const sweeps = cards.filter((c) => c.seats >= 3 && c.total >= 2 && c.votes === c.total);
  const sweep = clearLeader(countIds(sweeps, (c) => c.by));
  if (sweep) {
    const c = latest(sweeps, sweep.id);
    out.push(award('Unanimous', byId(sweep.id), sweep.n === 1
      ? `Every vote for ${c.card.name} as ${c.role}`
      : `Took every vote for a role ${times(sweep.n)}`, { weight: 3 }));
  }
  const champ = clearBest(cards.filter((c) => c.votes >= 2), (c) => c.votes);
  if (champ && !sweeps.includes(champ)) out.push(award('People’s champ', byId(champ.by), `${champ.card.name} drew ${champ.votes} votes as ${champ.role}`, { weight: 2 }));
  const hauls = entries.flatMap((e) => Object.keys(e.teams ?? {}).map((by) => ({
    by, round: e.round, n: cards.filter((c) => c.round === e.round && c.by === by && c.won).length,
  })));
  const dynasty = clearBest(hauls.filter((h) => h.n >= 3), (h) => h.n);
  if (dynasty) out.push(award('Dynasty', byId(dynasty.by), `Won ${dynasty.n} of ${ROLES_PER_ROUND} roles in round ${dynasty.round + 1}`, { weight: 2 }));
  const pitches = cards.filter((c) => c.won && c.card.why);
  const silver = clearLeader(countIds(pitches, (c) => c.by));
  if (silver) {
    const c = latest(pitches, silver.id);
    out.push(award('Silver tongue', byId(silver.id), silver.n === 1
      ? `Won ${c.role} with “${c.card.why}”`
      : `Won ${silver.n} roles with a why line, “${c.card.why}” among them`));
  }
  const steal = clearBest(cards.filter((c) => c.won && Number.isInteger(c.card.pick) && c.card.pick > c.seats), (c) => c.card.pick);
  if (steal) out.push(award('Steal of the draft', byId(steal.by), `Pick ${steal.card.pick}, ${steal.card.name}, won ${steal.role}`));

  const benched = entries.flatMap((e) => Object.keys(e.teams ?? {}).filter((by) => (
    (e.tally ?? []).every((counts) => !(counts?.[by] > 0))
  )).map((by) => ({ by, round: e.round })));
  const bench = clearLeader(countIds(benched, (b) => b.by));
  if (bench) {
    out.push(award('Benchwarmer', byId(bench.id), bench.n === 1
      ? `Not one vote in round ${latest(benched, bench.id).round + 1}`
      : `Not one vote, ${times(bench.n, 'round')}`, { roast: true }));
  }
  const bust = clearBest(cards.filter((c) => Number.isInteger(c.card.pick) && c.card.pick <= c.seats && c.votes === 0 && c.total > 0),
    (c) => c.card.pick, { dir: 'min' });
  if (bust) {
    out.push(award('First-round bust', byId(bust.by), bust.card.pick === 1
      ? `Picked ${bust.card.name} first — not one vote`
      : `Pick ${bust.card.pick}, ${bust.card.name} — not one vote`, { roast: true }));
  }
  const takes = cards.filter((c) => c.card.why && c.votes === 0 && c.total > 0);
  const take = clearLeader(countIds(takes, (c) => c.by));
  if (take) {
    const c = latest(takes, take.id);
    out.push(award('Hot take', byId(take.id), `“${c.card.why}” — not one vote for ${c.card.name}`, { roast: true }));
  }
  const close = clearLeader(countIds(cards.filter((c) => !c.won && c.top > 0 && c.votes === c.top - 1), (c) => c.by), { min: 2 });
  if (close) out.push(award('Bridesmaid', byId(close.id), `Lost ${close.n} roles by a single vote`, { roast: true }));
  const auto = clearLeader(countIds(cards, (c) => (c.card.auto ? c.by : null)), { min: 2 });
  if (auto) out.push(award('Autopilot', byId(auto.id), `The clock picked for them ${auto.n} times`, { roast: true }));
  return out.filter(Boolean);
}
