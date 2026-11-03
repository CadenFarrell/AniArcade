// All AniTag logic: no React, no storage, no network. Each function takes a
// slice of round state and returns a { patch } for the caller to apply however
// its persistence layer works — useState locally, a Firebase transaction online.
// See CLAUDE.md: change game behaviour here, not in the hooks, or local and
// online drift apart.
//
// ONE GAME: YOU HOLD A CLAUSE YOU CANNOT SEE AND EVERYONE ELSE CAN. On your go
// you name ONE thing — "Nezuko?" — and one derived judge answers yes or no
// against your hidden clause, so the rule you are inducing is your own.
//
// WHERE THE CLAUSE COMES FROM is the only choice a session makes (`source`):
//
//   table (the default)  everybody else PICKS it for you while you look away —
//                        AniGuess's character assignment, applied to a rule.
//                        The round opens in `picking`, one player at a time
//                        (see pickingFor), and nobody names anything until
//                        every player still here has one.
//
//   random               it is DEALT from the built-ins (plus the dealer's own
//                        written ones), and the round opens straight onto a go.
//
// Either way the clause lands in the same place and nothing after `picking`
// knows which it was. This replaced a second MODE — "pick your own", where you
// chose a clause only you knew and everyone answered every name — which made a
// different game share this folder; see CLAUDE.md beside this file.
//
// THE SEAT MOVES AFTER EVERY SINGLE NAME, and that is the shape of the game
// rather than a pacing tweak. One player, one name, pass — so at two players it
// is the back-and-forth it reads as, and at six nobody waits through five whole
// hands before their first go. `cap` is therefore names per player PER ROUND,
// not per uninterrupted block, and it is settlePending that hands the seat on:
// see seatFrom. What ENDS a player's round is unchanged and is the only thing
// `results` has ever meant — a correct declaration, a pass, or spending the cap.
// Everyone else keeps playing until they each reach one of those, which is why
// the last player standing simply keeps the seat.
//
// It is AniGuess inverted — there you ask yes/no questions about a hidden
// character, here you offer characters and induce a hidden rule.
//
// A CLAUSE IS NEVER IN ROUND STATE WHILE IT IS STILL WORTH SOMETHING, and that
// is the whole security model. startRound does not take one and does not store
// one. It lives in rooms/{code}/assignments/{playerId} — read and write DENIED
// to the assignee, allowed to everyone else, so hidden from exactly one person.
// AniGuess already needed that node, so neither source required a
// database.rules.json change. The table's proposals are written to the SAME
// slot while they pick, so the clause a pick locks in is already where the
// round reads it from.
//
// NOBODY MAY DEAL OR PICK THEIR OWN — the rule refuses the write, so it is
// enforced by Firebase rather than by a client-side check. A random deal is
// split across two devices for exactly that reason; a table pick needs no
// such care, since the target's device never writes it at all.
//
// A WRONG DECLARATION COSTS NAMES, NOT THE ROUND. It used to end the turn
// outright, which was right when a turn was an uninterrupted block of ten and is
// wrong now that the seat moves every name: a miss on name two would mean
// spectating the rest of the round on a device you are holding. So a miss lands
// in the misser's own trail as an entry with `kind: 'declaration'`, weighing
// WRONG_DECLARATION_COST names instead of one — see proposalsUsed. That single
// entry is the penalty, the record that stops them aiming at the same person
// twice (declaredTargets), and a row the table can read, with no new state.
//
// LOCAL AND ONLINE ARE SYMMETRIC. `trails` is { [playerId]: [entry] } in both,
// and a trail is PUBLIC — it is the whole information channel, and the hot seat
// has to be able to re-read it. Only the clause is hidden. So nothing in this
// file branches on where it is running, and the local screen differs from the
// online one only in that one device shows what three devices would.

// A hot seat and one other player. Two is the number the game is built around —
// nothing else in the arcade works at two, since AniGuess, AniFake and AniWave
// all need a table — and it scales up with no change. At two, the table that
// picks your clause is one person, who then also judges it.
export const MIN_PLAYERS = 2;

// Long enough for "Edward Elric" and "Legend of the Galactic Heroes", short
// enough that the trail stays a list of names rather than a chat log. Applied in
// rules rather than in the input so a proposal arriving from another device is
// cleaned by the same rule as one being typed.
export const MAX_PROPOSAL_LEN = 60;

// The two things a judge can be asked to rule on. One pending slot with a `kind`
// rather than two slots, because they are mutually exclusive by construction —
// you cannot be declaring and proposing at once — and two slots would make that
// representable, and therefore eventually real.
export const PENDING_KINDS = ['proposal', 'declaration'];

// How many names one player gets per ROUND — spent one at a time, since the
// seat moves after every name. Bounds only; the live value is a pref copied onto
// the round, because this file acts on it (see settlePending) which is
// CLAUDE.md's stated test for which prefs reach round state.
export const MIN_CAP = 3;
export const MAX_CAP = 20;
export const DEFAULT_CAP = 10;

// What a missed declaration costs, in names. High enough that "declare after
// every name until something sticks" is not the dominant strategy — which is
// exactly what ending the whole turn used to buy — and low enough that a miss
// early on is not a round spent watching. At MIN_CAP a single miss ends the
// round, which is the intended reading of a three-name game.
//
// THE ONE NUMBER WORTH CHANGING if a table finds it harsh, and rules.test.js
// pins it so that change is deliberate rather than incidental.
export const WRONG_DECLARATION_COST = 3;

