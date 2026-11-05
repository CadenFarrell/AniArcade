// All AniRank logic: no React, no storage, no network. Each function
// takes a slice of round state and returns a { patch } for the caller to apply
// however its persistence layer works — useState locally, a Firebase
// transaction online. See CLAUDE.md: change game behaviour here, not in the
// hooks, or local and online drift apart.
//
// The game is dealt one of two ways, chosen per round by `blind` and defaulted
// per axis (see axes.js):
//
//   blind  ten cards arrive one at a time. Every player commits each one to a
//          slot before the next is revealed, and a placed card never moves.
//          Everyone is on the same card at the same time — that shared cursor is
//          what keeps it blind, since a player who could run ahead would be
//          ranking a list they had already seen in full.
//   open   all ten are on the table from the start. Cards move between slots and
//          back to the tray freely until the player locks in, and `cursor` never
//          moves off 0. The round ends when everyone active has locked in.
//
// Only the way boards get FILLED differs. Everything downstream — trueOrder,
// rankMap, truthFor, scoreBoard, finalScores — reads finished boards and never
// asks how the cards got there.
//
// pendingPlacers is the single branch point between the two, deliberately: every
// readiness gate in both hooks funnels through it (everyonePlaced delegates to
// it, local play takes its head as the hot seat, online play renders it as
// "waiting on…"), so branching once there gives open rounds the same
// departed-player escape hatches blind rounds already have.
//
// What the slots MEAN is not decided here. A card carries a `value` the deck
// builder stamped on it from the round's axis (see axes.js), and the two modes
// differ only in where the answer key comes from:
//
//   fact     rankMap(trueOrder(deck))  — sort the cards by their value, biggest
//                                        first, because slot 1 is the top spot
//   opinion  rankMap(subject board)    — one player's own board is the key
//
// Both collapse to the same { itemId: rank } map, so scoreBoard never branches —
// and rank 0 means "belongs at the top" either way, so nothing below this line
// has to know which direction trueOrder sorts in.

import { award, clearBest, clearLeader, tally, times } from '../../shared/utils/awards';

export const BOARD_SIZE = 10;

// A match: this many rounds, then a final scoreboard (shared/utils/match.js; 0
// is the old endless "New ten"). Three, so an opinion round puts three
// different people in the subject's seat.
export const DEFAULT_MATCH_ROUNDS = 3;

// What reading the subject best is worth, on an opinion round: added to the
// guesser (or guessers, tied) whose board came closest to the subject's. The
// subject's own score stays the average of the guesses — how predictable they
// were — but the round now has a winner on the guessing side too, and a player
// who really knows their friend is paid for it rather than just averaged in.
export const READER_BONUS = 5;

// Realtime Database has no concept of a null array element: a board with one
// show placed in slot 5 comes back either as a 6-long array with holes or — once
// it is mostly empty — as an object keyed by index ({ "5": {...} }). Both shapes
// have to become a dense, fixed-length array before anything below indexes into
// them. Local play never sees either shape, which is exactly why this needs a
// test rather than a round of online debugging.
export function normalizeBoard(raw, size = BOARD_SIZE) {
  const out = new Array(size).fill(null);
  if (!raw) return out;
  if (Array.isArray(raw)) {
    // A plain index loop, NOT map/forEach: those skip holes, and a sparse array
    // is precisely what RTDB hands back for a half-filled board.
    for (let i = 0; i < raw.length && i < size; i++) {
      if (raw[i] != null) out[i] = raw[i];
    }
    return out;
  }
  for (const [k, v] of Object.entries(raw)) {
    const i = Number(k);
    if (Number.isInteger(i) && i >= 0 && i < size && v != null) out[i] = v;
  }
  return out;
}

// Every board in `raw`, plus an empty one for any listed player who has none
// yet. Deliberately keeps boards belonging to ids NOT in playerIds: callers
// pass the *active* roster to the readiness gates, and rebuilding this object
// from that list would delete a departed player's answers the next time anyone
// wrote to the round. Their board still has to be there at the reveal.
export function normalizeBoards(raw, playerIds = [], size = BOARD_SIZE) {
  const out = {};
  for (const id of Object.keys(raw ?? {})) out[id] = normalizeBoard(raw[id], size);
  for (const id of playerIds) {
    if (!out[id]) out[id] = normalizeBoard(null, size);
  }
  return out;
}

