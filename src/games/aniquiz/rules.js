// Pure AniQuiz rules: picking from the board, wagers, answering, scoring and
// advancing. No React, no storage, no network — the local hook keeps the state
// in useState and the online hook in a Firebase transaction, and both call
// exactly these functions, so the two can never disagree about a score.
//
// Two objects, and the split is AniTune's `round`/`game` one:
//
//   deal  what was dealt — the board or the quiz questions, the Daily Double,
//         the final. Written once and never changed.
//   game  everything that moves — whose pick it is, which cells are gone, the
//         answers to the clue on screen, the scores.
//
// Online, every answer is a transaction on `game`, and keeping the thirty clues
// (each with its accept list and options) out of it is what keeps those writes
// small. Every rule therefore takes the deal as an argument rather than
// finding the clue inside the game.
//
// **One player answers each clue: whoever's turn it is.** On the board the
// turn picks a cell and answers it; in a quick quiz each question goes to the
// next seat. Everyone else watches. The clue's `solo` names that player, the
// same field the Daily Double always used, so every gate that already waited
// on one player for a Daily Double now does so for every clue. The final is
// the exception: everyone with a stake wagers and answers it, privately.
//
// **A miss costs the clue's value.** Classic quiz-show scoring, and it works
// here because the answer is one player's choice: they took the clue, so a
// wrong answer, a pass and a blank at the clock all lose what a right answer
// would have won (sitting out the clock is never the safe play). Scores can go
// below zero. It replaced "everyone answers, a miss is free" (2026-11-03) —
// with the whole table answering at once a penalty mostly punished guessing,
// which is why the old rule had none.
//
// **Time.** Nothing here reads a clock. A rule that needs "now" takes it as an
// argument, already corrected for server skew, and stores absolute instants —
// see anitune/rules.js for why. `now == null` means "no clock", which is how
// local play asks for no shared deadline: there the clock belongs to whoever is
// holding the device, and starts when they take it (see LocalRound.jsx).
import { BOARD_VALUES, ROWS, asArray, isCorrect, normalizeClue, parseCell } from './clues';
import { award, clearBest, clearLeader, tally, times } from '../../shared/utils/awards';

export const BOARD = 'board';
export const QUIZ = 'quiz';
export const CHOICE = 'choice';
export const TYPED = 'typed';

// Phases:
//   board      — the picker chooses a cell
//   wager      — a Daily Double's picker, or (round 'final') everyone, sets a stake
//   answering  — the clue is up and the required players are answering
//   revealed   — the answer is out and this clue's scores are final
//   finished   — the game is over

// A timed clue reveals this long AFTER its deadline. At the deadline every
// device with an answer in flight is still writing it, and revealing on the
// same instant scores as blank an answer the player can see they sent. The
// same gap AniWave's REVEAL_GRACE_MS exists for.
export const REVEAL_GRACE_MS = 1000;

// The most a Daily Double can be worth to somebody who has not yet earned that
// much. Without a floor a player on zero finds the Daily Double and can wager
// nothing, which is the one clue on the board designed to be a swing.
export const DD_FLOOR = BOARD_VALUES[BOARD_VALUES.length - 1];

const deadlineFor = (game, now) => (game.timed && game.answerMs && now != null ? now + game.answerMs : null);

// The per-clue fields, reset whenever a new clue comes up.
const clueReset = () => ({ cell: null, solo: null, answers: {}, wagers: {}, deadlineAt: null });

/**
 * A fresh game over `playerIds`, in seat order.
 *
 * `options` carries only what a rule acts on. How the pool was drawn, whether
 * clues are typed or chosen, how many columns — all of that decided the deal
 * and is already baked into it.
 */
export function startGame(playerIds, deal, { timed = false, answerSeconds = 30 } = {}, now = null) {
  const game = {
    order: [...playerIds],
    scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
    timed: Boolean(timed),
    answerMs: timed ? answerSeconds * 1000 : null,
    round: 'main',
    used: {},
    picks: 0,
    pickerId: playerIds[0] ?? null,
    index: 0,
    // One line per revealed clue (logLine), for the final screen's awards:
    // `answers` is reset with every new clue, so this is all that survives.
    log: [],
    ...clueReset(),
  };
  if (deal.format === QUIZ) {
    return { ...game, phase: 'answering', solo: game.pickerId, deadlineAt: deadlineFor(game, now) };
  }
  return { ...game, phase: 'board' };
}