const clean = (text, max) => (text || '')
  .trim()
  .replace(/\s+/g, ' ')
  .slice(0, max);

// Where a session's clauses come from, in the order the setup screen renders
// them — so the default is the one a player reads first. Here rather than in
// prefs.js because this file acts on it (startRound opens a `picking` phase for
// one and not the other); prefs.js re-exports it so a screen cannot invent a
// third.
export const CATEGORY_SOURCES = ['table', 'random'];

/**
 * Where a round's clauses come from.
 *
 * DEFAULTS TO 'random', WHICH IS THE OPPOSITE OF THE PREF'S DEFAULT, and that
 * is deliberate rather than an oversight. The only round that can reach here
 * without a `source` is one written by the build before this field existed,
 * and the clauses of a round like that were dealt. Every live caller passes it.
 */
const toSource = (source) => (source === 'table' ? 'table' : 'random');

/** True when the table picks each clause rather than the deal. */
export const isTablePicked = (state) => toSource(state?.source) === 'table';

/**
 * A category spec, or null.
 *
 * DELIBERATELY DOES NOT INTERPRET IT. This module never learns what a category
 * is — the same way anirank's rules.js never learns what it is ranking and
 * wavelength's never learns what a spectrum is — so all it checks is that the
 * value is one of the two shapes categories.js resolves (a built-in's id, or a
 * written category's whole definition) and that it carries something. That last
 * part is not fussiness: an object with no keys is not stored by Realtime
 * Database at all, so accepting `{}` here would deal a turn whose category reads
 * back as absent.
 */
export function toSpec(spec) {
  if (typeof spec === 'string' && spec) return spec;
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
    if (spec.id || spec.label) return spec;
  }
  return null;
}

const toCap = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return DEFAULT_CAP;
  return Math.min(MAX_CAP, Math.max(MIN_CAP, Math.round(v)));
};

/**
 * A fresh round.
 *
 * NOTHING ABOUT WHAT ANY TURN IS *ABOUT* IS DECIDED HERE — no categories, not
 * even for the first seat. That is the same split wavelength's startRound makes
 * and it exists for a sharper reason here: this function is called by the host
 * online, and the host must not compute their own category. A random deal
 * happens outside, in two writes from two devices; a table pick happens during
 * the `picking` phase, written by everyone but its target. Either way it lands
 * where this module cannot see it even if it wanted to.
 */
export function startRound(playerIds = [], {
  round = 0, cap = DEFAULT_CAP, source = 'random', skipIds = [],
} = {}) {
  return {
    round,
    cap: toCap(cap),
    source: toSource(source),
    // The first player who is actually here, counting from a seat that MOVES
    // BETWEEN ROUNDS — see nextSeatId. Deliberately not playerIds[0]: that
    // hands the opening turn to whoever happens to sit at index 0 even when
    // they closed the tab, which is aniguess's firstActiveIndex lesson.
    seatId: nextSeatId(playerIds, {}, skipIds, round),
    // A table pick has to settle everyone's clause before anybody can name
    // anything. A random deal happens outside the round entirely, so it opens
    // straight onto a go.
    phase: toSource(source) === 'table' ? 'picking' : 'naming',
    pending: null,
    picked: {},
    trails: {},
    results: {},
    // What the table just watched happen. See normalizeGame.
    lastPlayed: null,
  };
}

/**
 * Whose turn it is: the first player still here who has not had one yet,
 * counting forward from `startAt` and wrapping. Null when the round is done.
 *
 * Roster order rather than a stored index, so a departure cannot leave the seat
 * pointing at a hole — and `results` doubles as the record of who has been,
 * which is why a turn that ran out of names still writes one.
 *
 * `startAt` IS AN OFFSET AND ITS TWO CALLERS WANT DIFFERENT ONES, which is the
 * whole reason it is a parameter. startRound passes the ROUND NUMBER, so the
 * opening seat moves between rounds — and pickingFor passes it too, so who
 * looks away first moves with it. seatFrom passes the seat's own index plus one, because mid-round the
 * question is who sits next rather than who sits first. Passing 0 reproduces
 * plain roster order exactly, which is what every pre-rotation caller did.
 */
export function nextSeatId(playerIds = [], results = {}, skipIds = [], startAt = 0) {
  const n = playerIds.length;
  if (!n) return null;
  const from = ((Math.trunc(Number(startAt) || 0) % n) + n) % n;
  for (let i = 0; i < n; i++) {
    const id = playerIds[(from + i) % n];
    if (!results[id] && !skipIds.includes(id)) return id;
  }
  return null;
}

/**
 * The next player after the seat who has not finished their round.
 *
 * CONTINUES THE ROTATION RATHER THAN RESTARTING IT, which is the whole reason
 * it exists beside nextSeatId rather than inside it. nextSeatId scans from an
 * OFFSET, and the two callers want different offsets: startRound wants the round
 * number, so the opening seat moves between rounds, and everything mid-round
 * wants the seat itself, so a name hands on to the person sitting next rather
 * than back to whoever the round happened to open on.
 *
 * Returns null when nobody is left un-finished — which nextTurn reads as "the
 * round is over" and settlePending reads as "the seat keeps naming", because the
 * seat's own missing result is what makes the scan wrap back onto them.
 */