// How many shows this player has committed — and therefore which deck index
// they are on. Derived rather than stored so it can never disagree with the
// board it describes.
export function placedCount(board) {
  return normalizeBoard(board).filter(Boolean).length;
}

// `subjectId` is the player an opinion round is about — everyone, including
// them, ranks the cards as they would. Null for a fact round, and stored on the
// round rather than derived so a mid-round roster change cannot silently move
// the answer key out from under boards already committed against it.
export function startRound(players, deck, subjectId = null, { blind = true, pace = 'card' } = {}) {
  return {
    deck,
    cursor: 0,
    subjectId,
    blind,
    // How a blind round is paced on ONE device (see isSeatPace). Online always
    // plays card by card — every device places at once, so nothing is passed.
    pace: blind && pace === 'seat' ? 'seat' : 'card',
    // Who has committed their whole board. Only an open round writes to it — a
    // blind round's progress is derived from the cursor instead, so there is
    // nothing to keep in sync.
    locked: {},
    boards: Object.fromEntries(players.map((p) => [p.id, new Array(deck.length).fill(null)])),
  };
}

// Whose turn it is to be the subject. Indexed by round so it walks the roster
// instead of re-picking at random and leaving someone out all night.
export function subjectFor(playerIds, roundIndex = 0) {
  if (!playerIds?.length) return null;
  return playerIds[roundIndex % playerIds.length];
}

// Is this an open round? Stored as `blind`, read as the negative everywhere the
// open path branches. Missing means blind: rounds written before open mode
// existed have no flag, and every one of them was blind.
export function isOpen(state) {
  return state?.blind === false;
}

// Seat pace: a blind round on one device where each player places their WHOLE
// board, card after card, and then passes the device on — one handoff a player
// instead of one per card per player (ten times the table, on a ten-card deck).
// Still blind: each card shows only after the last one is placed, and nobody
// sees another board. The shared cursor stops meaning anything mid-round, so
// every rule that reads it asks this first.
export function isSeatPace(state) {
  return state?.pace === 'seat' && !isOpen(state);
}

// The card every player is currently placing. Null in an open round, which has
// no single current card — every caller already null-guards this, because a
// blind round returns null once the cursor runs off the end of the deck.
// `playerId` matters only at seat pace, where each board is on its own card.
export function currentItem(state, playerId = null) {
  if (isOpen(state)) return null;
  if (isSeatPace(state)) {
    if (!playerId) return null;
    return state.deck?.[placedCount(state.boards?.[playerId])] ?? null;
  }
  return state.deck?.[state.cursor] ?? null;
}

// Who the round is still waiting on. Local play takes the first of these as
// "whose turn to pass the device to"; online play renders the whole list as
// "waiting on…".
//
// The one place the two modes diverge — see the header. Blind compares each
// board against the shared cursor; open asks who has not locked in yet.
export function pendingPlacers(state, playerIds) {
  if (isOpen(state)) return playerIds.filter((id) => !state.locked?.[id]);
  if (isSeatPace(state)) {
    const size = state.deck?.length ?? BOARD_SIZE;
    return playerIds.filter((id) => placedCount(state.boards?.[id]) < size);
  }
  return playerIds.filter((id) => placedCount(state.boards?.[id]) <= state.cursor);
}

// Commits the current show to a slot. Refuses rather than throws on every way
// this can arrive twice — a double tap, a slow network replaying a write, or a
// player whose device still shows a show the room has moved past.
export function placeItem(state, playerId, slotIndex) {
  const size = state.deck?.length ?? BOARD_SIZE;
  const board = normalizeBoard(state.boards?.[playerId], size);
  const item = currentItem(state, playerId);

  if (!item) return { patch: {} };                                  // round is over
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= size) return { patch: {} };
  if (board[slotIndex] != null) return { patch: {} };               // slot already taken
  // Already placed this one — at card pace, against the shared cursor; at seat
  // pace the player's own count IS their cursor, so there is nothing to compare.
  if (!isSeatPace(state) && placedCount(board) > state.cursor) return { patch: {} };

  const next = [...board];
  next[slotIndex] = item;
  return { patch: { boards: { ...state.boards, [playerId]: next } } };
}