// ── Reading the state ──────────────────────────────────────────────────────

/** The clue the game is currently about, or null on the board. */
export function currentClue(game, deal) {
  if (!game || !deal) return null;
  if (game.round === 'final') return deal.final ?? null;
  if (deal.format === QUIZ) return deal.questions?.[game.index] ?? null;
  const at = parseCell(game.cell);
  if (!at) return null;
  return deal.categories?.[at.col]?.clues?.[at.row] ?? null;
}

/** Whether the clue on screen was wagered on rather than worth its face value. */
export function isWagered(game, deal) {
  if (game?.round === 'final') return true;
  return game?.cell != null && game.cell === deal?.dailyDouble;
}

export const isDailyDouble = (game, deal) => game?.round !== 'final' && isWagered(game, deal);

export const totalCells = (deal) => (deal?.categories?.length ?? 0) * ROWS;
export const cellsLeft = (game, deal) => totalCells(deal) - Object.keys(game?.used ?? {}).length;

/**
 * Who this phase is waiting on.
 *
 * `activeIds` is the room's present roster, in the order the caller wants them
 * asked (locally, everyone; online, whoever presence still counts). A Daily
 * Double waits on its finder alone; the final's answers wait only on those who
 * wagered, because a player who was gone during the wagers has no stake to win
 * or lose and nothing to answer for.
 */
export function requiredIds(game, activeIds) {
  if (!game) return [];
  if (game.solo) return [game.solo];
  if (game.round === 'final' && game.phase === 'answering') {
    return activeIds.filter((id) => game.wagers?.[id] != null);
  }
  return [...activeIds];
}

/** Who still has to act in this phase, in `activeIds` order — local play's pass order. */
export function stillToAct(game, activeIds) {
  if (!game) return [];
  const need = requiredIds(game, activeIds);
  if (game.phase === 'wager') return need.filter((id) => game.wagers?.[id] == null);
  if (game.phase === 'answering') return need.filter((id) => !game.answers?.[id]);
  return [];
}

/** The most `playerId` may stake right now. */
export function wagerLimit(game, playerId) {
  const score = game?.scores?.[playerId] ?? 0;
  if (game?.round === 'final') return Math.max(score, 0);
  return Math.max(score, DD_FLOOR);
}

// ── The board ──────────────────────────────────────────────────────────────

/**
 * The picker takes a cell, and the clue is theirs to answer. A Daily Double
 * goes to their wager first; anything else opens straight away.
 *
 * The cell is marked used the moment it is picked, not when it is revealed: a
 * cell is spent by being opened, and marking it later would leave a window in
 * which a second tap (or a second device) could open it again.
 */
export function pickCell(game, deal, playerId, cell, now = null) {
  if (game.phase !== 'board' || playerId !== game.pickerId) return { patch: {} };
  const at = parseCell(cell);
  if (!at || game.used?.[cell] || !deal.categories?.[at.col]?.clues?.[at.row]) return { patch: {} };
  const used = { ...game.used, [cell]: true };

  if (cell === deal.dailyDouble) {
    return { patch: { ...clueReset(), phase: 'wager', cell, used, solo: playerId } };
  }
  return {
    patch: { ...clueReset(), phase: 'answering', cell, used, solo: playerId, deadlineAt: deadlineFor(game, now) },
  };
}

/**
 * One wager. Clamped rather than refused, because the screen already limits
 * the input and a value that slipped past it (a stale limit after a score
 * changed) should still play rather than strand the round on a rejected write.
 */
export function placeWager(game, deal, playerId, amount, activeIds, now = null) {
  if (game.phase !== 'wager') return { patch: {} };
  if (!requiredIds(game, activeIds).includes(playerId) || game.wagers?.[playerId] != null) return { patch: {} };
  const stake = Math.min(wagerLimit(game, playerId), Math.max(0, Math.floor(Number(amount) || 0)));
  const wagers = { ...game.wagers, [playerId]: stake };
  return { patch: { wagers, ...openIfWagered({ ...game, wagers }, activeIds, now) } };
}