function seatFrom(state, results, playerIds = [], skipIds = []) {
  if (!playerIds.length) return null;
  const from = playerIds.indexOf(state?.seatId);
  return nextSeatId(playerIds, results, skipIds, from < 0 ? (state?.round ?? 0) : from + 1);
}

/**
 * Who answers yes or no this turn.
 *
 * The next active player after the hot seat, wrapping. DERIVED, never stored.
 * That is what makes a judge who walks out a non-event: the next active player
 * simply becomes the judge on the next render, with no write, no reconciliation
 * effect and no one-shot. Do not "fix" this by storing a judgeId.
 *
 * Deterministic, so there is no race over who gets to rule and no tally
 * anywhere that could correlate a verdict with a person.
 *
 * Returns null when nobody else is here, which requiredJudges passes through as
 * an empty required list and settlePending reads as "this turn cannot finish".
 */
export function judgeIdFor(state, playerIds = [], skipIds = []) {
  const seatId = state?.seatId;
  if (!seatId) return null;
  const eligible = playerIds.filter((id) => id !== seatId && !skipIds.includes(id));
  if (!eligible.length) return null;
  const from = playerIds.indexOf(seatId);
  // Walk forward from the seat so the role rotates with the table rather than
  // parking on whoever sorts first.
  for (let i = 1; i <= playerIds.length; i++) {
    const candidate = playerIds[(from + i) % playerIds.length];
    if (eligible.includes(candidate)) return candidate;
  }
  return eligible[0];
}

/**
 * WHO MUST RULE ON THE PENDING ITEM: the derived judge, as a list.
 *
 * A LIST OF ONE RATHER THAN AN ID, because judge and settlePending were built
 * around "every required judge has answered" and that reads the same for one.
 * Keeping the shape means a second judge — should a table ever want the whole
 * table to rule — is a change here and nowhere else.
 *
 * Takes `skipIds` for the same reason every readiness gate in the arcade does:
 * a closed tab must not be able to hold a turn open forever. A required list
 * that empties out is not an error — settlePending ends the turn.
 */
export function requiredJudges(state, playerIds = [], skipIds = []) {
  const pending = state?.pending;
  if (!pending || !state?.seatId) return [];
  const judgeId = judgeIdFor(state, playerIds, skipIds);
  return judgeId ? [judgeId] : [];
}

/** One player's trail this round, oldest first. Always an array. */
export const trailFor = (state, playerId) => state?.trails?.[playerId] ?? [];

/**
 * How many names a player has spent this round.
 *
 * NOT THE TRAIL'S LENGTH: a missed declaration is stored in the trail like a
 * name and weighs WRONG_DECLARATION_COST of them. Carrying the penalty here
 * rather than in a `penalties` map is what keeps it free — one collection, and
 * `used` already flows into scoreTurn, so a miss costs points in the currency
 * the game had. A CORRECT declaration is never in the trail at all; it ends the
 * round from the pending slot.
 */
export const proposalsUsed = (state, playerId) => trailFor(state, playerId)
  .reduce((n, entry) => n + (entry?.kind === 'declaration' ? WRONG_DECLARATION_COST : 1), 0);

/** Names left this round. Never negative, so a screen can render it raw. */
export const proposalsLeft = (state, playerId) => (
  Math.max(0, (state?.cap ?? DEFAULT_CAP) - proposalsUsed(state, playerId))
);

/**
 * One trail entry's verdicts, as a list a screen can render without branching.
 *
 * TWO SHAPES LAND HERE and callers must see one: an entry with its judge's
 * answer keyed by judge, and an entry written by the build before verdicts were
 * attributed at all, which stored a single unattributed boolean. `judgeId` is
 * null only in that last case. (A verdict MAP rather than one boolean is left
 * over from "pick your own", where every player answered every name; it costs
 * nothing and keeps a room's old trail readable.)
 */
export function verdictsOf(entry) {
  const map = entry?.verdicts ?? {};
  const ids = Object.keys(map);
  if (ids.length) return ids.map((judgeId) => ({ judgeId, verdict: map[judgeId] === true }));
  if (typeof entry?.verdict === 'boolean') return [{ judgeId: null, verdict: entry.verdict }];
  return [];
}

// --- picking (the table picks each clause) ----------------------------------

/** Has the table locked in a clause FOR this player this round? */
export const hasPicked = (state, playerId) => state?.picked?.[playerId] === true;

/**
 * Who the table is picking for right now: the first player still here with no
 * clause yet, counting from the ROUND NUMBER and wrapping. Null outside the
 * picking phase, and null once everyone still here has one.
 *
 * ONE AT A TIME, the way AniGuess assigns characters, because a pick is a
 * conversation — six clauses being argued over at once is six conversations.
 * Derived from `picked` and the roster rather than stored as an index, so a
 * target who closes their tab mid-pick is simply skipped on the next render
 * rather than wedging the table on a slot nobody can finish. The offset is the
 * round so who looks away first moves between rounds, as the opening seat does.
 */
export function pickingFor(state, playerIds = [], skipIds = []) {
  if (!state || state.phase !== 'picking') return null;
  return nextSeatId(playerIds, state.picked ?? {}, skipIds, state.round ?? 0);
}

/**
 * Records THAT a player's clause is locked in. Never WHAT it is.
 *
 * The flag is public — the table has to see whose clause it is still picking —
 * and the clause it stands for lives in assignments/, which its target cannot
 * read. The property is that the information does not exist in state/, not
 * that no screen renders it.
 */