// --- Open rounds -----------------------------------------------------------
//
// The three ways a board changes when all ten cards are on the table at once.
// Each refuses rather than throws for the same reasons placeItem does — a double
// tap, a slow network replaying a write, or a device still showing a round the
// room has moved past — plus one more: a blind round must never reach them, so
// they all check the mode rather than trusting the caller to.

// Puts a specific card in a slot. One rule covers every case the board needs,
// and it is worth stating plainly because it replaces three:
//
//   the card goes in the tapped slot, and whatever was already there takes the
//   card's old place — its previous slot if it had one, otherwise the tray.
//
// So dropping a tray card on an empty slot places, dragging a placed card to an
// empty slot moves, and tapping two filled slots swaps them. Refusing an
// occupied slot (and making the player empty it first) was the clumsier version
// of the same gesture, and made reordering a finished board tedious.
export function placeCard(state, playerId, itemId, slotIndex) {
  if (!isOpen(state)) return { patch: {} };             // blind rounds go through placeItem
  if (state.locked?.[playerId]) return { patch: {} };   // already committed

  const size = state.deck?.length ?? BOARD_SIZE;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= size) return { patch: {} };

  const item = (state.deck ?? []).find((c) => c?.id === itemId);
  if (!item) return { patch: {} };                      // not a card in this round

  const board = normalizeBoard(state.boards?.[playerId], size);
  const from = board.findIndex((c) => c?.id === itemId);
  if (from === slotIndex) return { patch: {} };         // already there — nothing moves

  const next = [...board];
  const displaced = next[slotIndex] ?? null;
  next[slotIndex] = item;
  // Only when the card came off the board does anything land back on it; a card
  // picked out of the tray sends the one it displaced back to the tray, which is
  // simply the absence of a slot.
  if (from >= 0) next[from] = displaced;
  return { patch: { boards: { ...state.boards, [playerId]: next } } };
}

// Returns a card to the tray.
export function clearSlot(state, playerId, slotIndex) {
  if (!isOpen(state)) return { patch: {} };
  if (state.locked?.[playerId]) return { patch: {} };

  const size = state.deck?.length ?? BOARD_SIZE;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= size) return { patch: {} };

  const board = normalizeBoard(state.boards?.[playerId], size);
  if (board[slotIndex] == null) return { patch: {} };

  const next = [...board];
  next[slotIndex] = null;
  return { patch: { boards: { ...state.boards, [playerId]: next } } };
}

// Commits a finished board. The full-board check is what makes `locked` safe to
// use as the readiness gate: a half-filled board that could lock in would end
// the round early and, if it belonged to an opinion subject, do it with holes in
// the answer key.
export function lockIn(state, playerId) {
  if (!isOpen(state)) return { patch: {} };
  if (state.locked?.[playerId]) return { patch: {} };

  const board = normalizeBoard(state.boards?.[playerId], state.deck?.length ?? BOARD_SIZE);
  if (!board.every(Boolean)) return { patch: {} };
  return { patch: { locked: { ...state.locked, [playerId]: true } } };
}

// The cards this player has not placed yet — the tray. Derived from the board
// rather than stored, so it cannot disagree with what is on the board.
export function unplacedCards(state, playerId) {
  const deck = state.deck ?? [];
  const board = normalizeBoard(state.boards?.[playerId], deck.length || BOARD_SIZE);
  const placed = new Set(board.filter(Boolean).map((c) => c.id));
  return deck.filter((c) => !placed.has(c?.id));
}

// True once everyone still in the room has committed the current show. Takes
// the *active* ids, never the full roster: a closed tab would otherwise hold
// the reveal open forever.
export function everyonePlaced(state, activeIds) {
  if (!activeIds?.length) return false;
  return pendingPlacers(state, activeIds).length === 0;
}

