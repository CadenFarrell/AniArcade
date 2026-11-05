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
// argument (server time online), so tests pin it. Locally the auction runs with
// `now = null`, which leaves the naming clock UNSTARTED (deadlineAt null) until
// the namer has the device and presses "Start my clock" (beginNaming): the
// last drop-out used to start the minute while the phone was still in someone
// else's hands.
//
// **The table rules by majority online** (judgeAnswer's `vote`). Everyone but
// the namer scores when a bid falls short, so one judge settling a name alone
// was a judge paid to say no. Each judge votes; a name is accepted once half
// the judges say yes (a tie goes to the namer) and rejected once more than half
// say no. Locally the table rules in person and one tap stands for it.

import { award, clearBest, clearLeader, sumBy, tally as countIds, times } from '../../shared/utils/awards';

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
    log: [],
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

// Nobody left to raise: the high bidder names. With no `now` (local play) the
// clock waits for beginNaming.
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
  // A clocked game whose clock has not started: the namer has not taken the device yet.
  if (now != null && game.deadlineAt == null) return { patch: {} };
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

/**
 * Local play: the namer has the device and starts the clock. Only once — a
 * second press (or a clock already running) is refused.
 */
export function beginNaming(game, playerId, now) {
  if (game.phase !== 'naming' || game.bid?.by !== playerId || game.deadlineAt != null || now == null) return { patch: {} };
  return { patch: { deadlineAt: now + game.namingMs } };
}

/**
 * The namer disputes a name the arcade marked wrong. Its facts are per
 * franchise (one studio, one debut year for every season), so "animated by
 * MAPPA" can rule out an Attack on Titan season MAPPA did animate. The name
 * goes to the table as pending. Only the namer may, only while naming (after
 * the clock a short round has already settled), and never on a name the table
 * itself rejected or on a repeat.
 */
export function challengeAnswer(game, playerId, index) {
  if (game.phase !== 'naming' || game.bid?.by !== playerId) return { patch: {} };
  const a = game.answers?.[index];
  if (!a || a.verdict !== 'wrong' || a.why === 'table said no') return { patch: {} };
  const answers = game.answers.map((x, i) => (i === index ? { ...x, verdict: 'pending', why: 'challenged', votes: {} } : x));
  return { patch: { answers } };
}

/** The bidder stops early ("Done"), or anyone once the clock has run out. */
export function stopNaming(game, playerId, activeIds = null, now = null) {
  if (game.phase !== 'naming') return { patch: {} };
  const expired = now != null && game.deadlineAt != null && now >= game.deadlineAt + NAME_GRACE_MS;
  if (playerId !== game.bid.by && !expired) return { patch: {} };
  return { patch: afterNaming(game, activeIds) };
}

/** Who rules on pending answers: everyone here but the bidder, or the bidder alone when nobody else is. */
export function judgesFor(game, activeIds = null) {
  const others = live(game, activeIds).filter((id) => id !== game.bid?.by);
  return others.length ? others : [game.bid?.by].filter(Boolean);
}

/** Who may rule on a pending answer: anyone but the bidder, unless nobody else is here. */
export function canJudge(game, playerId, activeIds = null) {
  if (game.phase !== 'review') return false;
  return judgesFor(game, activeIds).includes(playerId);
}

/**
 * A pending answer's votes, counted over the judges here now: 'right' once at
 * least half say yes (a tie goes to the namer, since the arcade not knowing a
 * name is no reason to doubt it), 'wrong' once more than half say no, else
 * null. A judge who left stops counting, so their leaving can decide a vote.
 */
export function tally(answer, judges) {
  const n = judges.length;
  if (!n) return null;
  const votes = answer?.votes ?? {};
  const yes = judges.filter((id) => votes[id] === true).length;
  const no = judges.filter((id) => votes[id] === false).length;
  if (yes > 0 && yes * 2 >= n) return 'right';
  if (no * 2 > n) return 'wrong';
  return null;
}

const ruled = (a, verdict) => ({ ...a, verdict, why: verdict === 'right' ? 'table' : 'table said no' });

// After any ruling, the bid reached or too few pending left to reach it ends
// the round, so nobody votes on answers that can no longer matter.
function afterRuling(game, answers, activeIds) {
  const next = { ...game, answers };
  const right = rightCount(answers);
  if (right >= game.bid.n) return { patch: { answers, ...settle(next, true, activeIds) } };
  if (right + pendingCount(answers) < game.bid.n) return { patch: { answers, ...settle(next, false, activeIds) } };
  return { patch: { answers } };
}

/**
 * The table rules on one pending answer. Locally (`vote` false) one tap is the
 * table's ruling. Online each judge casts a vote, which they may change until
 * `tally` decides the name.
 */