// Once everyone the wager phase is waiting on has staked, the clue opens.
function openIfWagered(game, activeIds, now) {
  const need = requiredIds(game, activeIds);
  if (need.some((id) => game.wagers?.[id] == null)) return {};
  return { phase: 'answering', answers: {}, deadlineAt: deadlineFor(game, now) };
}

// ── Answering ──────────────────────────────────────────────────────────────

/**
 * Turns the answers in hand into points. Every path to 'revealed' goes through
 * here, so the reveal's "+400" and the scoreboard's total are one computation.
 * Each answer carries its own `delta` for that reason: the reveal reads it
 * rather than re-deriving it.
 */
function settle(game, deal, answers) {
  const clue = currentClue(game, deal);
  const wagered = isWagered(game, deal);
  const scores = { ...game.scores };
  const graded = {};
  for (const [id, a] of Object.entries(answers)) {
    // The same either way now: a wager is the stake the player chose, a clue's
    // face value the stake they took by answering it.
    const stake = wagered ? (game.wagers?.[id] ?? 0) : (clue?.value ?? 0);
    const delta = a.correct ? stake : -stake;
    scores[id] = (scores[id] ?? 0) + delta;
    graded[id] = { ...a, delta };
  }
  const line = logLine(game, deal, clue, wagered, graded);
  return { phase: 'revealed', answers: graded, scores, deadlineAt: null, log: [...(game.log ?? []), line] };
}

const TOP_VALUE = Math.max(...BOARD_VALUES);
const BOTTOM_VALUE = Math.min(...BOARD_VALUES);

// The revealed clue as the awards need it, kept small — it rides every reveal's
// transaction (see the header on keeping `game` writes light). Per answerer:
// right or not, the points it moved, whether it was blank (a pass or the
// clock), and on a wager the stake and the score it was staked from. No
// undefined anywhere: RTDB refuses a write carrying one.
function logLine(game, deal, clue, wagered, graded) {
  const answers = {};
  for (const [id, a] of Object.entries(graded)) {
    answers[id] = {
      correct: Boolean(a.correct),
      delta: a.delta,
      blank: !a.correct && !String(a.text ?? '').trim(),
      ...(wagered ? { wager: game.wagers?.[id] ?? 0, before: game.scores?.[id] ?? 0 } : {}),
    };
  }
  return {
    final: game.round === 'final',
    dd: isDailyDouble(game, deal),
    top: !wagered && deal?.format !== QUIZ && clue?.value === TOP_VALUE,
    low: !wagered && deal?.format !== QUIZ && clue?.value === BOTTOM_VALUE,
    // The answer, for the awards to say which clue it was.
    answer: String(clue?.answer ?? '').slice(0, 60),
    answers,
  };
}

/** One player's answer. Graded now, hidden by the screens until the reveal. */
export function submitAnswer(game, deal, playerId, text, activeIds) {
  if (game.phase !== 'answering' || game.answers?.[playerId]) return { patch: {} };
  if (!requiredIds(game, activeIds).includes(playerId)) return { patch: {} };
  const clue = currentClue(game, deal);
  const answers = {
    ...game.answers,
    [playerId]: { text: String(text ?? ''), correct: isCorrect(clue, String(text ?? '')), delta: 0 },
  };
  const done = requiredIds(game, activeIds).every((id) => answers[id]);
  return { patch: done ? settle(game, deal, answers) : { answers } };
}

/**
 * The clock ran out. Everyone still owing an answer is recorded as blank, and
 * a blank is a miss — it loses the clue's value (or the stake), or sitting out
 * the clock would be the safe play on every clue.
 */
export function expireClue(game, deal, activeIds) {
  if (game.phase !== 'answering' || game.deadlineAt == null) return { patch: {} };
  const answers = { ...game.answers };
  for (const id of requiredIds(game, activeIds)) {
    if (!answers[id]) answers[id] = { text: '', correct: false, delta: 0 };
  }
  return { patch: settle(game, deal, answers) };
}