// Reveals the next show, or ends the round. `finished` is separate from the
// patch because the caller decides what "finished" means for its view.
export function advanceCursor(state) {
  const next = state.cursor + 1;
  const finished = next >= (state.deck?.length ?? 0);
  return { patch: { cursor: next }, finished };
}

// Is the round over? Blind rounds run out of deck; open rounds end when everyone
// still here has locked in. Takes the *active* ids for the same reason
// everyonePlaced does — waiting on a closed tab would hold the reveal forever.
export function roundFinished(state, activeIds = []) {
  if (!state) return false;
  if (isOpen(state) || isSeatPace(state)) return everyonePlaced(state, activeIds);
  return state.cursor >= (state.deck?.length ?? 0);
}

// Has nobody committed anything yet? This is the window in which an opinion
// round can still change subject — boards built while guessing at one person
// cannot honestly be rescored against another.
//
// An open round needs its own answer here, and this is the trap: its cursor sits
// at 0 for the whole round, so the blind test would call it untouched right up
// to the reveal and happily swap the answer key out from under ten finished
// boards.
export function roundUntouched(state) {
  if (!state) return false;
  if (!isOpen(state)) return state.cursor === 0;
  if (Object.keys(state.locked ?? {}).length > 0) return false;
  return Object.values(state.boards ?? {}).every((b) => placedCount(b) === 0);
}

// The order the cards should have been in, for a FACT round. Sorted by the
// `value` the deck builder stamped from the axis, with the title as a stable
// tie-break so every device computes the identical answer.
//
// DESCENDING, and that is the board's whole orientation: slot 1 is the TOP of
// the ranking — the most of whatever this axis measures (see ../axes.js, where
// every axis names its ends `topLabel`/`bottomLabel` to match). The tie-break
// stays alphabetical because it only has to be deterministic, not meaningful.
export function trueOrder(deck) {
  return [...deck].sort((a, b) => b.value - a.value || a.title.localeCompare(b.title));
}

/**
 * Collapses any answer key into { itemId: rank }, which is the only thing
 * scoreBoard needs and the reason it never has to know which mode it is in.
 *
 * Cards sharing a `value` share a rank, so a fact round where two shows aired
 * the same year accepts either order — the tie-forgiveness that used to live in
 * the `a.year <= b.year` comparison, now expressed once. A subject's board has
 * no values (every slot is a deliberate choice), so each position is its own
 * rank and there are no ties to forgive.
 */
export function rankMap(ordered) {
  const list = ordered ?? [];
  const out = {};
  let rank = 0;
  let previous;
  // A plain index loop, not forEach: forEach skips holes, and a board that came
  // back from RTDB half-filled is exactly the sparse shape normalizeBoard exists
  // to repair. Callers pass dense arrays today; this stays correct if one doesn't.
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item) continue;
    const tied = previous != null && item.value != null && item.value === previous;
    if (!tied) rank = i;
    out[item.id] = rank;
    previous = item.value ?? null;
  }
  return out;
}

// The answer key for a round, whichever mode it is in. Returns null when an
// opinion round has no usable subject board — the caller renders an unscored
// reveal rather than inventing a winner.
export function truthFor(state, { opinion = false } = {}) {
  if (!opinion) return trueOrder(state.deck ?? []);
  const board = normalizeBoard(state.boards?.[state.subjectId], state.deck?.length ?? BOARD_SIZE);
  return board.every(Boolean) ? board : null;
}

