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
// A "Groups of four" match (deal.mode 'groups', groups.js) is the same
// machine: a round is a board, and a pick is the player's whole sort —
//
//   { groups: [[four card keys] …], reasons: [reason index per group],
//     correct, reasonRight, delta, groupsRight, reasonsRight }
//
// where `correct` is the whole board right and `reasonRight` every reason
// too, so the awards, the reveal sound and the history read either mode.
//
// Everyone picks every round, in secret, and nothing settles until every
// player still here has locked in — the gate counts the ACTIVE roster, so a
// closed tab never wedges a room (settleIfComplete).

import { award, clearLeader, longestRuns, tally, times } from '../../shared/utils/awards';

/** A right pick. */
export const PICK_POINTS = 2;
/** A right reason, on top of a right pick — never on its own. */
export const REASON_POINTS = 1;
/** A group sorted right, in "Groups of four". Its reason adds REASON_POINTS. */
export const GROUP_POINTS = 2;
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

const isGroups = (deal) => deal?.mode === 'groups';

/**
 * One sort against a board: which of the player's groups match a true group
 * (as sets — the order of the four, and of the groups, never matters), and
 * which of those carry the true group's reason.
 */
export function gradeSort(set, pick, reasonsOn) {
  let groupsRight = 0;
  let reasonsRight = 0;
  (pick?.groups ?? []).forEach((g, i) => {
    const t = (set?.groups ?? []).find((tg) => tg.keys.length === g.length && g.every((k) => tg.keys.includes(k)));
    if (!t) return;
    groupsRight += 1;
    if (reasonsOn && pick.reasons?.[i] === t.reason) reasonsRight += 1;
  });
  const all = set?.groups?.length ?? 0;
  const correct = all > 0 && groupsRight === all;
  return {
    groupsRight,
    reasonsRight,
    correct,
    reasonRight: correct && reasonsOn && reasonsRight === all,
    delta: groupsRight * GROUP_POINTS + reasonsRight * REASON_POINTS,
  };
}

// Grades every pick in and moves to the reveal. Picks by players who have
// since left are graded too: they locked in fairly, and their points stand.
function settle(game, deal, picks) {
  const set = currentSet(game, deal);
  const scores = { ...game.scores };
  const graded = {};
  for (const [id, p] of Object.entries(picks)) {
    if (isGroups(deal)) {
      graded[id] = { ...p, ...gradeSort(set, p, deal.reasonsOn) };
    } else {
      const correct = Boolean(set) && p.card === set.odd;
      const reasonRight = correct && deal.reasonsOn && p.reason === set.reason;
      const delta = (correct ? PICK_POINTS : 0) + (reasonRight ? REASON_POINTS : 0);
      graded[id] = { ...p, correct, reasonRight, delta };
    }
    scores[id] = (scores[id] ?? 0) + graded[id].delta;
  }
  return { picks: graded, scores, phase: 'revealed' };
}

