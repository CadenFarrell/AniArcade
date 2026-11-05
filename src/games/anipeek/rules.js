// Pure AniPeek rules: the bid, the peek, the answer and the score. No React, no
// storage, no network — the local hook keeps the state in useState and the
// online hook in a Firebase transaction, and both call exactly these functions.
//
// A round, start to finish:
//
//   bidding    a portrait sits under TILES covered tiles. The opener (it rotates
//              round the table) must bid; in turn everyone else bids LOWER or
//              passes, and a pass sits out the rest of the round's bidding.
//   peeking    the lowest bidder spends their bid: a tile costs 1, a hint card
//              (studio, year, format, source) costs HINT_COST. They may stop
//              and name the character at any point.
//   answering  the budget is spent (or they chose to stop); only the answer is
//              left.
//   revealed   the whole portrait, the name, and the points.
//   finished   after the last round.
//
// **The score is TILES − the bid, not "tiles still covered".** A hint costs
// HINT_COST tiles of budget, so once hints exist the covered count and the bid disagree,
// and the bid is the number the bidder chose and the table watched them choose.
// Stopping early never changes it, which keeps the bid the one decision that
// prices the round. A wrong answer pays WRONG_BONUS to every other player still
// here — a miss has to cost something, or the lowest bid is always free —
// and in multiple choice it also costs the bidder MISS_COST.
//
// Two objects, AniQuiz's split:
//
//   deal  what was dealt — the cards (each a character, its portrait, its
//         choices and hints), written once and never changed.
//   game  everything that moves — the bid, the tiles, the scores.
//
// Online every move is a transaction on `game` alone, so the writes stay small
// and every rule takes the deal as an argument.
import { award, clearBest, clearLeader, sumBy, tally, times } from '../../shared/utils/awards';
import { characterNameKey } from '../../shared/utils/character';

// 5 across × 7 down over AniList's 2:3 portrait, so each tile is nearly square
// (1.05 tall to 1 wide). The board began 4×4: sixteen tall tiles, each a
// sixteenth of the face, which gave too much away per tile and left bids only
// 1–15 to work with.
export const COLS = 5;
export const ROWS = 7;
export const TILES = COLS * ROWS;
// A bid of every tile would be the whole picture for nothing; the most anyone
// can ask for is one fewer, which still scores one point.
export const MAX_BID = TILES - 1;
export const MIN_BID = 1;
// Both were tuned on the 16-tile board (a hint 2 tiles, a miss 3 points) and
// scale with it: on a finer board one tile shows less of the face, so a hint
// is worth more tiles, and a right name pays more, so a miss has to cost more
// to keep the lowest bid from being free. 4 and 7 on the 5×7 board.
export const HINT_COST = Math.round((2 * TILES) / 16);
export const WRONG_BONUS = Math.round((3 * TILES) / 16);
// What a miss costs the BIDDER, in multiple choice only. The bonus alone left
// the lowest bid free there: four names make a blind guess right a quarter of
// the time, and at a 1-tile bid that is 0.25 × 34 = 8.5 points against each
// opponent's 0.75 × 7 = 5.25 — so the opener bid 1, which closes the bidding,
// and the round was a coin toss nobody else touched. With the cost the blind
// guess nets 8.5 − 5.25 = 3.25 against the opponent's 5.25, a loss, while a
// bidder who really knows the face from one tile still comes out well ahead.
// Typed answers have no such floor (a blind guess is almost never right), so
// they keep the bonus alone. Scores may go below zero, as in AniQuiz: a floor
// at zero would make the cost free at the start of every game.
export const MISS_COST = WRONG_BONUS;
export const missCost = (answerStyle) => (answerStyle === CHOICE ? MISS_COST : 0);
// Where the opener's stepper sits before they touch it: half the board.
export const OPENING_BID = Math.floor(TILES / 2);
// Cards dealt beyond the rounds, for a portrait that will not load (skipCard).
export const SPARES = 2;
export const MIN_PLAYERS = 2;