/**
 * Reveal with whatever is in. The escape hatch for an untimed clue its player
 * has stopped answering, and for a clue whose player has left — which is why
 * it accepts a Daily Double's wager phase too. Charges nobody who has not
 * answered: walking away is not the same act as letting the clock run out.
 */
export function revealNow(game, deal) {
  if (game.phase !== 'answering' && !(game.phase === 'wager' && game.solo)) return { patch: {} };
  return { patch: settle(game, deal, game.answers ?? {}) };
}

/**
 * Re-checks the gate after the roster changed. A departure can complete a
 * phase with no new write at all — the last player everyone was waiting on is
 * the one who left — and only an effect can notice that, with no answer or
 * wager of its own to submit.
 */
export function settleIfComplete(game, deal, activeIds, now = null) {
  if (game.phase === 'board') return skipPicker(game, activeIds);
  if (game.phase === 'wager') {
    // The Daily Double's finder left mid-wager: nobody else can play it.
    if (game.solo && !activeIds.includes(game.solo)) return revealNow(game, deal);
    const opened = openIfWagered(game, activeIds, now);
    return { patch: opened };
  }
  if (game.phase === 'answering') {
    if (game.solo && !activeIds.includes(game.solo)) return revealNow(game, deal);
    // An empty list passes too, and should: a final whose every wagerer has
    // gone has nobody left to wait for.
    if (requiredIds(game, activeIds).every((id) => game.answers?.[id])) {
      return { patch: settle(game, deal, game.answers ?? {}) };
    }
  }
  return { patch: {} };
}

// ── Advancing ──────────────────────────────────────────────────────────────

// The seat after `from` in roster order that is still here. Wraps; falls back
// to whoever is first if nobody is (the room is about to end anyway).
function nextPicker(order, from, activeIds) {
  const live = order.filter((id) => activeIds.includes(id));
  if (!live.length) return order[0] ?? null;
  const at = order.indexOf(from);
  for (let step = 1; step <= order.length; step++) {
    const id = order[(at + step + order.length) % order.length];
    if (live.includes(id)) return id;
  }
  return live[0];
}

/** The picker left while the board waited on them; hand the pick on. */
export function skipPicker(game, activeIds) {
  if (game.phase !== 'board' || !game.pickerId || activeIds.includes(game.pickerId)) return { patch: {} };
  return { patch: { pickerId: nextPicker(game.order, game.pickerId, activeIds) } };
}

/**
 * Past a revealed clue: the next quiz question, back to the board, into the
 * final, or the end.
 *
 * The turn rotates round the table whatever happened, rather than staying with
 * a player who got it right. "Keep picking while you're right" lets one strong
 * player run the board while everyone else watches, which is the opposite of
 * what one-player-per-clue is for.
 */
export function advance(game, deal, activeIds, now = null) {
  if (game.phase !== 'revealed') return { patch: {} };

  if (game.round === 'final') return { patch: { phase: 'finished' } };

  if (deal.format === QUIZ) {
    const index = game.index + 1;
    if (index >= (deal.questions?.length ?? 0)) return { patch: { phase: 'finished' } };
    const turn = nextPicker(game.order, game.pickerId, activeIds);
    return {
      patch: {
        ...clueReset(), index, phase: 'answering', pickerId: turn, solo: turn, deadlineAt: deadlineFor(game, now),
      },
    };
  }

  if (cellsLeft(game, deal) > 0) {
    return {
      patch: {
        ...clueReset(),
        phase: 'board',
        picks: game.picks + 1,
        pickerId: nextPicker(game.order, game.pickerId, activeIds),
      },
    };
  }

  if (!deal.final) return { patch: { phase: 'finished' } };
  return { patch: { ...clueReset(), phase: 'wager', round: 'final' } };
}

/** Ends the game where it stands — the room fell below two players. */
export function endGame(game) {
  if (!game || game.phase === 'finished') return { patch: {} };
  return { patch: { phase: 'finished', deadlineAt: null } };
}

// ── Repair ─────────────────────────────────────────────────────────────────
//
// Realtime Database drops empty objects and arrays and nulls on the way in, so
// a game read back from a room is missing every collection that happened to be
// empty. Rebuilt from NAMED fields rather than spread from the raw value — the
// trap AniWave's normalizeRound records is a field written by the hook and
// forgotten here, which then silently never arrives. Exported and tested
// because it is the online path.