export function recordPick(state, playerId) {
  if (!state || state.phase !== 'picking' || !playerId) return { patch: {} };
  if (hasPicked(state, playerId)) return { patch: {} };
  return { patch: { picked: { ...state.picked, [playerId]: true } } };
}

/**
 * Everyone still here has a clause.
 *
 * Counts the ACTIVE roster, so a player who closed their tab during the pick
 * cannot hold the round on its opening screen forever. Empty is false rather
 * than vacuously true — a round with nobody in it is not ready to start.
 */
export function everyonePicked(state, activeIds = []) {
  if (!state || !activeIds.length) return false;
  return activeIds.every((id) => hasPicked(state, id));
}

/** Opens the first go once everyone has a clause. Idempotent by phase. */
export function beginNaming(state, activeIds = []) {
  if (!state || state.phase !== 'picking') return { patch: {} };
  if (!everyonePicked(state, activeIds)) return { patch: {} };
  return { patch: { phase: 'naming' } };
}

// --- the turn ----------------------------------------------------------------

/**
 * The hot seat offers a name.
 *
 * Does NOT append to the trail — a proposal with no verdict is not yet
 * information — it parks in the single pending slot until the judges rule. That
 * split is what makes the online path work at all: the hot seat types on their
 * device and the judges answer on theirs, which is several writes, and
 * collapsing them would mean the hot seat recording their own answer.
 *
 * Rejects rather than throws on every way this arrives twice: a double tap, a
 * replayed write, or a device still rendering a phase the room has moved past.
 */
export function proposeName(state, playerId, text) {
  if (!state || state.phase !== 'naming') return { patch: {} };
  if (!playerId || state.seatId !== playerId) return { patch: {} };
  if (proposalsLeft(state, playerId) <= 0) return { patch: {} };
  const name = clean(text, MAX_PROPOSAL_LEN);
  if (!name) return { patch: {} };
  return { patch: { phase: 'judging', pending: { kind: 'proposal', text: name, verdicts: {} } } };
}

/**
 * The hot seat commits to a rule — their own, the only one they can be hunting.
 *
 * Goes through the same pending slot as a name, because it needs the same thing:
 * a human deciding whether it matches. A category is a clause, so there is no
 * string comparison that could stand in — "characters with glasses" and "wears
 * glasses" are the same answer and no equality test in this repo says so.
 *
 * Allowed with zero names spent. Declaring blind is a legitimate move and an
 * almost impossible one; scoreTurn caps what it pays rather than forbidding it.
 */
export function declareCategory(state, playerId, guess) {
  if (!state || state.phase !== 'naming') return { patch: {} };
  if (!playerId || state.seatId !== playerId) return { patch: {} };
  const text = clean(guess, MAX_PROPOSAL_LEN);
  if (!text) return { patch: {} };
  return { patch: { phase: 'judging', pending: { kind: 'declaration', text, verdicts: {} } } };
}

/**
 * One judge answers.
 *
 * Records the verdict against that judge and then tries to settle. Refuses a
 * judge who is not required and one who has already answered — both of which
 * arrive in ordinary play, from a stale screen and from a double tap.
 *
 * Takes the required list rather than deriving it, so the caller's answer and
 * this function's are the same answer by construction. Who may call it at all
 * is requiredJudges' verdict and the caller's job to enforce, for the same
 * reason wavelength's revealTarget takes no caller.
 *
 * It DOES take the roster as well, and only to hand straight to settlePending,
 * which needs it to move the seat on. Passing it rather than storing a seat
 * index keeps this file's "no roster in state" rule intact.
 */
export function judge(state, judgeId, verdict, requiredIds = [], playerIds = [], skipIds = []) {
  if (!state || state.phase !== 'judging') return { patch: {} };
  const current = state.pending;
  if (!current || !PENDING_KINDS.includes(current.kind)) return { patch: {} };
  if (!state.seatId) return { patch: {} };
  if (!judgeId || !requiredIds.includes(judgeId)) return { patch: {} };
  if (typeof current.verdicts?.[judgeId] === 'boolean') return { patch: {} };

  const pending = {
    ...current,
    verdicts: { ...(current.verdicts ?? {}), [judgeId]: verdict === true },
  };
  const settled = settlePending({ ...state, pending }, requiredIds, playerIds, skipIds);
  if (Object.keys(settled.patch).length) return settled;
  // Not everyone has answered yet. The verdict still has to land, or the next
  // judge's device would write into a slot that still looks empty.
  return { patch: { pending } };
}