// A sort is refused unless it partitions the board exactly: as many groups as
// the board has, four cards each, every card once. Returns the clean pick or
// null.
function cleanSort(set, pick, reasonsOn) {
  const n = set.groups.length;
  const groups = listOf(pick?.groups).map((g) => listOf(g).map(String));
  if (groups.length !== n || groups.some((g) => g.length !== set.groups[0].keys.length)) return null;
  const keys = groups.flat();
  const board = new Set(set.cards.map((c) => c.key));
  if (new Set(keys).size !== board.size || keys.length !== board.size || !keys.every((k) => board.has(k))) return null;
  if (!reasonsOn) return { groups, reasons: [] };
  const reasons = listOf(pick?.reasons).map(Number);
  if (reasons.length !== n || !reasons.every((r) => Number.isInteger(r) && r >= 0 && r < set.reasons.length)) return null;
  return { groups, reasons };
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
  if (isGroups(deal)) {
    const sort = set ? cleanSort(set, pick, deal.reasonsOn) : null;
    if (!sort) return { patch: {} };
    const sorts = { ...game.picks, [playerId]: sort };
    const all = game.order.filter((id) => activeIds.includes(id)).every((id) => sorts[id]);
    return { patch: all ? settle(game, deal, sorts) : { picks: sorts } };
  }
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
//
// A board's line carries `sorted` (each player's groups right) instead of
// `picks`: a sort has no one card to name, so the awards that quote a card
// skip it.
function logLine(game) {
  const picks = Object.entries(game.picks ?? {});
  const line = {
    round: game.round,
    got: picks.filter(([, p]) => p.correct).map(([id]) => id),
    reasons: picks.filter(([, p]) => p.reasonRight).map(([id]) => id),
  };
  if (picks.some(([, p]) => p?.groups)) {
    return { ...line, sorted: Object.fromEntries(picks.map(([id, p]) => [id, p.groupsRight ?? 0])) };
  }
  return { ...line, picks: Object.fromEntries(picks.filter(([, p]) => p?.card != null).map(([id, p]) => [id, String(p.card)])) };
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
 * The final screen's superlatives, from the log: five good, five roasts, each
 * a clear leader or nothing (a tie drops it rather than picking by seat). The
 * card (shared/utils/awards.js's pickAwards) shows two of each. `nameOf(round,
 * key)` names a dealt card and `oddOf(round)` the round's odd one out, for the
 * detail lines. Lines from before `picks` was logged skip the awards that
 * need it.
 *
 *   Lone wolf                   the only one who found it
 *   Full marks                  the only one with the odd one AND its reason
 *                               (every group and every reason, on a board)
 *   Perfect game                found every odd one out, three rounds or more
 *                               (every board, two boards or more)
 *   Hot streak                  the most rounds in a row found (three or more)
 *   Against the grain           right, while everyone else fell for one card
 *   Fooled again                the most wrong picks (three or more, roast)
 *   Contrarian                  a wrong card nobody else touched (roast)
 *   Right for the wrong reason  found it three times or more, never named why (roast)
 *   Herd mentality              fell for a card with two others or more (roast)
 *   Blind spot                  the only one who missed it (roast)
 *
 * A "Groups of four" match is one mode throughout, so its lines (`sorted`
 * instead of `picks`) change the words — "sorted board 2", not "spotted
 * Denji" — and skip the three awards that quote a wrong card.
 */
export function outAwards(log = [], players = [], { reasonsOn = false, nameOf = () => '', oddOf = () => '' } = {}) {
  const byId = (id) => players.find((p) => p.id === id) ?? null;
  const lines = (log ?? []).filter(Boolean);
  const groups = lines.some((l) => l.sorted);
  const unit = groups ? 'board' : 'round';
  const card = (l, key) => nameOf(l.round, key) || 'a card';
  const odd = (l) => oddOf(l.round) || 'the odd one';
  const board = (l) => `board ${l.round + 1}`;
  const latest = (list, id) => list.filter((x) => x.by === id).at(-1);
  const out = [];

  // Who played a line: its picks or its sorts. Neither on a line from before
  // picks were logged, which the awards read as "unknown".
  const playedOf = (l) => l.picks ?? l.sorted ?? null;
  // "The only one" needs somebody else to have tried.
  const contested = (l) => !playedOf(l) || Object.keys(playedOf(l)).length > 1;
  const solos = lines.filter((l) => contested(l) && (l.got ?? []).length === 1).map((l) => ({ by: l.got[0], l }));
  const lone = clearLeader(tally(solos, (x) => x.by));
  if (lone) {
    const l = latest(solos, lone.id).l;
    out.push(award('Lone wolf', byId(lone.id), lone.n === 1
      ? (groups ? `The only one who sorted ${board(l)}` : `The only one who spotted ${odd(l)}`)
      : `The only one who saw it, ${times(lone.n, unit)}`, { weight: 2 }));
  }
  if (reasonsOn) {
    const fulls = lines.filter((l) => contested(l) && (l.reasons ?? []).length === 1).map((l) => ({ by: l.reasons[0], l }));
    const full = clearLeader(tally(fulls, (x) => x.by));
    if (full) {
      const l = latest(fulls, full.id).l;
      let detail;
      if (groups) {
        detail = full.n === 1
          ? `The only one with every group and every reason on ${board(l)}`
          : `Every group and every reason, alone, ${times(full.n, 'board')}`;
      } else {
        detail = full.n === 1 ? `The only one who knew why ${odd(l)} was out` : `The only one who knew why, ${times(full.n, 'round')}`;
      }
      out.push(award('Full marks', byId(full.id), detail, { weight: 2 }));
    }
  }
  if (lines.length >= (groups ? 2 : 3)) {
    const perfect = players.filter((p) => lines.every((l) => (l.got ?? []).includes(p.id)));
    if (perfect.length === 1) {
      out.push(award('Perfect game', perfect[0], groups
        ? `Sorted all ${lines.length} boards`
        : `Found the odd one out all ${lines.length} rounds`, { weight: 3 }));
    }
  }
  const streak = clearLeader(longestRuns(lines, (l) => l.got), { min: 3 });
  if (streak) out.push(award('Hot streak', byId(streak.id), `${streak.n} ${unit}s in a row`));

  const wrongOf = (l) => Object.keys(playedOf(l) ?? {}).filter((id) => !(l.got ?? []).includes(id));
  // The card-quoting awards read only lines that name each player's card.
  const carded = lines.filter((l) => l.picks);
  const sameAs = (l, id) => Object.values(l.picks).filter((k) => k === l.picks[id]).length;
  // Right, while every other player picked one and the same wrong card.
  const grains = carded.filter((l) => (l.got ?? []).length === 1 && wrongOf(l).length >= 2
    && new Set(wrongOf(l).map((id) => l.picks[id])).size === 1).map((l) => ({ by: l.got[0], l }));
  const grain = clearLeader(tally(grains, (x) => x.by));
  if (grain) {
    const { l } = latest(grains, grain.id);
    out.push(award('Against the grain', byId(grain.id), `Picked ${odd(l)} while everyone else fell for ${card(l, l.picks[wrongOf(l)[0]])}`));
  }

  const fooled = clearLeader(tally(lines, wrongOf), { min: 3 });
  if (fooled) {
    out.push(award('Fooled again', byId(fooled.id), groups
      ? `Missed ${fooled.n} boards`
      : `Picked wrong ${fooled.n} times`, { roast: true }));
  }
  const odds = carded.flatMap((l) => wrongOf(l).filter((id) => sameAs(l, id) === 1).map((by) => ({ by, l })));
  const contrary = clearLeader(tally(odds, (x) => x.by));
  if (contrary) {
    const { l } = latest(odds, contrary.id);
    out.push(award('Contrarian', byId(contrary.id), contrary.n === 1
      ? `Picked ${card(l, l.picks[contrary.id])} — nobody else did, and with reason`
      : `Picked a card nobody else touched, ${times(contrary.n)}`, { roast: true }));
  }
  if (reasonsOn) {
    const found = tally(lines, (l) => l.got);
    const named = tally(lines, (l) => l.reasons);
    const clueless = clearLeader(Object.fromEntries(Object.entries(found).filter(([id]) => !named[id])), { min: 3 });
    if (clueless) out.push(award('Right for the wrong reason', byId(clueless.id), `Found it ${clueless.n} times, never knew why`, { roast: true }));
  }
  const herds = carded.flatMap((l) => wrongOf(l).filter((id) => sameAs(l, id) >= 3).map((by) => ({ by, l })));
  const herd = clearLeader(tally(herds, (x) => x.by));
  if (herd) {
    const { l } = latest(herds, herd.id);
    out.push(award('Herd mentality', byId(herd.id), `Fell for ${card(l, l.picks[herd.id])} with ${sameAs(l, herd.id) - 1} others`, { roast: true }));
  }
  const blinds = lines.filter((l) => wrongOf(l).length === 1 && (l.got ?? []).length >= 2).map((l) => ({ by: wrongOf(l)[0], l }));
  const blind = clearLeader(tally(blinds, (x) => x.by));
  if (blind) {
    const l = latest(blinds, blind.id).l;
    out.push(award('Blind spot', byId(blind.id), blind.n === 1
      ? `The only one who missed ${groups ? board(l) : odd(l)}`
      : `The only one who missed it, ${times(blind.n, unit)}`, { roast: true }));
  }
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
  if (!raw || typeof raw !== 'object') return null;
  let out;
  if (raw.groups) {
    // A sort: nested arrays, either of which RTDB may hand back as an object
    // keyed by index. `reasons` is absent with reasons off (an empty array is
    // not stored).
    out = { groups: listOf(raw.groups).map((g) => listOf(g).map(String)), reasons: listOf(raw.reasons).map((r) => numberOr(r, -1)) };
  } else if (typeof raw.card === 'string') {
    out = { card: raw.card, reason: numberOr(raw.reason, -1) };
  } else return null;
  // Grading fields exist only after the reveal; a pick still waiting has none.
  if (raw.correct !== undefined) {
    out.correct = Boolean(raw.correct);
    out.reasonRight = Boolean(raw.reasonRight);
    out.delta = numberOr(raw.delta, 0);
    if (raw.groups) {
      out.groupsRight = numberOr(raw.groupsRight, 0);
      out.reasonsRight = numberOr(raw.reasonsRight, 0);
    }
  }
  return out;
}

const countsOf = (raw) => Object.fromEntries(Object.entries(raw).map(([id, n]) => [id, numberOr(n, 0)]));

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
        // A board's line. A board everyone missed still has every player at
        // 0, which RTDB keeps (only empty objects are dropped).
        ...(l.sorted && typeof l.sorted === 'object' ? { sorted: countsOf(l.sorted) } : {}),
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

function normalizeGroup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    kind: raw.kind ?? '',
    sentence: raw.sentence ?? '',
    keys: listOf(raw.keys).map(String),
    reason: numberOr(raw.reason, -1),
  };
}

function normalizeSet(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.groups) {
    return {
      groups: listOf(raw.groups).map(normalizeGroup).filter(Boolean),
      cards: listOf(raw.cards).map(normalizeCard).filter(Boolean),
      reasons: listOf(raw.reasons).filter((r) => typeof r === 'string'),
    };
  }
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
    // Absent on a deal from before the groups mode: odd one out.
    mode: raw.mode === 'groups' ? 'groups' : 'odd',
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