export const CHOICE = 'choice';
export const TYPED = 'typed';

// Hint cards, in the order they are drawn. `label` is the card's name; the
// value comes from the deal (deal.js says where each one is read from).
export const HINTS = [
  { id: 'studio', label: 'Studio' },
  { id: 'year', label: 'First aired' },
  { id: 'format', label: 'Format' },
  { id: 'source', label: 'Source' },
];

export const pointsFor = (bid) => TILES - bid;

/** The card on screen, from the deal. */
export function currentCard(game, deal) {
  return deal?.cards?.[game?.cardIndex] ?? null;
}

/** What the bidder has left to spend. */
export function budgetLeft(game) {
  if (!game?.bid) return 0;
  return Math.max(0, game.bid.n - game.uncovered.length - HINT_COST * game.hintsTaken.length);
}

/** Whether a hint can be bought: it exists on this card, is untaken, and is affordable. */
export function canTakeHint(game, deal, kind) {
  const card = currentCard(game, deal);
  return Boolean(
    game?.phase === 'peeking'
    && deal?.hintsOn
    && card?.hints?.[kind]
    && !game.hintsTaken.includes(kind)
    && budgetLeft(game) >= HINT_COST,
  );
}

// The round's opener: seat `round` round the table, moved on past anyone not
// here. Stored on the game rather than derived at render, so a departure mid-
// round cannot move whose turn it already is.
function openerFor(order, round, activeIds) {
  if (!order.length) return null;
  for (let i = 0; i < order.length; i++) {
    const id = order[(round + i) % order.length];
    if (!activeIds || activeIds.includes(id)) return id;
  }
  return null;
}

const bidReset = (opener) => ({
  phase: 'bidding',
  turnId: opener,
  bid: null,
  passed: {},
  uncovered: [],
  hintsTaken: [],
  result: null,
});

/**
 * A fresh game over `playerIds`, in seat order. `rounds` comes from the deal,
 * which already knows how many cards it holds.
 */
export function startGame(playerIds, deal) {
  const order = [...playerIds];
  const rounds = deal?.rounds ?? 0;
  return {
    order,
    scores: Object.fromEntries(order.map((id) => [id, 0])),
    rounds,
    round: 0,
    cardIndex: 0,
    // Spares sit after the rounds' own cards, so the next one to hand out is
    // always the first index past what has been used.
    nextSpare: rounds,
    log: [],
    ...bidReset(order[0] ?? null),
  };
}

// The next player to bid after `fromId`, or null when nobody is left who
// could: everyone else has passed, or the bid is already as low as it goes.
function nextBidder(game, fromId, activeIds) {
  const { order, passed, bid } = game;
  if (bid && bid.n <= MIN_BID) return null;
  const start = order.indexOf(fromId);
  for (let step = 1; step <= order.length; step++) {
    const id = order[(start + step) % order.length];
    if (passed[id] || id === bid?.by) continue;
    if (activeIds && !activeIds.includes(id)) continue;
    return id;
  }
  return null;
}

// After a bid or a pass: hand the turn on, or close the bidding.
function afterBidding(game, fromId, activeIds) {
  const next = nextBidder(game, fromId, activeIds);
  if (next) return { ...game, turnId: next };
  // Nobody left to outbid: the lowest bidder peeks.
  return { ...game, turnId: null, phase: 'peeking' };
}

const changed = (game, next) => {
  const patch = {};
  for (const [k, v] of Object.entries(next)) if (game[k] !== v) patch[k] = v;
  return { patch };
};

/** `playerId` bids `n` tiles. Must be their turn, and lower than the bid to beat. */
export function placeBid(game, playerId, n, activeIds = null) {
  if (game?.phase !== 'bidding' || game.turnId !== playerId) return { patch: {} };
  const bid = Number(n);
  const ceiling = game.bid ? game.bid.n - 1 : MAX_BID;
  if (!Number.isInteger(bid) || bid < MIN_BID || bid > ceiling) return { patch: {} };
  return changed(game, afterBidding({ ...game, bid: { by: playerId, n: bid } }, playerId, activeIds));
}