/**
 * Commits a pending item once every judge who owed an answer has given one, and
 * hands the seat to the next player.
 *
 * PURE AND IDEMPOTENT, AND SEPARATE FROM judge ON PURPOSE. The set of judges
 * who owe an answer SHRINKS when somebody leaves, so a pending that could not
 * settle a minute ago can settle now with no new verdict at all — and the only
 * thing that can notice is a departure effect, which has no verdict to submit.
 * Folding this into judge would leave that room waiting on a device that is
 * never coming back.
 *
 * AN EMPTY REQUIRED LIST ENDS THE PLAYER'S ROUND rather than committing
 * anything. It means nobody is left who could answer, so the name is
 * unanswerable and the declaration unverifiable; recording either would be
 * inventing a verdict nobody gave. The seat keeps the points they already
 * banked and the round moves on, which is the same escape passTurn and
 * abandonTurn reach by hand.
 *
 * FOUR OUTCOMES:
 *
 *   a correct declaration  ends the declarer's round with the points. It never
 *                          enters the trail — it is the thing the trail was for.
 *   anything else          lands in the trail as { text, verdicts } (plus `kind`
 *                          on a miss) and THE SEAT MOVES ON. A `no` is worth
 *                          exactly as much as a `yes`, which is why both are
 *                          stored the same way and neither is filtered out of
 *                          the count.
 *   …a NAME that spent     is written the same way, but THE SEAT STAYS: the
 *    the cap               player has just heard the answer to their last name,
 *                          and the go they are still holding is their final
 *                          guess (or a give-up). Ending the round here showed
 *                          them the answer before they could use that last
 *                          piece of evidence, which is the bug this replaced.
 *   …a MISS that spent     ends the player's round with it — the floor under
 *    the cap               the softened miss rule.
 *
 * `results` is still the record of who has finished, which is why the last case
 * writes one even though nothing was solved: omitting it would hand that player
 * the seat again forever.
 *
 * TAKES THE ROSTER PURELY TO MOVE THE SEAT. Without it there is no way to say
 * who sits next, and the alternative — a stored seat index — is the thing
 * nextSeatId exists to avoid.
 */
export function settlePending(state, requiredIds = [], playerIds = [], skipIds = []) {
  if (!state || state.phase !== 'judging') return { patch: {} };
  const pending = state.pending;
  if (!pending || !PENDING_KINDS.includes(pending.kind)) return { patch: {} };
  const seatId = state.seatId;
  if (!seatId) return { patch: {} };
  const verdicts = pending.verdicts ?? {};
  const endRound = (result, extra = {}) => ({
    patch: {
      phase: 'turnEnd',
      pending: null,
      results: { ...state.results, [seatId]: result },
      ...extra,
    },
  });

  if (!requiredIds.length) {
    return endRound({ solved: false, guess: '', used: proposalsUsed(state, seatId) });
  }
  if (!requiredIds.every((id) => typeof verdicts[id] === 'boolean')) return { patch: {} };

  if (pending.kind === 'declaration' && requiredIds.every((id) => verdicts[id] === true)) {
    return endRound({ solved: true, guess: pending.text, used: proposalsUsed(state, seatId) });
  }

  // A name, or a miss. Both are evidence and both go in the same place; only
  // what they WEIGH differs, and proposalsUsed is the one place that knows.
  const entry = {
    text: pending.text,
    verdicts: { ...verdicts },
    ...(pending.kind === 'declaration' ? { kind: 'declaration' } : {}),
  };
  const trails = { ...state.trails, [seatId]: [...trailFor(state, seatId), entry] };
  // What the table just watched happen. One slot, overwritten — see
  // normalizeGame. `kind` is spelled out rather than inherited from `entry`,
  // which carries it only on a miss: normalizeLastPlayed always fills one in, so
  // an implicit 'proposal' here and an explicit one there is a round that stops
  // equalling itself across a JSON round-trip.
  const lastPlayed = { playerId: seatId, ...entry, kind: pending.kind };
  const used = proposalsUsed({ ...state, trails }, seatId);

  if (used < (state.cap ?? DEFAULT_CAP)) {
    return {
      patch: {
        phase: 'naming',
        pending: null,
        trails,
        lastPlayed,
        // Falls back to the seat itself, which is what lets the last player
        // still in the round keep naming after everybody else has finished.
        seatId: seatFrom(state, state.results, playerIds, skipIds) ?? seatId,
      },
    };
  }
  if (pending.kind === 'proposal') {
    // Out of names, not out of the round: the seat keeps the go for a final
    // guess. proposeName refuses at zero left, so declaring or passing are the
    // only ways on from here.
    return { patch: { phase: 'naming', pending: null, trails, lastPlayed, seatId } };
  }
  return endRound(
    { solved: false, guess: pending.kind === 'declaration' ? pending.text : '', used },
    { trails, lastPlayed },
  );
}

/**
 * The hot seat drops out of the round.
 *
 * The escape hatch that stops an untimed round waiting forever on somebody who
 * cannot see it — sitting beside anitune's giveUp and wavelength's revealNow for
 * the same reason. On the hot seat's own device, because dropping out is a
 * decision about your own round and nobody else gets to make it for you.
 *
 * IT IS NOT A "SKIP MY GO", AND THAT ABSENCE IS DELIBERATE. Now that the seat
 * moves after every name, a free skip would be a stalling strategy — sit out
 * every go, watch everybody else's verdicts accumulate, then declare off their
 * evidence with a full cap in hand. Naming one thing is the price of staying in.
 */
export function passTurn(state, playerId) {
  if (!state || (state.phase !== 'naming' && state.phase !== 'judging')) return { patch: {} };
  if (!playerId || state.seatId !== playerId) return { patch: {} };
  return {
    patch: {
      phase: 'turnEnd',
      pending: null,
      results: {
        ...state.results,
        [playerId]: { solved: false, guess: '', used: proposalsUsed(state, playerId) },
      },
    },
  };
}