export function judgeAnswer(game, playerId, index, accept, activeIds = null, { vote = false } = {}) {
  if (!canJudge(game, playerId, activeIds) || game.answers?.[index]?.verdict !== 'pending') return { patch: {} };
  if (!vote) {
    return afterRuling(game, game.answers.map((a, i) => (i === index ? ruled(a, accept ? 'right' : 'wrong') : a)), activeIds);
  }
  const judges = judgesFor(game, activeIds);
  const answers = game.answers.map((a, i) => {
    if (i !== index) return a;
    const cast = { ...a, votes: { ...(a.votes ?? {}), [playerId]: Boolean(accept) } };
    const verdict = tally(cast, judges);
    return verdict ? ruled(cast, verdict) : cast;
  });
  return afterRuling(game, answers, activeIds);
}

// Every voted pending answer re-counted over the judges here now (one left).
function recount(game, activeIds) {
  const judges = judgesFor(game, activeIds);
  let moved = false;
  const answers = game.answers.map((a) => {
    if (a.verdict !== 'pending' || !a.votes || !Object.keys(a.votes).length) return a;
    const verdict = tally(a, judges);
    if (!verdict) return a;
    moved = true;
    return ruled(a, verdict);
  });
  return moved ? afterRuling(game, answers, activeIds) : { patch: {} };
}

// `{ [field]: text }` for an answer, or nothing — RTDB stores no empty keys.
const quoteOf = (a, field) => (a?.text ? { [field]: String(a.text).slice(0, 60) } : {});

/** From the reveal to the next round (the opener moves one seat), or the end. */
export function nextRound(game, activeIds = null) {
  if (game.phase !== 'revealed') return { patch: {} };
  // The round just revealed, for the final screen's recap: the category is
  // `deal.cats[round]`, so only the result itself is kept — plus, for the
  // awards, the bidder's wrong names and repeats and who passed in the bidding.
  const r = game.result;
  const answers = game.answers ?? [];
  const log = [...(game.log ?? []), {
    round: game.round, by: r?.by ?? null, n: r?.n ?? 0, made: Boolean(r?.made), count: r?.count ?? 0, void: r?.void ?? null,
    wrong: answers.filter((a) => a.verdict === 'wrong').length,
    repeats: answers.filter((a) => a.verdict === 'repeat').length,
    passed: Object.keys(game.passed ?? {}).filter((id) => game.passed[id]),
    // The words, for the awards to quote: the latest wrong name and repeat,
    // and the names the table let in that the arcade could not vouch for.
    ...quoteOf(answers.filter((a) => a.verdict === 'wrong').at(-1), 'wrongText'),
    ...quoteOf(answers.filter((a) => a.verdict === 'repeat').at(-1), 'repeatText'),
    saved: answers.filter((a) => a.verdict === 'right' && a.why === 'table').map((a) => String(a.text).slice(0, 60)),
  }];
  if (game.round + 1 >= game.rounds) return { patch: { phase: 'finished', log } };
  const seats = live(game, activeIds);
  const at = game.order.indexOf(game.opener);
  let opener = seats[0] ?? game.order[0];
  for (let step = 1; step <= game.order.length; step++) {
    const id = game.order[(at + step) % game.order.length];
    if (seats.includes(id)) { opener = id; break; }
  }
  return { patch: { round: game.round + 1, log, ...roundReset(opener) } };
}

/**
 * The final screen's superlatives, from the log: five good, five roasts, each
 * a clear leader or nothing (a tie drops it rather than picking by seat). The
 * card (shared/utils/awards.js's pickAwards) shows two of each.
 * `categoryOf(round)` names the round's category for the detail lines. Lines
 * from before the answer details were logged skip the awards that need them.
 *
 *   Big talker          the biggest bid that was made
 *   Flawless            a bid made without one wrong name or repeat (4+)
 *   Objection!          names the arcade could not vouch for, that the table let in
 *   True to their word  won two bids or more and made every one
 *   Freeloader          the most points banked off other bidders falling short (2+ rounds)
 *   Overreach           the biggest bid that fell short (roast)
 *   Not even close      a wrong name, quoted (roast)
 *   Broken record       a name said twice, quoted (roast)
 *   Chicken             the most passes in the bidding (3+, roast)
 *   Wallflower          the only player never to win a bid, over three rounds (roast)
 */