// Scores one finished board against an answer key: Kendall tau, every pair of
// cards rather than only the neighbouring ones.
//
// `concordant` — pairs the player got the right way round, out of 45 on a ten
// card board. The score.
//
// This used to count only the nine ADJACENT pairs, and that was the bug behind
// the whole reveal being unreadable. Nine of the forty-five relationships is not
// a measurement of a ranking: a card could sit nine slots from home and cost at
// most two points, because only its two neighbours ever noticed. A board dealt
// by a random number generator scored 6/9 — 67% — for work nobody did. Worse, it
// made the reveal impossible to draw honestly, because "these two are a pair" is
// a fact about where you happened to drop them, not about the ranking.
//
// Counting every pair is proportional instead: being one slot out costs one
// comparison, being nine out costs nine. It stays forgiving where it should —
// dragging one card the length of the board costs 9 of 45, against 2 of 9 under
// the old rule, so a single mistake is no more punished than before — and it
// never cascades, because a displaced card is not re-charged for the cards it
// pushed along.
//
// `ra <= rb`, not `<`, and that single character is the tie forgiveness: cards
// sharing a value share a rank (see rankMap), so a fact round where two shows
// aired the same year accepts either order and is never docked. It is also why
// this function still knows nothing about which direction trueOrder sorts in.
//
// `exact` — slots holding the card that truly belongs there. Reported for
// interest, not scored, because with ties it is not always achievable.
export function scoreBoard(board, deck, truth) {
  const size = deck?.length ?? BOARD_SIZE;
  const filled = normalizeBoard(board, size);
  const key = truth ?? trueOrder(deck ?? []);
  const ranks = rankMap(key);

  let concordant = 0;
  let inversions = 0;
  // `comparisons` is counted rather than assumed to be 45: an unfinished board
  // is scored on the pairs it actually has, so the denominator has to be real.
  let comparisons = 0;
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const a = filled[i];
      const b = filled[j];
      if (!a || !b) continue;
      const ra = ranks[a.id];
      const rb = ranks[b.id];
      if (ra == null || rb == null) continue;
      comparisons++;
      if (ra <= rb) concordant++;
      else inversions++;
    }
  }

  let exact = 0;
  for (let i = 0; i < size; i++) {
    if (filled[i] && key[i] && filled[i].id === key[i].id) exact++;
  }

  // Fullness is checked explicitly. The old `ordered === size - 1` test implied
  // it by accident; `inversions === 0` does not, and would call a board with two
  // cards on it perfect.
  const perfect = comparisons > 0 && inversions === 0 && filled.every(Boolean);
  return { concordant, inversions, comparisons, exact, perfect, score: concordant };
}

/**
 * scoreBoard's totals, plus the per-slot detail the reveal draws.
 *
 * This lives here rather than in the results screen for the reason the whole
 * file exists: what a player reads and what they were awarded have to come out
 * of the same comparison.
 *
 *   slots[i]  { item, slot, trueSlot, band, drift, inPlace, conflicts }
 *
 * `conflicts` is the per-card cost: how many other cards this one is the wrong
 * way round against. It is the honest blame, because summed over the board it
 * IS the score — sum(conflicts) === 2 * inversions, every inversion counted once
 * from each end. Anything else would be a proxy. Slot drift in particular is a
 * bad proxy and used to drive the colour: a card three slots from home has zero
 * conflicts if everything it passed was tied with it, and colouring that amber
 * calls a correct board a mistake.
 *
 * There is deliberately no adjacent-pair array here any more. Neighbouring pairs
 * stopped being the scoring unit when scoreBoard moved to Kendall tau, and
 * drawing them would put back the exact misreading this rewrite removed — a mark
 * between two cards that looks like a verdict on them, but is really an accident
 * of where they were dropped.
 *
 * `band` is the span of key positions sharing this card's rank. rankMap gives
 * tied cards one rank on purpose, so measuring drift from a single true position
 * would report an unpenalised tie as misplaced. Anything inside its own band is
 * in place with drift 0; outside, drift is the distance to the nearest end of
 * the band (negative = ranked too high, positive = too low). Drift is text only
 * — "belongs at #7" — and never the colour.
 *
 * `exact` stays scoreBoard's positional count, untouched, so nothing reading it
 * changes; `inPlaceCount` is the band-aware one the screen shows. They differ
 * only where there are ties, which is the case band exists for.
 */
