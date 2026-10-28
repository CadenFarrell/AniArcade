// AniName's rules: pure functions over the round state, no React, no storage,
// no network. Each move returns `{ patch }`; an empty patch means "refused",
// which the online hook relies on to abort its transaction.
//
// Two objects, AniQuiz's split: `deal` is written once (deal.js — a category a
// round and the naming time), `game` holds everything that moves:
//
//   { order, scores, rounds, round, opener, phase, turnId, bid, passed,
//     answers, deadlineAt, namingMs, result }
//
//   phase: 'bidding' → 'naming' → ('review') → 'revealed' → … → 'finished'
//
// **The auction.** The opener (rotating each round) must open; round the table
// everyone else raises or drops out, and a drop is for the round. When nobody
// is left to raise, the high bidder has `namingMs` to type that many answers.
//
// **Answers are graded by the caller.** A typed name arrives already judged
// (answers.js's judgeName, run on the namer's device against the index of the
// room's lists plus its pack): right, wrong, or pending — a name our data has
// never heard of. Pending names go to the table after the clock, in 'review',
// but only when they could change the result.
//
// **Time.** Nothing here reads a clock. A rule that needs "now" takes it as an
// argument (Date.now() locally, server time online), so tests pin it.

/** A bid's floor and ceiling. Thirty is more than anyone names in a minute. */
export const MIN_BID = 1;
export const MAX_BID = 30;
// A table of one is a solo challenge; a room needs company.
export const MIN_PLAYERS = 1;
export const ONLINE_MIN_PLAYERS = 2;
// Names typed in the last instant land before the round closes on them —
// AniQuiz's REVEAL_GRACE_MS, for the same gap.
export const NAME_GRACE_MS = 1000;

/** Made it: the bidder scores the bid. */
export const madePoints = (n) => n;
/** Fell short: everyone else still here scores half the bid, rounded up. */
export const missPoints = (n) => Math.ceil(n / 2);

export const rightCount = (answers) => (answers ?? []).filter((a) => a.verdict === 'right').length;
export const pendingCount = (answers) => (answers ?? []).filter((a) => a.verdict === 'pending').length;

/** The round's category. */
export function currentCategory(game, deal) {
  return deal?.cats?.[game?.round ?? 0] ?? null;
}

const roundReset = (opener) => ({
  opener,
  phase: 'bidding',
  turnId: opener,
  bid: null,
  passed: {},
  answers: [],
  deadlineAt: null,
  result: null,
});

export function startGame(playerIds, deal) {
  return {
    order: [...playerIds],
    scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
    rounds: deal?.cats?.length ?? 0,
    round: 0,
    namingMs: deal?.namingMs ?? 60_000,
    ...roundReset(playerIds[0] ?? null),
  };
}

const live = (game, activeIds) => (activeIds ? game.order.filter((id) => activeIds.includes(id)) : game.order);

// The next seat after `fromId` that may still raise: here, not dropped out, and
// not the one holding the bid. Null when nobody is left to raise.
function nextBidder(game, fromId, activeIds) {
  const seats = game.order;
  const start = seats.indexOf(fromId);
  for (let step = 1; step <= seats.length; step++) {
    const id = seats[(start + step) % seats.length];
    if (activeIds && !activeIds.includes(id)) continue;
    if (game.passed[id] || id === game.bid?.by) continue;
    return id;
  }
  return null;
}

// Nobody left to raise: the high bidder names.
function toNaming(game, now) {
  return {
    phase: 'naming',
    turnId: game.bid.by,
    answers: [],
    deadlineAt: now != null ? now + game.namingMs : null,
  };
}

// After a bid or a drop: the next raiser's turn, or the naming.
function afterBidding(game, fromId, activeIds, now) {
  const next = nextBidder(game, fromId, activeIds);
  if (next) return { ...game, turnId: next };
  return { ...game, ...toNaming(game, now) };
}

const changed = (game, next) => {
  const patch = {};
  for (const [k, v] of Object.entries(next)) if (game[k] !== v) patch[k] = v;
  return { patch };
};

/** Raise to `n`. It must beat the bid on the table, and it must be your turn. */
export function placeBid(game, playerId, n, activeIds = null, now = null) {
  if (game.phase !== 'bidding' || game.turnId !== playerId) return { patch: {} };
  const floor = (game.bid?.n ?? 0) + 1;
  if (!Number.isInteger(n) || n < Math.max(MIN_BID, floor) || n > MAX_BID) return { patch: {} };
  const bid = { by: playerId, n };
  return changed(game, afterBidding({ ...game, bid }, playerId, activeIds, now));
}

/** Drop out of this round's auction. The opener cannot, before anyone has bid. */
export function pass(game, playerId, activeIds = null, now = null) {
  if (game.phase !== 'bidding' || game.turnId !== playerId || !game.bid) return { patch: {} };
  const passed = { ...game.passed, [playerId]: true };
  return changed(game, afterBidding({ ...game, passed }, playerId, activeIds, now));
}

