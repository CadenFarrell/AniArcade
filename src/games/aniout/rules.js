// AniOut's rules: pure functions over the round state, no React, no storage,
// no network. Each move returns `{ patch }` for the caller to apply; an empty
// patch means "refused", which the online hook relies on to abort its
// transaction rather than rewrite the same value.
//
// Two objects, AniQuiz's split: `deal` is written once (deal.js — every
// round's cards, the odd one and the reasons), `game` holds everything that
// moves:
//
//   { order, scores, rounds, round, phase, picks }
//
//   phase: 'picking' → 'revealed' → 'picking' … → 'finished'
//   picks: { [playerId]: { card, reason, correct, reasonRight, delta } }
//
// Everyone picks every round, in secret, and nothing settles until every
// player still here has locked in — the gate counts the ACTIVE roster, so a
// closed tab never wedges a room (settleIfComplete).

import { award, clearLeader, longestRuns, tally } from '../../shared/utils/awards';

/** A right pick. */
export const PICK_POINTS = 2;
/** A right reason, on top of a right pick — never on its own. */
export const REASON_POINTS = 1;
// Local play allows a table of one (a puzzle); a room needs company, and ends
// when it drops below that.
export const MIN_PLAYERS = 1;
export const ONLINE_MIN_PLAYERS = 2;

/** The round on screen. */
export function currentSet(game, deal) {
  return deal?.sets?.[game?.round ?? 0] ?? null;
}

export function startGame(playerIds, deal) {
  return {
    order: [...playerIds],
    scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
    rounds: deal?.sets?.length ?? 0,
    round: 0,
    phase: 'picking',
    picks: {},
    log: [],
  };
}

/** Who still owes a pick, in seat order — local play's pass order. */
export function stillToPick(game, activeIds) {
  if (game?.phase !== 'picking') return [];
  return game.order.filter((id) => activeIds.includes(id) && !game.picks?.[id]);
}

// Grades every pick in and moves to the reveal. Picks by players who have
// since left are graded too: they locked in fairly, and their points stand.
function settle(game, deal, picks) {
  const set = currentSet(game, deal);
  const scores = { ...game.scores };
  const graded = {};
  for (const [id, p] of Object.entries(picks)) {
    const correct = Boolean(set) && p.card === set.odd;
    const reasonRight = correct && deal.reasonsOn && p.reason === set.reason;
    const delta = (correct ? PICK_POINTS : 0) + (reasonRight ? REASON_POINTS : 0);
    graded[id] = { ...p, correct, reasonRight, delta };
    scores[id] = (scores[id] ?? 0) + delta;
  }
  return { picks: graded, scores, phase: 'revealed' };
}

/**
 * One player's pick: a card key and, with reasons on, the index of a reason.
 * Refused outside the picking phase, for a second pick, for a card not on the
 * table, and for a missing reason when reasons are on — the screen will not
 * send one, so a write without one is a stale or hand-made one.
 */
export function submitPick(game, deal, playerId, pick, activeIds) {
  if (game.phase !== 'picking' || game.picks?.[playerId]) return { patch: {} };
  if (!game.order.includes(playerId)) return { patch: {} };
  const set = currentSet(game, deal);
  if (!set || !set.cards.some((c) => c.key === pick?.card)) return { patch: {} };
  const reason = deal.reasonsOn ? Number(pick.reason) : -1;
  if (deal.reasonsOn && !(Number.isInteger(reason) && reason >= 0 && reason < set.reasons.length)) return { patch: {} };

  const picks = { ...game.picks, [playerId]: { card: pick.card, reason } };
  const done = game.order.filter((id) => activeIds.includes(id)).every((id) => picks[id]);
  return { patch: done ? settle(game, deal, picks) : { picks } };
}

/**
 * Re-checks the gate after the roster changed: the last player everyone was
 * waiting on may be the one who left, which completes the round with no new
 * pick to trigger it. Needs at least one pick in, or a room whose every player
 * dropped at once would reveal a round nobody played.
 */