export function explainBoard(board, deck, truth) {
  const size = deck?.length ?? BOARD_SIZE;
  const filled = normalizeBoard(board, size);

  // No key at all: the reveal still draws what they picked, just unjudged.
  //
  // The totals are zeroed here rather than delegated, because scoreBoard falls
  // back to trueOrder(deck) when handed no key — right for a fact round, wrong
  // for the two callers that pass null on purpose (an unscored round, and the
  // opinion subject, who is the key and cannot be measured against it). Passing
  // through would print a score beside a row of blank verdicts.
  if (!truth) {
    return {
      concordant: 0,
      inversions: 0,
      comparisons: 0,
      exact: 0,
      perfect: false,
      score: 0,
      inPlaceCount: 0,
      slots: filled.map((item, i) => ({
        item, slot: i, trueSlot: null, band: null, drift: null, inPlace: false, conflicts: 0,
      })),
    };
  }

  const totals = scoreBoard(board, deck, truth);
  const ranks = rankMap(truth);

  // One band per rank, spanning every key position that shares it. Built from
  // the key rather than per card so a tie group of any size costs one pass.
  const bands = new Map();
  for (let i = 0; i < truth.length; i++) {
    const rank = ranks[truth[i]?.id];
    if (rank == null) continue;
    const band = bands.get(rank);
    if (band) band.hi = Math.max(band.hi, i);
    else bands.set(rank, { lo: i, hi: i });
  }

  // Per-card blame, counted from both ends of every inversion so each card knows
  // its own share. The same `ra <= rb` test scoreBoard uses, so the two can never
  // disagree about what went wrong.
  const conflicts = new Array(size).fill(0);
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const a = filled[i];
      const b = filled[j];
      if (!a || !b) continue;
      const ra = ranks[a.id];
      const rb = ranks[b.id];
      if (ra == null || rb == null || ra <= rb) continue;
      conflicts[i]++;
      conflicts[j]++;
    }
  }

  const positionOf = new Map(truth.map((item, i) => [item.id, i + 1]));
  let inPlaceCount = 0;
  const slots = filled.map((item, i) => {
    if (!item) {
      return {
        item: null, slot: i, trueSlot: null, band: null, drift: null, inPlace: false, conflicts: 0,
      };
    }
    const band = bands.get(ranks[item.id]) ?? null;
    const inPlace = Boolean(band && i >= band.lo && i <= band.hi);
    if (inPlace) inPlaceCount++;
    const drift = !band || inPlace ? 0 : i < band.lo ? i - band.lo : i - band.hi;
    return {
      item,
      slot: i,
      trueSlot: positionOf.get(item.id) ?? null,
      band,
      drift,
      inPlace,
      conflicts: conflicts[i],
    };
  });

  return { ...totals, inPlaceCount, slots };
}

/**
 * Every player's score for the round, keyed by id — the shape totalScores and
 * shared/utils/ranking.js's computeRankedPlayers both expect.
 *
 * In an opinion round the subject cannot be scored against their own board, so
 * they take the mean of everyone who guessed at them. Scoring them zero would
 * punish a player for being picked, and leaving them out puts a hole in the
 * leaderboard; the mean reads as "how predictable were you", which is the thing
 * the round is actually measuring about them.
 *
 * Returns {} when there is no answer key (an unscored round, or a subject who
 * never finished their board) — callers gate applyRoundScores on that.
 */
export function finalScores(state, playerIds, { opinion = false, scoring = true } = {}) {
  if (!scoring) return {};
  const truth = truthFor(state, { opinion });
  if (!truth) return {};

  const out = {};
  for (const id of playerIds) {
    if (opinion && id === state.subjectId) continue;
    out[id] = scoreBoard(state.boards?.[id], state.deck, truth).score;
  }

  if (opinion && state.subjectId && playerIds.includes(state.subjectId)) {
    const guesses = Object.values(out);
    out[state.subjectId] = guesses.length
      ? Math.round(guesses.reduce((a, b) => a + b, 0) / guesses.length)
      : 0;
    // The reader bonus goes on AFTER the subject's average is taken, so being
    // read well never inflates the subject's own number.
    for (const id of bestReaders(out, state.subjectId)) out[id] += READER_BONUS;
  }
  return out;
}