/**
 * The host ends the round of a player who has stopped moving.
 *
 * THE SECOND ESCAPE HATCH, and it is a different one from passTurn rather than
 * the same function with the caller check removed. Presence cannot see a player
 * who is connected and simply not acting — a hot seat reading their phone is
 * indistinguishable from one thinking hard, and so is a judge who has stopped
 * answering — so an untimed turn waits forever and only somebody else can end
 * it. passTurn is that decision made by the person whose turn it is; this is it
 * made for them.
 *
 * Takes no caller: unlike AniWave's revealNow this needs no secret, so any
 * device could technically perform it and the host owning it is a UI choice
 * rather than a constraint. Naming them separately is what stops the seat's own
 * "give up" quietly becoming a control anybody can press on anybody.
 */
export function abandonTurn(state) {
  if (!state || state.phase === 'turnEnd' || state.phase === 'roundEnd') return { patch: {} };
  if (!state.seatId) return { patch: {} };
  return {
    patch: {
      phase: 'turnEnd',
      pending: null,
      results: {
        ...state.results,
        [state.seatId]: { solved: false, guess: '', used: proposalsUsed(state, state.seatId) },
      },
    },
  };
}

/**
 * Picks up the rotation after somebody's round has ended, or ends the round when
 * nobody is left still playing.
 *
 * ONLY FIRES FROM `turnEnd`, which is now a rarer event than it was: the seat
 * moves after every name inside settlePending, and this runs only when a player
 * has actually finished — solved, gave up, or spent their cap.
 *
 * Continues from the seat rather than rescanning from the round offset (see
 * seatFrom), so the person sitting next to whoever just finished goes next,
 * which is what the table can see coming.
 *
 * Pass the ACTIVE roster's departures as `skipIds`: a closed tab would otherwise
 * hold the seat forever, since only the hot seat's own device can name or
 * declare.
 */
export function nextTurn(state, playerIds = [], skipIds = []) {
  if (!state || state.phase !== 'turnEnd') return { patch: {} };
  const seatId = seatFrom(state, state.results, playerIds, skipIds);
  if (!seatId) return { patch: { phase: 'roundEnd', pending: null } };
  return { patch: { seatId, phase: 'naming', pending: null } };
}

/**
 * The rotation, as a screen has to draw it.
 *
 * ONE ROW PER PLAYER IN ROSTER ORDER, which IS seat order — the seat walks
 * forward through this list and wraps, so drawing it in any other order would
 * make the next player unguessable. Derived rather than stored for the reason
 * every other derived thing here is, and pure rather than assembled in the two
 * hooks because they would assemble it differently and only one of them is
 * covered by tests.
 *
 * `done` and `solved` are two facts, not one: a player who gave up and one who
 * declared correctly have both finished, and a strip that drew them the same way
 * would lose the only thing worth reporting about the round so far.
 */
export function turnOrder(state, playerIds = [], skipIds = []) {
  return playerIds.map((playerId) => {
    const result = state?.results?.[playerId] ?? null;
    return {
      playerId,
      isSeat: state?.seatId === playerId,
      used: proposalsUsed(state, playerId),
      left: proposalsLeft(state, playerId),
      done: !!result,
      solved: result?.solved === true,
      away: skipIds.includes(playerId),
    };
  });
}

/**
 * Everyone still here has had a turn.
 *
 * Counts the ACTIVE roster rather than results.length, since a player who left
 * mid-round will never take one and would hold the round open forever.
 */
export function roundComplete(state, activeIds = []) {
  if (!state) return false;
  if (state.phase === 'roundEnd') return true;
  return activeIds.every((id) => !!state.results?.[id]);
}

/**
 * Repairs a round after a departure. Returns a no-op patch when nothing broke.
 *
 * ONLY THE HOT SEAT NEEDS THIS. A departed judge is repaired by judgeIdFor
 * returning somebody else on the next render — no write at all — and a pending
 * name they owed is settled by settlePending. A departed spectator was never
 * blocking anything. The seat is the one role that holds a turn nobody else can
 * finish.
 *
 * KEEPS THE ROUND IN `picking` IF THAT IS WHERE IT WAS. The seat is chosen
 * before anybody has a clause, so a seat who leaves during the pick still has
 * to be replaced — but promoting the round to `naming` at the same time would
 * open a go before the rest of the table has a clause to be judged against.
 *
 * Records the round as unsolved rather than skipping it, so `results` still says
 * they are finished: without that, seatFrom would offer them the seat again the
 * moment their presence flickered back.
 */
export function skipDepartedSeat(state, playerIds = [], departedIds = []) {
  if (!state || state.phase === 'turnEnd' || state.phase === 'roundEnd') return { patch: {} };
  if (!state.seatId || !departedIds.includes(state.seatId)) return { patch: {} };
  const results = {
    ...state.results,
    [state.seatId]: { solved: false, guess: '', used: proposalsUsed(state, state.seatId) },
  };
  const seatId = seatFrom(state, results, playerIds, departedIds);
  if (!seatId) return { patch: { phase: 'roundEnd', pending: null, results } };
  const phase = state.phase === 'picking' ? 'picking' : 'naming';
  return { patch: { seatId, phase, pending: null, results } };
}

// --- revealing ---------------------------------------------------------------

/**
 * Writes a finished player's category onto their result.
 *
 * THE HOT SEAT CAN NEVER PUBLISH THEIR OWN. Their category lives in a node whose
 * rules deny them read as well as write, so at the end of their turn they are
 * the one person at the table who still does not know what it was. Some other
 * device has to say — and every other device may, because a category is secret
 * from exactly one player rather than from the room.
 *
 * That is the mirror image of AniFake's publishCard, and it lands in the same
 * place for the same reason: no device is trusted with more than it was already
 * allowed to see, and the answer only enters state/ once the turn it belongs to
 * is over. Any non-owner may call it, so a judge who leaves between ruling and
 * revealing costs nothing — the next device to notice fills it in.
 *
 * Idempotent, and refuses to overwrite: two devices racing to be helpful write
 * the same value once.
 */