/** `playerId` passes. The opener cannot — somebody has to set the first price. */
export function pass(game, playerId, activeIds = null) {
  if (game?.phase !== 'bidding' || game.turnId !== playerId || !game.bid) return { patch: {} };
  return changed(game, afterBidding({ ...game, passed: { ...game.passed, [playerId]: true } }, playerId, activeIds));
}

// Spent: straight to the answer, with nothing left to choose.
const spendCheck = (game) => (budgetLeft(game) === 0 ? { ...game, phase: 'answering' } : game);

/** The bidder uncovers one tile. */
export function uncoverTile(game, playerId, tile) {
  if (game?.phase !== 'peeking' || game.bid?.by !== playerId) return { patch: {} };
  const t = Number(tile);
  if (!Number.isInteger(t) || t < 0 || t >= TILES || game.uncovered.includes(t)) return { patch: {} };
  if (budgetLeft(game) < 1) return { patch: {} };
  return changed(game, spendCheck({ ...game, uncovered: [...game.uncovered, t] }));
}

/** The bidder buys a hint card. */
export function takeHint(game, deal, playerId, kind) {
  if (game?.bid?.by !== playerId || !canTakeHint(game, deal, kind)) return { patch: {} };
  return changed(game, spendCheck({ ...game, hintsTaken: [...game.hintsTaken, kind] }));
}

/** The bidder stops peeking and answers with budget to spare. */
export function nameNow(game, playerId) {
  if (game?.phase !== 'peeking' || game.bid?.by !== playerId) return { patch: {} };
  return { patch: { phase: 'answering' } };
}

// Words in any order, so "Ackerman Levi" names "Levi Ackerman": romanized
// Japanese names arrive family-name-first from some lists and given-name-first
// from others, and the player has answered the question either way.
const wordSet = (text) => characterNameKey(text).split(' ').filter(Boolean).sort().join(' ');

/** Whether `text` names `card`. Exported for the tests and the reveal. */
export function names(card, text) {
  if (!card || !text?.trim()) return false;
  if (characterNameKey(text) === card.key) return true;
  return wordSet(text) === wordSet(card.name);
}

/**
 * The bidder's answer. Graded here, from the card in the deal, so a room grades
 * inside the transaction on whichever device sent it. A blank (Pass) is wrong.
 */
export function submitAnswer(game, deal, playerId, text, activeIds = null) {
  if (!['peeking', 'answering'].includes(game?.phase) || game.bid?.by !== playerId) return { patch: {} };
  const card = currentCard(game, deal);
  const correct = names(card, text);
  const scores = { ...game.scores };
  let points = 0;
  if (correct) {
    points = pointsFor(game.bid.n);
    scores[playerId] = (scores[playerId] ?? 0) + points;
  } else {
    const cost = missCost(deal?.answerStyle);
    if (cost) {
      points = -cost; // never `-cost` for 0: -0 is a different value to Object.is and RTDB
      scores[playerId] = (scores[playerId] ?? 0) + points;
    }
    // Everyone else still here. Departed players keep their frozen score.
    for (const id of game.order) {
      if (id === playerId || (activeIds && !activeIds.includes(id))) continue;
      scores[id] = (scores[id] ?? 0) + WRONG_BONUS;
    }
  }
  return {
    patch: {
      phase: 'revealed',
      scores,
      result: { by: playerId, text: typeof text === 'string' ? text.trim() : '', correct, points, void: null },
    },
  };
}

/**
 * Swap in a spare card — the portrait did not load. Only before any tile is
 * uncovered: after that the table has seen part of THIS picture, and a new one
 * would hand the bidder a second look at the same price. Bidding starts over,
 * since every bid was a price for the picture that is gone. With no spare
 * left, the round is void.
 */