export function settleIfComplete(game, deal, activeIds) {
  if (game?.phase !== 'picking') return { patch: {} };
  const live = game.order.filter((id) => activeIds.includes(id));
  if (!Object.keys(game.picks ?? {}).length) return { patch: {} };
  if (!live.every((id) => game.picks[id])) return { patch: {} };
  return { patch: settle(game, deal, game.picks) };
}

// The round just revealed, as one line of the game's story: who found the odd
// one out, who also named the reason, and which card everyone picked (so a
// wrong pick can be told from a player who never picked — they left — and
// two wrong picks on one card from two on different ones). Plain values, so
// it survives RTDB.
function logLine(game) {
  const picks = Object.entries(game.picks ?? {});
  return {
    round: game.round,
    got: picks.filter(([, p]) => p.correct).map(([id]) => id),
    reasons: picks.filter(([, p]) => p.reasonRight).map(([id]) => id),
    picks: Object.fromEntries(picks.filter(([, p]) => p?.card != null).map(([id, p]) => [id, String(p.card)])),
  };
}

/**
 * From the reveal, on to the next round — or the end. Anyone may press it. The
 * round goes into `log` on the way, for the final screen's recap and awards.
 */
export function nextRound(game) {
  if (game.phase !== 'revealed') return { patch: {} };
  const log = [...(game.log ?? []), logLine(game)];
  if (game.round + 1 >= game.rounds) return { patch: { phase: 'finished', log } };
  return { patch: { round: game.round + 1, phase: 'picking', picks: {}, log } };
}

/**
 * The final screen's superlatives, from the log. Each is a clear leader or
 * nothing — a tie drops it rather than picking by seat — and the card
 * (shared/utils/awards.js's pickAwards) chooses what shows. Lines from before
 * `picks` was logged skip the awards that need it.
 *
 *   Sharpest eye                the most odd ones out found (two or more)
 *   Mind reader                 the most reasons named (two or more, reasons on)
 *   Lone wolf                   the only one who found it, two rounds or more
 *   Hot streak                  the most rounds in a row found (three or more)
 *   Contrarian                  a wrong card nobody else picked, two rounds or more
 *   Right for the wrong reason  found it three times or more, never named why (roast)
 *   Fooled again                the most wrong picks (three or more, roast)
 */
export function outAwards(log = [], players = [], { reasonsOn = false } = {}) {
  const byId = (id) => players.find((p) => p.id === id) ?? null;
  const lines = (log ?? []).filter(Boolean);
  const out = [];
  const eye = clearLeader(tally(lines, (l) => l.got), { min: 2 });
  if (eye) out.push(award('Sharpest eye', byId(eye.id), `Found the odd one out ${eye.n} times`, { weight: 2 }));
  const reader = clearLeader(tally(lines, (l) => l.reasons), { min: 2 });
  if (reader) out.push(award('Mind reader', byId(reader.id), `Named the reason ${reader.n} times`, { weight: 2 }));

  // "The only one" needs somebody else to have tried.
  const contested = (l) => !l.picks || Object.keys(l.picks).length > 1;
  const lone = clearLeader(tally(lines, (l) => (contested(l) && (l.got ?? []).length === 1 ? l.got : [])), { min: 2 });
  if (lone) out.push(award('Lone wolf', byId(lone.id), `The only one who saw it, ${lone.n} times`, { weight: 2 }));
  const streak = clearLeader(longestRuns(lines, (l) => l.got), { min: 3 });
  if (streak) out.push(award('Hot streak', byId(streak.id), `${streak.n} rounds in a row`));

  const wrong = (l) => Object.keys(l.picks ?? {}).filter((id) => !(l.got ?? []).includes(id));
  const contrary = clearLeader(tally(lines, (l) => wrong(l).filter((id) => (
    Object.values(l.picks).filter((card) => card === l.picks[id]).length === 1
  ))), { min: 2 });
  if (contrary) out.push(award('Contrarian', byId(contrary.id), `Picked a card nobody else touched, ${contrary.n} times`));

  if (reasonsOn) {
    const found = tally(lines, (l) => l.got);
    const named = tally(lines, (l) => l.reasons);
    const clueless = clearLeader(Object.fromEntries(Object.entries(found).filter(([id]) => !named[id])), { min: 3 });
    if (clueless) {
      out.push(award('Right for the wrong reason', byId(clueless.id),
        `Found it ${clueless.n} times, never knew why`, { roast: true }));
    }
  }
  const fooled = clearLeader(tally(lines, wrong), { min: 3 });
  if (fooled) out.push(award('Fooled again', byId(fooled.id), `Picked wrong ${fooled.n} times`, { roast: true }));
  return out.filter(Boolean);
}