export function attachCategory(state, playerId, spec) {
  const result = state?.results?.[playerId];
  if (!result || result.category) return { patch: {} };
  const category = toSpec(spec);
  if (!category) return { patch: {} };
  return { patch: { results: { ...state.results, [playerId]: { ...result, category } } } };
}

// --- scoring -----------------------------------------------------------------

/**
 * Points for one turn.
 *
 * Fewer names is worth more, and an unsolved turn is worth nothing. Every TWO
 * names cost a point, down to a floor of half the cap: a solve on the last name
 * of ten pays 6 and a solve on the first pays 10. It used to cost a point per
 * name down to 1, which made one lucky early solve worth ten slow ones and
 * decided three-round games on a single go; working the trail properly is now
 * still clearly worth it, and finding the rule at all is worth the most.
 *
 * Bounded at BOTH ends on purpose: the floor keeps a solve on the last name
 * ahead of no solve at all, and the ceiling stops a lucky blind declaration —
 * legal, and almost impossible — from outscoring somebody who actually worked
 * the trail. So used = 0 and used = 1 pay the same, which is the intended
 * reading of "you knew it immediately".
 *
 * Only the solver scores. The players who picked a clause earn nothing from it
 * being found — a deliberate choice, made when the table started picking.
 */
export function scoreTurn({ solved, used = 0, cap = DEFAULT_CAP } = {}) {
  if (!solved) return 0;
  const c = toCap(cap);
  const spent = Math.max(1, used);
  return Math.max(Math.ceil(c / 2), Math.min(c, c - Math.floor((spent - 1) / 2)));
}

/**
 * Per-player detail for the reveal, in roster order.
 *
 * `took` separates "had a turn and missed it" from "never got one" — both score
 * zero, and a screen that drew them the same way would accuse somebody whose tab
 * closed of playing badly. The same distinction wavelength's `placed` makes.
 *
 * `category` is the clause they were hunting, published onto their result by
 * somebody else (see attachCategory). Absent until somebody has.
 */
export function explainRound(state, playerIds = [], categories = {}) {
  return playerIds.map((playerId) => {
    const result = state?.results?.[playerId] ?? null;
    const points = scoreTurn({ solved: result?.solved, used: result?.used, cap: state?.cap });
    return {
      playerId,
      took: !!result,
      solved: result?.solved === true,
      guess: result?.guess ?? '',
      used: result?.used ?? 0,
      trail: trailFor(state, playerId),
      // The published answer first, then whatever this device happens to be
      // able to read. The order matters: the published value is the only source
      // that works on EVERY device — the seat's own device is denied its
      // assignments/ node — while `categories` is the local hook's whole
      // answer, where one device holds every slot.
      category: result?.category ?? categories[playerId] ?? null,
      // `turnPoints` and `points` are the same number. Both names are kept
      // because the turn's end and the round screen read different ones, and
      // "the go's points" and "the round's points" may yet diverge again.
      turnPoints: points,
      points,
    };
  });
}

/** The round's scores. */
export function finalScores(state, playerIds = []) {
  const out = {};
  for (const playerId of playerIds) {
    const result = state?.results?.[playerId];
    if (result) out[playerId] = scoreTurn({ solved: result.solved, used: result.used, cap: state?.cap });
  }
  return out;
}

// Folds a round's scores into the running totals. Not idempotent — callers gate
// it, the same contract aniguess, anirank, anifake and aniwave's all carry.
export function applyRoundScores(totalScores, roundScores) {
  const out = { ...totalScores };
  for (const [id, score] of Object.entries(roundScores || {})) {
    out[id] = (out[id] || 0) + score;
  }
  return out;
}

// --- normalizers -------------------------------------------------------------

/** A { [judgeId]: boolean } map with nothing in it that is not a boolean. */
function normalizeVerdicts(raw) {
  const out = {};
  for (const [id, v] of Object.entries(raw ?? {})) {
    if (typeof v === 'boolean') out[id] = v;
  }
  return out;
}

/** A { [playerId]: true } flag map. Never stores a false — RTDB would keep it. */
function normalizeFlags(raw) {
  const out = {};
  for (const [id, v] of Object.entries(raw ?? {})) {
    if (v === true) out[id] = true;
  }
  return out;
}

/**
 * One trail, repaired.
 *
 * Written as a dense array, so it normally reads back as one — but Realtime
 * Database drops null elements, so a partly-stored trail comes back SPARSE, and
 * a mostly-empty one comes back as an object keyed by index. All three land
 * here. A plain index loop rather than .map, because Array methods silently SKIP
 * HOLES — the exact trap anirank's normalizeBoard documents.
 *
 * Carries a legacy scalar `verdict` through untouched when there is no verdicts
 * map, so a room mid-round across a deploy still renders its trail rather than
 * showing ten names nobody appears to have answered. verdictsOf is the one
 * place that has to know.
 *
 * CARRIES `kind`, and dropping it is not cosmetic: a missed declaration is
 * stored here and weighs WRONG_DECLARATION_COST names, so an entry that came
 * back as a plain name would silently refund two thirds of the penalty on the
 * first read. This is the same "rebuild from NAMED fields" trap normalizeGame
 * documents, one level down.
 *
 * Never invents an entry: a trail short by one is a shorter trail, which is
 * merely a go with a name missing, while a placeholder is a verdict nobody
 * gave that still counts against the cap.
 */