// Who read the subject best: the guessers with the top score, tied ones
// together, and nobody when the best guess scored nothing. `scores` is the
// round's guess scores keyed by player (the subject's own entry is ignored).
export function bestReaders(scores, subjectId) {
  const guesses = Object.entries(scores ?? {}).filter(([id]) => id !== subjectId);
  if (!guesses.length) return [];
  const top = Math.max(...guesses.map(([, n]) => n));
  if (!(top > 0)) return [];
  return guesses.filter(([, n]) => n === top).map(([id]) => id);
}

// Folds a round's scores into the running totals. Not idempotent — callers gate
// it, the same way AniGuess's applyRoundScores is gated by a banking claim.
export function applyRoundScores(totalScores, roundScores) {
  const out = { ...totalScores };
  for (const [id, score] of Object.entries(roundScores)) {
    out[id] = (out[id] || 0) + score;
  }
  return out;
}

// --- the match -----------------------------------------------------------------
//
// One line per banked round, for the final screen's awards: who was the
// subject, who read them best, who got every comparison right, the best board
// (null on a tie: two equal boards are nobody's), and each judged board's own
// numbers — `marks[id]` is `{ c, of, exact }` (comparisons right, out of, cards
// in exactly the right slot) and `worst[id]` the card it put furthest from home,
// as `{ title, slot, trueSlot }` (1-based). The subject of an opinion round has
// neither: they are the key.
export function roundLogEntry(state, playerIds, { opinion = false, scoring = true } = {}) {
  const truth = scoring ? truthFor(state, { opinion }) : null;
  const judged = truth ? playerIds.filter((id) => !(opinion && id === state.subjectId)) : [];
  const marks = {};
  const worst = {};
  for (const id of judged) {
    const { concordant, comparisons, exact, slots } = explainBoard(state.boards?.[id], state.deck, truth);
    if (!comparisons) continue;
    marks[id] = { c: concordant, of: comparisons, exact };
    const far = slots.reduce((a, s) => (s.item && Math.abs(s.drift ?? 0) > Math.abs(a?.drift ?? 0) ? s : a), null);
    if (far && far.trueSlot != null) {
      worst[id] = { title: far.item.title ?? '', slot: far.slot + 1, trueSlot: far.trueSlot, off: Math.abs(far.drift) };
    }
  }
  const scores = finalScores(state, playerIds, { opinion, scoring });
  const top = Math.max(0, ...Object.values(marks).map((m) => m.c));
  const atTop = Object.keys(marks).filter((id) => marks[id].c === top);
  return {
    subjectId: opinion ? state.subjectId ?? null : null,
    readers: opinion ? bestReaders(scores, state.subjectId) : [],
    perfect: Object.fromEntries(Object.entries(marks)
      .filter(([id]) => scoreBoard(state.boards?.[id], state.deck, truth).perfect)
      .map(([id]) => [id, true])),
    best: top > 0 && atTop.length === 1 ? atTop[0] : null,
    marks,
    worst,
  };
}

/**
 * The final screen's superlatives: five good, five roasts, each a clear leader
 * or nothing (a tie drops it). The card (shared/utils/awards.js's pickAwards)
 * shows two of each. Lines from before `marks`/`worst` were logged skip the
 * awards that need them.
 *
 *   Perfect board   every comparison right, the rarest thing this game makes
 *   Telepath        read the subject best (opinion rounds)
 *   Open book       as the subject, the table read them best (2+ subjects)
 *   Pinpoint        the most cards in exactly the right slot on one board (5+)
 *   Glow-up         the biggest jump from one round's board to the next
 *   Upside down     the worst board on a fact round, 40% or under (roast)
 *   Way off         the furthest any card landed from home, 5+ slots (roast)
 *   Enigma          as the subject, the table read them worst (roast, 2+ subjects)
 *   Total stranger  the worst read of a subject, half or under (roast)
 *   Freefall        the biggest drop from one round's board to the next (roast)
 */