/** The room emptied below ONLINE_MIN_PLAYERS: straight to the results. */
export function endGame(game) {
  if (game.phase === 'finished') return { patch: {} };
  return { patch: { phase: 'finished' } };
}

// ── Repair ───────────────────────────────────────────────────────────────
//
// RTDB drops empty objects and arrays and can return an array as an object
// keyed by index, so every value from a room passes through these before a
// rule sees it. Named fields only: a stray field from an older build never
// reaches the rules.

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

function normalizePick(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.card !== 'string') return null;
  const out = { card: raw.card, reason: numberOr(raw.reason, -1) };
  // Grading fields exist only after the reveal; a pick still waiting has none.
  if (raw.correct !== undefined) {
    out.correct = Boolean(raw.correct);
    out.reasonRight = Boolean(raw.reasonRight);
    out.delta = numberOr(raw.delta, 0);
  }
  return out;
}

export function normalizeGame(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const scores = {};
  for (const [id, s] of Object.entries(raw.scores ?? {})) scores[id] = numberOr(s, 0);
  const picks = {};
  for (const [id, p] of Object.entries(raw.picks ?? {})) {
    const pick = normalizePick(p);
    if (pick) picks[id] = pick;
  }
  return {
    order: listOf(raw.order),
    scores,
    rounds: numberOr(raw.rounds, 0),
    round: numberOr(raw.round, 0),
    phase: ['picking', 'revealed', 'finished'].includes(raw.phase) ? raw.phase : 'picking',
    picks,
    // RTDB drops empty arrays, inside a line as well as the log itself.
    log: listOf(raw.log)
      .filter((l) => l && typeof l === 'object')
      .map((l) => ({
        round: numberOr(l.round, 0),
        got: listOf(l.got),
        reasons: listOf(l.reasons),
        // Absent (not empty) on a line from before picks were logged, which
        // the awards read as "unknown" rather than "nobody picked".
        ...(l.picks && typeof l.picks === 'object' ? { picks: { ...l.picks } } : {}),
      })),
  };
}

function normalizeCard(raw) {
  if (!raw || typeof raw !== 'object' || !raw.key) return null;
  return {
    key: raw.key,
    name: raw.name ?? '',
    series: raw.series ?? '',
    imageUrl: raw.imageUrl ?? '',
    note: typeof raw.note === 'string' ? raw.note : '',
  };
}

function normalizeSet(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    kind: raw.kind ?? '',
    sentence: raw.sentence ?? '',
    odd: raw.odd ?? '',
    cards: listOf(raw.cards).map(normalizeCard).filter(Boolean),
    reasons: listOf(raw.reasons).filter((r) => typeof r === 'string'),
    reason: numberOr(raw.reason, -1),
  };
}

export function normalizeDeal(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    rounds: numberOr(raw.rounds, 0),
    size: numberOr(raw.size, 6),
    reasonsOn: raw.reasonsOn !== false,
    // No filter after the map: `round` indexes this list, so a set that failed
    // to repair stays a null at its own index rather than shifting the rest.
    sets: listOf(raw.sets).map(normalizeSet),
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