export function nameAwards(log = [], players = [], { categoryOf = () => '' } = {}) {
  const byId = (id) => players.find((p) => p.id === id) ?? null;
  const lines = (log ?? []).filter((l) => l && !l.void && l.by);
  const on = (l) => (categoryOf(l.round) ? ` on ${categoryOf(l.round)}` : '');
  const forCat = (l) => (categoryOf(l.round) ? ` for ${categoryOf(l.round)}` : '');
  const latest = (list, id) => list.filter((l) => l.by === id).at(-1);
  const out = [];

  const made = clearBest(lines.filter((l) => l.made), (l) => l.n);
  if (made) out.push(award('Big talker', byId(made.by), `Bid ${made.n}${on(made)} and named them all`, { weight: 2 }));
  const clean = clearBest(lines.filter((l) => l.made && l.n >= 4 && l.wrong === 0 && l.repeats === 0), (l) => l.n);
  if (clean) out.push(award('Flawless', byId(clean.by), `Named ${clean.n}${forCat(clean)} without a slip`, { weight: 2 }));
  const saves = lines.flatMap((l) => (l.saved ?? []).map((text) => ({ by: l.by, text })));
  const saved = clearLeader(countIds(saves, (s) => s.by));
  if (saved) {
    out.push(award('Objection!', byId(saved.id), saved.n === 1
      ? `Talked the table into “${latest(saves, saved.id).text}”`
      : `Talked the table into ${saved.n} names`));
  }
  const won = countIds(lines, (l) => l.by);
  const kept = players.filter((p) => won[p.id] >= 2 && lines.every((l) => l.by !== p.id || l.made));
  const word = clearLeader(Object.fromEntries(kept.map((p) => [p.id, won[p.id]])));
  if (word) out.push(award('True to their word', byId(word.id), `Made all ${word.n} of their bids`));

  // A bid that fell short pays everyone else at the table.
  const shorts = lines.filter((l) => !l.made);
  const free = clearLeader(sumBy(shorts, (l) => Object.fromEntries(
    players.filter((p) => p.id !== l.by).map((p) => [p.id, missPoints(l.n)]),
  )));
  if (free && shorts.filter((l) => l.by !== free.id).length >= 2) {
    out.push(award('Freeloader', byId(free.id), `Banked ${free.n} off other people falling short`));
  }

  const short = clearBest(shorts, (l) => l.n);
  if (short) out.push(award('Overreach', byId(short.by), `Bid ${short.n}${on(short)}, named ${short.count}`, { roast: true }));
  const wrongs = lines.filter((l) => l.wrongText);
  const butter = clearLeader(sumBy(lines, (l) => ({ [l.by]: l.wrong })));
  if (butter) {
    const l = latest(wrongs, butter.id);
    out.push(award('Not even close', byId(butter.id), l
      ? `Said “${l.wrongText}”${forCat(l)}`
      : `${butter.n} wrong names`, { roast: true }));
  }
  const repeats = lines.filter((l) => l.repeatText);
  const record = clearLeader(sumBy(lines, (l) => ({ [l.by]: l.repeats })));
  if (record) {
    const l = latest(repeats, record.id);
    out.push(award('Broken record', byId(record.id), l ? `Said “${l.repeatText}” twice` : 'Said the same name twice', { roast: true }));
  }
  const chicken = clearLeader(countIds((log ?? []).filter(Boolean), (l) => l.passed ?? []), { min: 3 });
  if (chicken) out.push(award('Chicken', byId(chicken.id), `Passed ${times(chicken.n)} in the bidding`, { roast: true }));
  if (lines.length >= 3 && players.length >= 3) {
    const bidders = new Set(lines.map((l) => l.by));
    const never = players.filter((p) => !bidders.has(p.id));
    if (never.length === 1) out.push(award('Wallflower', never[0], `Never won a bid in ${lines.length} rounds`, { roast: true }));
  }
  return out.filter(Boolean);
}

/**
 * Re-checks the round after the roster changed:
 *   - bidding, and the seat whose turn it is has gone: they drop out (or,
 *     before any bid, the opening moves to the next seat here);
 *   - bidding, and the high bidder has gone: the auction starts over;
 *   - naming or review, and the bidder has gone: the round is void;
 *   - review, and a judge has gone: every voted pending name is re-counted
 *     without them, which can decide it (and the round).
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
  if (game.phase === 'review') return recount(game, activeIds);
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
    // RTDB drops an empty object, so a pending name with no votes yet reads
    // back without the key at all.
    votes: Object.fromEntries(Object.entries(raw.votes ?? {}).filter(([, v]) => typeof v === 'boolean')),
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
    log: listOf(raw.log).filter((l) => l && typeof l === 'object').map((l) => ({
      round: numberOr(l.round, 0), by: l.by ?? null, n: numberOr(l.n, 0), made: Boolean(l.made),
      count: numberOr(l.count, 0), void: l.void === 'left' ? 'left' : null,
      wrong: numberOr(l.wrong, 0), repeats: numberOr(l.repeats, 0),
      passed: listOf(l.passed).filter((id) => typeof id === 'string'),
      ...(typeof l.wrongText === 'string' ? { wrongText: l.wrongText } : {}),
      ...(typeof l.repeatText === 'string' ? { repeatText: l.repeatText } : {}),
      saved: listOf(l.saved).filter((t) => typeof t === 'string'),
    })),
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