export function matchAwards(log = [], players = []) {
  const lines = (log ?? []).filter(Boolean);
  const byId = (id) => players.find((p) => p.id === id) ?? null;
  const nameOf = (id) => byId(id)?.name ?? 'the subject';
  const pct = (m) => m.c / m.of;
  const cards = (of) => Math.round((1 + Math.sqrt(1 + 8 * of)) / 2);
  const out = [];

  const perfect = clearLeader(tally(lines, (l) => Object.keys(l.perfect ?? {})));
  if (perfect) {
    out.push(award('Perfect board', byId(perfect.id),
      `Every comparison right${perfect.n > 1 ? `, ${perfect.n} times` : ''}`, { weight: 3 }));
  }
  const read = lines.filter((l) => l.subjectId && (l.readers ?? []).length);
  const telepath = clearLeader(tally(read, (l) => l.readers));
  if (telepath) {
    const l = read.filter((x) => x.readers.includes(telepath.id)).at(-1);
    out.push(award('Telepath', byId(telepath.id), telepath.n === 1
      ? `Read ${nameOf(l.subjectId)} better than anyone`
      : `Read the subject best ${times(telepath.n)}`, { weight: 2 }));
  }

  // How well the table read each subject: the mean of their guessers' boards.
  const subjects = lines.filter((l) => l.subjectId && Object.keys(l.marks ?? {}).length).map((l) => {
    const ms = Object.values(l.marks);
    return { by: l.subjectId, v: ms.reduce((a, m) => a + pct(m), 0) / ms.length };
  });
  if (new Set(subjects.map((s) => s.by)).size > 1) {
    const open = clearBest(subjects, (s) => s.v);
    const enigma = clearBest(subjects, (s) => s.v, { dir: 'min' });
    if (open && enigma && open.by !== enigma.by) {
      out.push(award('Open book', byId(open.by), `The table read them at ${Math.round(open.v * 100)}%`));
      out.push(award('Enigma', byId(enigma.by), `Nobody could read them: ${Math.round(enigma.v * 100)}%`, { roast: true }));
    }
  }

  const boards = lines.flatMap((l, k) => Object.entries(l.marks ?? {})
    .filter(([, m]) => m?.of > 0).map(([by, m]) => ({ by, k, subjectId: l.subjectId ?? null, ...m })));
  const pin = clearBest(boards, (b) => b.exact);
  if (pin && pin.exact >= 5) out.push(award('Pinpoint', byId(pin.by), `${pin.exact} of ${cards(pin.of)} cards in exactly the right slot`));

  // Each player's board against their own one round before.
  const swings = [];
  for (const b of boards) {
    const prev = boards.filter((x) => x.by === b.by && x.k < b.k).at(-1);
    if (prev) swings.push({ by: b.by, d: pct(b) - pct(prev), from: prev, to: b });
  }
  const glow = clearBest(swings, (s) => s.d);
  if (glow && glow.d >= 0.3) {
    out.push(award('Glow-up', byId(glow.by), `From ${glow.from.c}/${glow.from.of} to ${glow.to.c}/${glow.to.of} the next round`));
  }

  const flop = clearBest(boards.filter((b) => !b.subjectId), pct, { dir: 'min' });
  if (flop && pct(flop) <= 0.4) {
    out.push(award('Upside down', byId(flop.by), `${flop.c} of ${flop.of} comparisons right`, { roast: true }));
  }
  const misses = lines.flatMap((l) => Object.entries(l.worst ?? {}).map(([by, w]) => ({ by, ...w })));
  const far = clearBest(misses, (w) => w.off);
  if (far && far.off >= 5) {
    out.push(award('Way off', byId(far.by), `Put ${far.title || 'a card'} at #${far.slot} — it belongs at #${far.trueSlot}`, { roast: true }));
  }
  const stranger = clearBest(boards.filter((b) => b.subjectId), pct, { dir: 'min' });
  if (stranger && pct(stranger) <= 0.5) {
    out.push(award('Total stranger', byId(stranger.by), `Read ${nameOf(stranger.subjectId)} at ${stranger.c} of ${stranger.of}`, { roast: true }));
  }
  const fall = clearBest(swings, (s) => s.d, { dir: 'min' });
  if (fall && fall.d <= -0.3) {
    out.push(award('Freefall', byId(fall.by), `From ${fall.from.c}/${fall.from.of} to ${fall.to.c}/${fall.to.of} the next round`, { roast: true }));
  }
  return out.filter(Boolean);
}