export function skipCard(game, deal, activeIds = null) {
  if (!['bidding', 'peeking'].includes(game?.phase) || game.uncovered.length > 0) return { patch: {} };
  if (game.nextSpare < (deal?.cards?.length ?? 0)) {
    return {
      patch: {
        ...bidReset(openerFor(game.order, game.round, activeIds)),
        cardIndex: game.nextSpare,
        nextSpare: game.nextSpare + 1,
      },
    };
  }
  return { patch: { phase: 'revealed', turnId: null, result: { by: null, text: '', correct: false, points: 0, void: 'broken' } } };
}

/** On to the next round, or the end. Anyone may press it. */
export function nextRound(game, activeIds = null) {
  if (game?.phase !== 'revealed') return { patch: {} };
  // The round just revealed, kept for the final screen's portrait strip: the
  // card (its index into the deal), the bid, what it cost, and how it ended —
  // plus, for the awards, who passed in the bidding and a wrong answer's words.
  const r = game.result;
  const missedWith = !r?.correct && !r?.void && r?.text ? String(r.text).slice(0, 60) : '';
  const line = {
    card: game.cardIndex,
    by: r?.by ?? game.bid?.by ?? null,
    bid: game.bid?.n ?? null,
    tiles: game.uncovered.length,
    hints: game.hintsTaken.length,
    correct: Boolean(r?.correct),
    points: r?.points ?? 0,
    void: r?.void ?? null,
    passed: Object.keys(game.passed ?? {}).filter((id) => game.passed[id]),
    ...(missedWith ? { text: missedWith } : {}),
  };
  const log = [...(game.log ?? []), line];
  const round = game.round + 1;
  if (round >= game.rounds) return { patch: { phase: 'finished', turnId: null, log } };
  return {
    patch: {
      round,
      cardIndex: round,
      log,
      ...bidReset(openerFor(game.order, round, activeIds)),
    },
  };
}

/**
 * The final screen's superlatives, from the log: five good, five roasts, each
 * a clear leader or nothing (a tie drops it rather than picking by seat). The
 * card (shared/utils/awards.js's pickAwards) shows two of each. `nameOf(card)`
 * is the dealt character's name, for the detail lines. Lines from before
 * `passed`/`text` were logged skip the awards that need them.
 *
 *   Eagle eye        the right name from the fewest tiles, hints counted at cost
 *   Big payday       the most points from one portrait
 *   Leftovers        the most of their own bid left unspent on a right name (2+)
 *   Clue collector   named it after buying two hints or more
 *   Vulture          banked the most off other people's misses
 *   Overconfident    the lowest bid that missed (roast)
 *   Seeing things    a wrong name, quoted (roast)
 *   Staring contest  missed with the most tiles uncovered, ten or more (roast)
 *   Window shopper   missed after buying two hints or more (roast)
 *   Cold feet        the most passes in the bidding (3+, roast)
 */