const numberOr = (v, fallback) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fallback);

function normalizeAnswers(raw) {
  const out = {};
  for (const [id, a] of Object.entries(raw ?? {})) {
    if (!a || typeof a !== 'object') continue;
    out[id] = { text: typeof a.text === 'string' ? a.text : '', correct: Boolean(a.correct), delta: numberOr(a.delta, 0) };
  }
  return out;
}

export function normalizeGame(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const wagers = {};
  for (const [id, w] of Object.entries(raw.wagers ?? {})) wagers[id] = numberOr(w, 0);
  const scores = {};
  for (const [id, s] of Object.entries(raw.scores ?? {})) scores[id] = numberOr(s, 0);
  return {
    order: asArray(raw.order),
    scores,
    timed: Boolean(raw.timed),
    answerMs: numberOr(raw.answerMs, null),
    phase: raw.phase ?? 'board',
    round: raw.round === 'final' ? 'final' : 'main',
    used: raw.used && typeof raw.used === 'object' ? { ...raw.used } : {},
    picks: numberOr(raw.picks, 0),
    pickerId: raw.pickerId ?? null,
    index: numberOr(raw.index, 0),
    cell: raw.cell ?? null,
    solo: raw.solo ?? null,
    answers: normalizeAnswers(raw.answers),
    wagers,
    deadlineAt: numberOr(raw.deadlineAt, null),
    log: asArray(raw.log).filter((l) => l && typeof l === 'object').map(normalizeLogLine),
  };
}

// A clue line (logLine): a clue nobody answered comes back with no `answers`.
function normalizeLogLine(raw) {
  const answers = {};
  for (const [id, a] of Object.entries(raw.answers ?? {})) {
    if (!a || typeof a !== 'object') continue;
    answers[id] = {
      correct: Boolean(a.correct),
      delta: numberOr(a.delta, 0),
      blank: Boolean(a.blank),
      ...(a.wager != null ? { wager: numberOr(a.wager, 0), before: numberOr(a.before, 0) } : {}),
    };
  }
  return {
    final: Boolean(raw.final),
    dd: Boolean(raw.dd),
    top: Boolean(raw.top),
    low: Boolean(raw.low),
    answer: typeof raw.answer === 'string' ? raw.answer : '',
    answers,
  };
}

export function normalizeDeal(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    format: raw.format === QUIZ ? QUIZ : BOARD,
    answerStyle: raw.answerStyle === TYPED ? TYPED : CHOICE,
    categories: asArray(raw.categories).map((c) => ({
      id: c?.id ?? '',
      title: c?.title ?? '',
      clues: asArray(c?.clues).map(normalizeClue).filter(Boolean),
    })),
    dailyDouble: raw.dailyDouble ?? null,
    final: normalizeClue(raw.final),
    questions: asArray(raw.questions).map(normalizeClue).filter(Boolean),
  };
}

// ── The game's story ───────────────────────────────────────────────────────

// Points as the scoreboard prints them, a negative with a real minus sign.
const pts = (n) => (n < 0 ? `−${Math.abs(n).toLocaleString('en-US')}` : n.toLocaleString('en-US'));

/**
 * The final screen's superlatives, from the clue log: five good, five roasts,
 * each a clear leader or nothing (a tie drops it rather than picking by seat).
 * The card (shared/utils/awards.js's pickAwards) shows two of each. `scores`
 * is the final scoreboard (for who finished first). Lines from before
 * `value`/`answer` were logged skip the awards that quote them.
 *
 *   All in               staked their whole score on a wager, and got it
 *   Comeback kid         finished first from below zero
 *   Jackpot              the biggest Daily Double won
 *   Hot hand             the most right answers in a row (3+)
 *   Big game hunter      the most top-value clues right (2+)
 *   Bold strategy        the biggest stake lost (roast)
 *   Brain freeze         the costliest wrong answer (roast)
 *   Missed the gimme     a wrong answer on the cheapest row (roast)
 *   Rock bottom          the lowest score anyone sank to, below zero (roast)
 *   Cat got your tongue  the most clues left blank (2+, roast)
 */