// Scores the round and moves to the reveal. A miss pays everyone else still
// here — not the departed, who are no longer playing for points.
function settle(game, made, activeIds) {
  const { by, n } = game.bid;
  const scores = { ...game.scores };
  if (made) scores[by] = (scores[by] ?? 0) + madePoints(n);
  else for (const id of live(game, activeIds)) if (id !== by) scores[id] = (scores[id] ?? 0) + missPoints(n);
  return {
    phase: 'revealed',
    scores,
    deadlineAt: null,
    result: { by, n, made, count: rightCount(game.answers), void: null },
  };
}

// The clock has stopped (time, or "Done"): made, short, or down to the table.
function afterNaming(game, activeIds) {
  const right = rightCount(game.answers);
  const n = game.bid.n;
  if (right >= n) return settle(game, true, activeIds);
  if (right + pendingCount(game.answers) >= n) return { phase: 'review', deadlineAt: null };
  return settle(game, false, activeIds);
}

/**
 * One typed answer, already judged: `{ text, key, label, verdict, why? }`.
 * Only the bidder names, only while the clock runs (plus NAME_GRACE_MS). An
 * answer already given — by key, so "Kakashi" after "Kakashi Hatake" — is kept
 * on the list as a repeat and counts for nothing. Reaching the bid in rights
 * ends the round there: there is nothing left to prove.
 */
export function addName(game, playerId, judged, activeIds = null, now = null) {
  if (game.phase !== 'naming' || game.bid?.by !== playerId || !judged?.key) return { patch: {} };
  if (now != null && game.deadlineAt != null && now > game.deadlineAt + NAME_GRACE_MS) return { patch: {} };
  const repeat = (game.answers ?? []).some((a) => a.key === judged.key && a.verdict !== 'wrong');
  const entry = {
    text: String(judged.text ?? '').slice(0, 80),
    key: judged.key,
    label: String(judged.label ?? judged.text ?? '').slice(0, 80),
    verdict: repeat ? 'repeat' : judged.verdict,
    why: judged.why ?? null,
  };
  const answers = [...(game.answers ?? []), entry];
  if (rightCount(answers) >= game.bid.n) return { patch: { answers, ...settle({ ...game, answers }, true, activeIds) } };
  return { patch: { answers } };
}

/** The bidder stops early ("Done"), or anyone once the clock has run out. */
export function stopNaming(game, playerId, activeIds = null, now = null) {
  if (game.phase !== 'naming') return { patch: {} };
  const expired = now != null && game.deadlineAt != null && now >= game.deadlineAt + NAME_GRACE_MS;
  if (playerId !== game.bid.by && !expired) return { patch: {} };
  return { patch: afterNaming(game, activeIds) };
}

/** Who may rule on a pending answer: anyone but the bidder, unless nobody else is here. */
export function canJudge(game, playerId, activeIds = null) {
  if (game.phase !== 'review') return false;
  const others = live(game, activeIds).filter((id) => id !== game.bid.by);
  return others.length ? playerId !== game.bid.by : playerId === game.bid.by;
}

/**
 * The table rules on one pending answer. The round ends the moment it is
 * decided either way — the bid reached, or too few pending left to reach it —
 * so nobody votes on answers that can no longer matter.
 */
export function judgeAnswer(game, playerId, index, accept, activeIds = null) {
  if (!canJudge(game, playerId, activeIds) || game.answers?.[index]?.verdict !== 'pending') return { patch: {} };
  const answers = game.answers.map((a, i) => (i === index ? { ...a, verdict: accept ? 'right' : 'wrong', why: accept ? 'table' : 'table said no' } : a));
  const next = { ...game, answers };
  const right = rightCount(answers);
  if (right >= game.bid.n) return { patch: { answers, ...settle(next, true, activeIds) } };
  if (right + pendingCount(answers) < game.bid.n) return { patch: { answers, ...settle(next, false, activeIds) } };
  return { patch: { answers } };
}

/** From the reveal to the next round (the opener moves one seat), or the end. */
export function nextRound(game, activeIds = null) {
  if (game.phase !== 'revealed') return { patch: {} };
  if (game.round + 1 >= game.rounds) return { patch: { phase: 'finished' } };
  const seats = live(game, activeIds);
  const at = game.order.indexOf(game.opener);
  let opener = seats[0] ?? game.order[0];
  for (let step = 1; step <= game.order.length; step++) {
    const id = game.order[(at + step) % game.order.length];
    if (seats.includes(id)) { opener = id; break; }
  }
  return { patch: { round: game.round + 1, ...roundReset(opener) } };
}

