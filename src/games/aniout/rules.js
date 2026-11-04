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
// one out and who also named the reason. Plain ids, so it survives RTDB.
function logLine(game) {
  const picks = Object.entries(game.picks ?? {});
  return {
    round: game.round,
    got: picks.filter(([, p]) => p.correct).map(([id]) => id),
    reasons: picks.filter(([, p]) => p.reasonRight).map(([id]) => id),
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
 * The final screen's superlatives, from the log: a clear leader or nothing (a
 * tie drops the award rather than picking one by seat).
 *
 *   Sharpest eye   the most odd ones out found (two or more)
 *   Mind reader    the most reasons named (two or more, reasons on)
 */
export function outAwards(log = [], players = []) {
  const byId = (id) => players.find((p) => p.id === id) ?? null;
  const leader = (field) => {
    const counts = {};
    for (const line of log ?? []) for (const id of line?.[field] ?? []) counts[id] = (counts[id] ?? 0) + 1;
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!ranked.length || ranked[0][1] < 2 || ranked[1]?.[1] === ranked[0][1]) return null;
    return { player: byId(ranked[0][0]), n: ranked[0][1] };
  };
  const out = [];
  const eye = leader('got');
  if (eye?.player) out.push({ title: 'Sharpest eye', player: eye.player, detail: `Found the odd one out ${eye.n} times` });
  const reader = leader('reasons');
  if (reader?.player) out.push({ title: 'Mind reader', player: reader.player, detail: `Named the reason ${reader.n} times` });
  return out;
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
      .map((l) => ({ round: numberOr(l.round, 0), got: listOf(l.got), reasons: listOf(l.reasons) })),
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