export function peekAwards(log = [], players = [], { nameOf = () => '' } = {}) {
  const byId = (id) => players.find((p) => p.id === id) ?? null;
  const all = (log ?? []).filter(Boolean);
  const lines = all.filter((l) => !l.void && l.by);
  const out = [];
  const cost = (l) => l.tiles + l.hints * HINT_COST;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const them = (l) => nameOf(l.card) || 'them';

  const rights = lines.filter((l) => l.correct);
  const eagle = clearBest(rights, cost, { dir: 'min' });
  if (eagle) {
    out.push(award('Eagle eye', byId(eagle.by),
      `Named ${them(eagle)} from ${plural(eagle.tiles, 'tile')}${eagle.hints ? ` and ${plural(eagle.hints, 'hint')}` : ''}`, { weight: 2 }));
  }
  const payday = clearBest(rights, (l) => l.points);
  if (payday && payday !== eagle) out.push(award('Big payday', byId(payday.by), `${payday.points} points for ${them(payday)}`));
  const spare = clearBest(rights.filter((l) => Number.isInteger(l.bid)), (l) => l.bid - cost(l));
  if (spare && spare.bid - cost(spare) >= 2 && spare !== eagle) {
    out.push(award('Leftovers', byId(spare.by), `Named ${them(spare)} with ${spare.bid - cost(spare)} of their bid to spare`));
  }
  const collector = clearBest(rights.filter((l) => l.hints >= 2), (l) => l.hints);
  if (collector) out.push(award('Clue collector', byId(collector.by), `Bought ${collector.hints} hints, then named ${them(collector)}`));

  // A miss pays everyone else at the table.
  const missed = lines.filter((l) => !l.correct);
  const vulture = clearLeader(sumBy(missed, (l) => Object.fromEntries(
    players.filter((p) => p.id !== l.by).map((p) => [p.id, WRONG_BONUS]),
  )), { min: 2 * WRONG_BONUS });
  if (vulture) out.push(award('Vulture', byId(vulture.id), `Banked ${vulture.n} off other people’s misses`));

  const bold = clearBest(missed.filter((l) => Number.isInteger(l.bid)), (l) => l.bid, { dir: 'min' });
  if (bold) out.push(award('Overconfident', byId(bold.by), `Bid ${bold.bid} on ${them(bold)} and missed`, { roast: true }));
  const quotes = missed.filter((l) => l.text);
  const wrongest = clearLeader(tally(quotes, (l) => l.by));
  if (wrongest) {
    const l = quotes.filter((x) => x.by === wrongest.id).at(-1);
    out.push(award('Seeing things', byId(l.by), `Said “${l.text}”${nameOf(l.card) ? ` — it was ${nameOf(l.card)}` : ''}`, { roast: true }));
  }
  const stare = clearBest(missed, (l) => l.tiles);
  if (stare && stare.tiles >= 10) out.push(award('Staring contest', byId(stare.by), `Uncovered ${stare.tiles} tiles and still missed ${them(stare)}`, { roast: true }));
  const shopper = clearBest(missed.filter((l) => l.hints >= 2), (l) => l.hints);
  if (shopper) out.push(award('Window shopper', byId(shopper.by), `Bought ${shopper.hints} hints and still missed ${them(shopper)}`, { roast: true }));
  const chicken = clearLeader(tally(all, (l) => l.passed ?? []), { min: 3 });
  if (chicken) out.push(award('Cold feet', byId(chicken.id), `Passed ${times(chicken.n)} in the bidding`, { roast: true }));
  return out.filter(Boolean);
}

/**
 * What a departure broke, if anything. Any device may run it online; locally
 * nobody leaves, so it is never called.
 *
 *   - the player whose turn it is to bid has gone: a pass, or — when no bid is
 *     on the table yet — the turn to open moves to the next player here;
 *   - the bidder has gone mid-peek or mid-answer: the round is void, with no
 *     points either way, because nobody else may answer their bid.
 */
export function settleIfComplete(game, activeIds) {
  if (!game || !activeIds) return { patch: {} };
  const here = (id) => activeIds.includes(id);
  if (game.phase === 'bidding') {
    if (game.turnId && !here(game.turnId)) {
      if (!game.bid) {
        const opener = nextBidder({ ...game, passed: {} }, game.turnId, activeIds);
        return opener ? { patch: { turnId: opener } } : { patch: {} };
      }
      return changed(game, afterBidding({ ...game, passed: { ...game.passed, [game.turnId]: true } }, game.turnId, activeIds));
    }
    return { patch: {} };
  }
  if (['peeking', 'answering'].includes(game.phase) && game.bid && !here(game.bid.by)) {
    return {
      patch: {
        phase: 'revealed',
        turnId: null,
        result: { by: game.bid.by, text: '', correct: false, points: 0, void: 'left' },
      },
    };
  }
  return { patch: {} };
}