export function quizAwards(log = [], players = [], scores = {}) {
  const lines = (log ?? []).filter(Boolean);
  const byId = (id) => players.find((p) => p.id === id) ?? null;
  const where = (l) => (l.final ? 'the final' : l.dd ? 'the Daily Double' : 'a clue');
  const about = (l) => (l.answer ? ` on ${l.answer}` : '');
  const out = [];
  const answers = lines.flatMap((l) => Object.entries(l.answers ?? {}).map(([by, a]) => ({ by, l, ...a })));

  const allIn = answers.filter((a) => a.wager != null && a.correct && a.before > 0 && a.wager >= a.before);
  const brave = clearBest(allIn, (a) => a.wager);
  if (brave) out.push(award('All in', byId(brave.by), `Bet all ${pts(brave.wager)} on ${where(brave.l)} — and got it`, { weight: 3 }));

  // Every player's running total, clue by clue.
  const lows = {};
  const run = {};
  for (const a of answers) {
    run[a.by] = (run[a.by] ?? 0) + (a.delta ?? 0);
    lows[a.by] = Math.min(lows[a.by] ?? 0, run[a.by]);
  }
  const leader = clearLeader(scores ?? {}, { min: -Infinity });
  if (leader && lows[leader.id] < 0) out.push(award('Comeback kid', byId(leader.id), `From ${pts(lows[leader.id])} to first`, { weight: 3 }));

  const doubled = clearBest(answers.filter((a) => a.l.dd && a.correct), (a) => a.delta);
  if (doubled) out.push(award('Jackpot', byId(doubled.by), `+${pts(doubled.delta)} on the Daily Double${about(doubled.l)}`, { weight: 2 }));

  // A streak is a player's OWN answers in a row: one player takes each clue.
  const best = {};
  const streak = {};
  for (const a of answers) {
    streak[a.by] = a.correct ? (streak[a.by] ?? 0) + 1 : 0;
    best[a.by] = Math.max(best[a.by] ?? 0, streak[a.by]);
  }
  const fire = clearLeader(best, { min: 3 });
  if (fire) out.push(award('Hot hand', byId(fire.id), `${fire.n} right in a row`));

  const hunter = clearLeader(tally(answers, (a) => (a.l.top && a.correct ? a.by : null)), { min: 2 });
  if (hunter) out.push(award('Big game hunter', byId(hunter.id), `Took ${hunter.n} of the ${pts(TOP_VALUE)}s`));

  const lost = answers.filter((a) => a.wager > 0 && !a.correct);
  const bold = clearBest(lost, (a) => a.wager);
  if (bold) out.push(award('Bold strategy', byId(bold.by), `Bet ${pts(bold.wager)} on ${where(bold.l)} — and lost`, { roast: true }));

  const wrong = answers.filter((a) => !a.correct && !a.blank && a.wager == null);
  const freeze = clearBest(wrong, (a) => a.delta, { dir: 'min' });
  if (freeze && freeze.delta < 0) out.push(award('Brain freeze', byId(freeze.by), `Lost ${pts(-freeze.delta)}${about(freeze.l)}`, { roast: true }));

  const gimmes = answers.filter((a) => !a.correct && a.l.low);
  const gimme = clearLeader(tally(gimmes, (a) => a.by));
  if (gimme) {
    const a = gimmes.filter((x) => x.by === gimme.id).at(-1);
    out.push(award('Missed the gimme', byId(gimme.id), `Missed the ${pts(BOTTOM_VALUE)}${about(a.l)}`, { roast: true }));
  }

  const bottom = clearLeader(Object.fromEntries(Object.entries(lows).filter(([, n]) => n < 0)), { dir: 'min' });
  if (bottom) out.push(award('Rock bottom', byId(bottom.id), `Sank to ${pts(bottom.n)}`, { roast: true }));

  const silent = clearLeader(tally(answers, (a) => (a.blank ? a.by : null)), { min: 2 });
  if (silent) out.push(award('Cat got your tongue', byId(silent.id), `Left ${times(silent.n, 'clue')} blank`, { roast: true }));
  return out.filter(Boolean);
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