export function normalizeTrail(raw) {
  const source = Array.isArray(raw) ? raw
    : (raw && typeof raw === 'object' ? Object.values(raw) : []);
  const out = [];
  for (let i = 0; i < source.length; i++) {
    const entry = source[i];
    if (!entry || typeof entry !== 'object') continue;
    const text = typeof entry.text === 'string' ? entry.text : '';
    if (!text) continue;
    const verdicts = normalizeVerdicts(entry.verdicts);
    const extra = entry.kind === 'declaration' ? { kind: 'declaration' } : {};
    if (!Object.keys(verdicts).length && typeof entry.verdict === 'boolean') {
      out.push({ text, verdicts, verdict: entry.verdict, ...extra });
      continue;
    }
    out.push({ text, verdicts, ...extra });
  }
  return out;
}

/**
 * Every trail that has been stored, repaired.
 *
 * Deliberately seeds NOTHING from a roster. Every key found is kept and none is
 * invented, which is what makes CLAUDE.md's "rebuilding a keyed collection from
 * the ACTIVE roster deletes departed players' data" trap unable to bite: a
 * player who left keeps their trail through every subsequent write, and the
 * reveal can still show what they had worked out.
 */
export function normalizeTrails(raw) {
  const out = {};
  for (const [id, v] of Object.entries(raw ?? {})) {
    const trail = normalizeTrail(v);
    if (trail.length) out[id] = trail;
  }
  return out;
}

/**
 * Every finished turn, repaired.
 *
 * Same no-seeding rule as normalizeTrails, and here it is load-bearing twice
 * over: `results` is also the record of who has had a turn, so inventing an
 * entry would skip somebody's turn entirely and deleting one would give a
 * departed player the seat again.
 */
export function normalizeResults(raw) {
  const out = {};
  for (const [id, v] of Object.entries(raw ?? {})) {
    if (!v || typeof v !== 'object') continue;
    out[id] = {
      solved: v.solved === true,
      guess: typeof v.guess === 'string' ? v.guess : '',
      used: Number.isFinite(v.used) ? v.used : 0,
      // OMITTED rather than nulled when missing: RTDB does not store a null
      // anyway, and `results.category` is the flag attachCategory tests to
      // stay idempotent.
      ...(toSpec(v.category) ? { category: toSpec(v.category) } : {}),
    };
  }
  return out;
}

/**
 * What the table last watched happen, repaired, or null.
 *
 * ONE SLOT, OVERWRITTEN, AND NOT A SECOND COPY OF THE TRAIL. It exists because a
 * missed declaration no longer produces a turnEnd screen: the seat simply moves
 * on, and without this the only sign a player had just guessed and been told no
 * would be a row appearing in a collapsed trail somebody else's block was
 * covering. Public by construction — every field of it is already in `trails`.
 */
function normalizeLastPlayed(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const playerId = typeof raw.playerId === 'string' ? raw.playerId : '';
  const text = typeof raw.text === 'string' ? raw.text : '';
  if (!playerId || !text) return null;
  return {
    playerId,
    text,
    kind: raw.kind === 'declaration' ? 'declaration' : 'proposal',
    verdicts: normalizeVerdicts(raw.verdicts),
  };
}

/** The pending ruling, repaired, or null when there is not one. */
export function normalizePending(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!PENDING_KINDS.includes(raw.kind)) return null;
  const text = typeof raw.text === 'string' ? raw.text : '';
  if (!text) return null;
  return {
    kind: raw.kind,
    text,
    verdicts: normalizeVerdicts(raw.verdicts),
  };
}

const PHASES = ['picking', 'naming', 'judging', 'turnEnd', 'roundEnd'];

/**
 * The whole round subtree, repaired at the single point it enters a hook.
 * Everything downstream — least of all the screens — can then read it unguarded.
 *
 * Rebuilds from NAMED fields rather than spreading `raw`, which is what stops a
 * stray key riding in from an older build — and is exactly why a field the hook
 * writes has to be named here too, or it is silently dropped on the first read.
 * That is how wavelength's `deadline` never started a clock.
 *
 * `source` falls back to 'random' rather than to the pref's default — see
 * toSource. A round written by the build that still had "pick your own" may
 * also carry `mode`, `reveal` and `targetId`s; they are dropped here, and a
 * room caught mid-way through such a round across the deploy is not repaired
 * (its clauses were in secrets/, where nobody else can read them) — returning to
 * the lobby starts it clean.
 */
export function normalizeGame(raw) {
  if (!raw) return null;
  return {
    round: Number.isFinite(raw.round) ? raw.round : 0,
    cap: toCap(raw.cap),
    source: toSource(raw.source),
    seatId: typeof raw.seatId === 'string' && raw.seatId ? raw.seatId : null,
    phase: PHASES.includes(raw.phase) ? raw.phase : 'naming',
    pending: normalizePending(raw.pending),
    picked: normalizeFlags(raw.picked),
    trails: normalizeTrails(raw.trails),
    results: normalizeResults(raw.results),
    lastPlayed: normalizeLastPlayed(raw.lastPlayed),
  };
}