/**
 * Re-checks the round after the roster changed:
 *   - bidding, and the seat whose turn it is has gone: they drop out (or,
 *     before any bid, the opening moves to the next seat here);
 *   - bidding, and the high bidder has gone: the auction starts over;
 *   - naming or review, and the bidder has gone: the round is void.
 * The clock running out is `stopNaming`'s, not this.
 */
export function settleIfComplete(game, activeIds, now = null) {
  if (!game) return { patch: {} };
  const here = (id) => activeIds.includes(id);
  if (game.phase === 'bidding') {
    if (game.bid && !here(game.bid.by)) {
      const opener = here(game.opener) ? game.opener : nextBidder({ ...game, bid: null, passed: {} }, game.opener, activeIds);
      return opener ? changed(game, { ...game, ...roundReset(opener) }) : { patch: {} };
    }
    if (!here(game.turnId)) {
      if (!game.bid) {
        const opener = nextBidder(game, game.turnId, activeIds);
        return opener ? { patch: { opener, turnId: opener } } : { patch: {} };
      }
      const passed = { ...game.passed, [game.turnId]: true };
      return changed(game, afterBidding({ ...game, passed }, game.turnId, activeIds, now));
    }
    return { patch: {} };
  }
  if ((game.phase === 'naming' || game.phase === 'review') && !here(game.bid.by)) {
    return {
      patch: {
        phase: 'revealed',
        deadlineAt: null,
        result: { by: game.bid.by, n: game.bid.n, made: false, count: rightCount(game.answers), void: 'left' },
      },
    };
  }
  return { patch: {} };
}

/** The room emptied below ONLINE_MIN_PLAYERS: straight to the results. */
export function endGame(game) {
  if (game.phase === 'finished') return { patch: {} };
  return { patch: { phase: 'finished', deadlineAt: null } };
}

// ── Repair ───────────────────────────────────────────────────────────────
//
// RTDB drops empty objects and arrays and can return an array as an object
// keyed by index, so every value from a room passes through these first. Named
// fields only.

const numberOr = (v, fallback) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback);

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

const VERDICTS = ['right', 'wrong', 'pending', 'repeat'];

function normalizeAnswer(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.key !== 'string') return null;
  return {
    text: typeof raw.text === 'string' ? raw.text : '',
    key: raw.key,
    label: typeof raw.label === 'string' ? raw.label : '',
    verdict: VERDICTS.includes(raw.verdict) ? raw.verdict : 'pending',
    why: typeof raw.why === 'string' ? raw.why : null,
  };
}

export function normalizeGame(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const scores = {};
  for (const [id, s] of Object.entries(raw.scores ?? {})) scores[id] = numberOr(s, 0);
  const passed = {};
  for (const [id, v] of Object.entries(raw.passed ?? {})) if (v) passed[id] = true;
  const bid = raw.bid && raw.bid.by != null ? { by: raw.bid.by, n: numberOr(raw.bid.n, MIN_BID) } : null;
  const phases = ['bidding', 'naming', 'review', 'revealed', 'finished'];
  let phase = phases.includes(raw.phase) ? raw.phase : 'bidding';
  // A naming or review phase with no bid cannot be played; fall back to the auction.
  if (!bid && (phase === 'naming' || phase === 'review')) phase = 'bidding';
  const r = raw.result;
  return {
    order: listOf(raw.order),
    scores,
    rounds: numberOr(raw.rounds, 0),
    round: numberOr(raw.round, 0),
    namingMs: numberOr(raw.namingMs, 60_000),
    opener: raw.opener ?? null,
    phase,
    turnId: raw.turnId ?? null,
    bid,
    passed,
    answers: listOf(raw.answers).map(normalizeAnswer).filter(Boolean),
    deadlineAt: numberOr(raw.deadlineAt, null),
    result: r && typeof r === 'object'
      ? { by: r.by ?? null, n: numberOr(r.n, 0), made: Boolean(r.made), count: numberOr(r.count, 0), void: r.void === 'left' ? 'left' : null }
      : null,
  };
}

export function normalizeDeal(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    rounds: numberOr(raw.rounds, 0),
    namingMs: numberOr(raw.namingMs, 60_000),
    // No filter: `round` indexes this list, so a category that failed to
    // repair stays a null at its own index rather than shifting the rest.
    cats: listOf(raw.cats).map((c) => (c && typeof c === 'object' && c.kind
      ? { kind: c.kind, key: String(c.key ?? ''), label: String(c.label ?? ''), known: numberOr(c.known, 0) }
      : null)),
  };
}

/** Players best-first, ties sharing a place. */
export function standings(players, scores) {
  const sorted = [...players].sort((a, b) => (scores?.[b.id] ?? 0) - (scores?.[a.id] ?? 0));
  let place = 0;
  let last = null;
  return sorted.map((p, i) => {
    const total = scores?.[p.id] ?? 0;
    if (total !== last) { place = i + 1; last = total; }
    return { ...p, total, position: place };
  });
}