/** Ends the game where it stands — the room fell below two players. */
export function endGame(game) {
  if (!game || game.phase === 'finished') return { patch: {} };
  return { patch: { phase: 'finished', turnId: null } };
}

// ── Repair ─────────────────────────────────────────────────────────────────
//
// Realtime Database drops empty objects and arrays, and hands an array with
// holes back sparse or as an object keyed by index. Rebuilt from NAMED fields
// (a field the hook writes and this forgets silently never arrives), and lists
// read with a plain index loop, anirank/rules.js's normalizeBoard rule.

const numberOr = (v, fallback) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback);

export function listOf(raw) {
  if (!raw) return [];
  const out = [];
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) if (raw[i] != null) out.push(raw[i]);
    return out;
  }
  if (typeof raw === 'object') {
    return Object.keys(raw)
      .filter((k) => Number.isInteger(Number(k)))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => raw[k])
      .filter((v) => v != null);
  }
  return [];
}

function normalizeResult(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    by: raw.by ?? null,
    text: typeof raw.text === 'string' ? raw.text : '',
    correct: Boolean(raw.correct),
    points: numberOr(raw.points, 0),
    void: raw.void === 'left' || raw.void === 'broken' ? raw.void : null,
  };
}

export function normalizeGame(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const scores = {};
  for (const [id, s] of Object.entries(raw.scores ?? {})) scores[id] = numberOr(s, 0);
  const passed = {};
  for (const [id, v] of Object.entries(raw.passed ?? {})) if (v) passed[id] = true;
  const bid = raw.bid && raw.bid.by != null ? { by: raw.bid.by, n: numberOr(raw.bid.n, MAX_BID) } : null;
  const phases = ['bidding', 'peeking', 'answering', 'revealed', 'finished'];
  return {
    order: listOf(raw.order),
    scores,
    rounds: numberOr(raw.rounds, 0),
    round: numberOr(raw.round, 0),
    cardIndex: numberOr(raw.cardIndex, 0),
    nextSpare: numberOr(raw.nextSpare, 0),
    phase: phases.includes(raw.phase) ? raw.phase : 'bidding',
    turnId: raw.turnId ?? null,
    bid,
    passed,
    uncovered: listOf(raw.uncovered).map(Number).filter((t) => Number.isInteger(t)),
    hintsTaken: listOf(raw.hintsTaken).filter((h) => typeof h === 'string'),
    result: normalizeResult(raw.result),
    log: listOf(raw.log).filter((l) => l && typeof l === 'object').map((l) => ({
      card: numberOr(l.card, 0),
      by: l.by ?? null,
      bid: numberOr(l.bid, null),
      tiles: numberOr(l.tiles, 0),
      hints: numberOr(l.hints, 0),
      correct: Boolean(l.correct),
      points: numberOr(l.points, 0),
      void: l.void === 'left' || l.void === 'broken' ? l.void : null,
      passed: listOf(l.passed).filter((id) => typeof id === 'string'),
      ...(typeof l.text === 'string' && l.text ? { text: l.text } : {}),
    })),
  };
}

function normalizeCard(raw) {
  if (!raw || typeof raw !== 'object' || !raw.key) return null;
  const hints = {};
  for (const { id } of HINTS) {
    if (typeof raw.hints?.[id] === 'string' && raw.hints[id]) hints[id] = raw.hints[id];
  }
  return {
    key: raw.key,
    name: raw.name ?? '',
    series: raw.series ?? '',
    imageUrl: raw.imageUrl ?? '',
    choices: listOf(raw.choices).filter((c) => typeof c === 'string'),
    hints,
  };
}

export function normalizeDeal(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    answerStyle: raw.answerStyle === TYPED ? TYPED : CHOICE,
    hintsOn: raw.hintsOn !== false,
    rounds: numberOr(raw.rounds, 0),
    // No filter after the map: `cardIndex` points into this list, so a card
    // that failed to repair stays a null at its own index rather than shifting
    // every card after it.
    cards: listOf(raw.cards).map(normalizeCard),
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
