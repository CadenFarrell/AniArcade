// AniChain's rules: pure functions over the game state, no React, no storage,
// no network. Each move returns `{ patch }`; an empty patch means "refused",
// which the online hook relies on to abort its transaction.
//
// Two clue-givers build ONE sentence towards a secret character, one word
// each, taking turns. They cannot confer, so each word has to make sense after
// whatever the other just said. After every word the guessers it was for get
// one guess each; the first right guess ends the turn, and the fewer words it
// took, the more it is worth.
//
// **Three table shapes** (the `shape` setting):
//   pair    a pair of givers rotating one seat a round; everyone else guesses.
//           The guesser who gets it scores the value, each giver half.
//   rivals  two teams, one giver each, sharing the sentence. After a word only
//           the team whose giver said it may guess — so a word that sets the
//           answer up hands the OTHER team the next guess.
//   teams   two teams taking turns, each with its own pair of givers; the
//           other team watches. The team scores the value.
//
//   game: { shape, cap, rounds, pool, order, teams, scores, teamScores,
//           round, turn, team, givers, phase, deal, skips, dealt,
//           chain, wordAt, guesses, result, reveal, log }
//
//   chain: [{ by, text }] — text null locally (said out loud), and
//          { by, text: null, lost: true } for a word the local clock took.
//
//   phase: 'deal' → 'chain' → 'over' → (next turn: 'deal' …) → 'finished'
//
// **The secret is never in here.** The game knows a turn was dealt (`dealt`),
// not who was dealt: locally the hook holds the card beside the game, online
// it lives in the givers' own secrets/ nodes. Guesses are graded by the
// caller (settleGuesses takes the judge as a predicate) and the character
// enters the game only once the turn is over (publishReveal).
//
// **Time.** Nothing here reads a clock. A rule that needs "now" takes it
// (server time online); locally it is null and the guess window is the
// table's own pace, since the guesses are shouted.
import { award, clearBest, clearLeader, sumBy, tally, times } from '../../shared/utils/awards';
import { TEAMS, teamOf } from '../../shared/utils/teams';
import { MAX_WORD } from './chainWords';

export const SHAPES = ['pair', 'rivals', 'teams'];
// A pair and at least one guesser; a giver and a guesser a team; a pair and a
// guesser a team.
export const MIN_PLAYERS = { pair: 3, rivals: 4, teams: 6 };
export const MIN_TEAM = { pair: 0, rivals: 2, teams: 3 };
/** "Don't know them — another": redraws a giver may ask for, a turn. */
export const SKIPS = 2;
/**
 * Online, how long the guessers have after a word before the next one may
 * come anyway. Without it a quick giver could bury a word under the next
 * before anyone typed; with it, a guesser who never answers holds nobody up
 * for long. The window closes sooner once everyone it is for has guessed or
 * passed.
 */
export const GUESS_MS = 15_000;
export const MAX_GUESS = 80;

/** What a right guess after word `n` is worth: the cap on word 1, down one a word. */
export const valueAt = (cap, n) => Math.max(1, cap + 1 - n);
/** Each giver's share in a pair game: half the value, rounded up. */
export const giverShare = (value) => Math.ceil(value / 2);
export const turnsPerRound = (shape) => (shape === 'teams' ? 2 : 1);
export const isTeamShape = (shape) => shape === 'rivals' || shape === 'teams';
/** The running number of the turn being played, 0-based — what one-shots and secrets are stamped with. */
export const turnNo = (game) => game.round * turnsPerRound(game.shape) + game.turn;
export const totalTurns = (game) => game.rounds * turnsPerRound(game.shape);

const here = (ids, activeIds) => (activeIds ? ids.filter((id) => activeIds.includes(id)) : ids);
const changed = (game, next) => {
  const patch = {};
  for (const [k, v] of Object.entries(next)) if (game[k] !== v) patch[k] = v;
  return { patch };
};

/** Which team gives (and guesses) a `teams`-shape turn: Red first on even rounds. */
export function turnTeam(round, turn) {
  return (round % 2 === 0) === (turn === 0) ? 'red' : 'blue';
}

/**
 * The turn's two givers, first word first, from the players still here — or
 * null when there are not two to be had.
 *
 *   pair    the seat `round` along the table and the next one here: the pair
 *           moves one seat a round, so whoever said the second word last
 *           round says the first this round, beside a new partner.
 *   rivals  each team's giver rotates through its members; Red speaks first
 *           on even rounds, Blue on odd.
 *   teams   the turn's team gives with its next two members.
 */
export function pickGivers(game, round, turn, activeIds = null) {
  if (game.shape === 'rivals') {
    const red = here(game.teams?.red ?? [], activeIds);
    const blue = here(game.teams?.blue ?? [], activeIds);
    if (!red.length || !blue.length) return null;
    const r = red[round % red.length];
    const b = blue[round % blue.length];
    return round % 2 === 0 ? [r, b] : [b, r];
  }
  if (game.shape === 'teams') {
    const members = here(game.teams?.[turnTeam(round, turn)] ?? [], activeIds);
    if (members.length < 2) return null;
    const a = members[(2 * round) % members.length];
    const b = members[(2 * round + 1) % members.length];
    return a === b ? null : [a, b];
  }
  const seats = game.order;
  if (!seats.length) return null;
  const live = (id) => !activeIds || activeIds.includes(id);
  const after = (from, skip = null) => {
    for (let step = 0; step < seats.length; step++) {
      const id = seats[(from + step) % seats.length];
      if (live(id) && id !== skip) return id;
    }
    return null;
  };
  const a = after(round % seats.length);
  const b = a == null ? null : after((seats.indexOf(a) + 1) % seats.length, a);
  return a && b ? [a, b] : null;
}

/**
 * Who may guess after a word said by `wordBy`: everyone but the givers (pair),
 * the giving team bar its givers (teams), or the speaker's own team bar the
 * speaker (rivals). `activeIds` narrows it to the players here.
 */
export function guessersFor(game, wordBy, activeIds = null) {
  let ids;
  if (game.shape === 'rivals') {
    const team = teamOf(game, wordBy);
    ids = (game.teams?.[team] ?? []).filter((id) => id !== wordBy);
  } else if (game.shape === 'teams') {
    ids = (game.teams?.[game.team] ?? []).filter((id) => !game.givers.includes(id));
  } else {
    ids = game.order.filter((id) => !game.givers.includes(id));
  }
  return here(ids, activeIds);
}

/**
 * Who may guess right now: the players the last word SAID was for. A word lost
 * to the local clock (loseWord) adds nothing to the sentence, so it opens no
 * new guess. In `rivals` it matters: a giver who stalls must not hand their own
 * team another go at a sentence that has not changed.
 */
export function currentGuessers(game, activeIds = null) {
  const last = game.chain.findLast((w) => !w.lost);
  return last ? guessersFor(game, last.by, activeIds) : [];
}

/** How many of the chain's words were lost to the clock (local only). */
export const lostCount = (game) => game.chain.filter((w) => w.lost).length;

/** Whose word is next: the givers take turns, the first speaker first. */
export const nextGiver = (game) => game.givers[game.chain.length % 2] ?? null;

/** The current word's value — what a right guess now would score. */
export const currentValue = (game) => valueAt(game.cap, Math.max(1, game.chain.length));

const guessesOn = (game, n) => game.guesses.filter((g) => g.n === n);
export const hasPending = (game) => game.guesses.some((g) => g.verdict === 'pending');
export const guessedThisWord = (game, id) => guessesOn(game, game.chain.length).some((g) => g.by === id);

/** Everyone the current word was for (and is here) has guessed or passed. */
export function allIn(game, activeIds = null) {
  const n = game.chain.length;
  if (!n) return false;
  const done = new Set(guessesOn(game, n).map((g) => g.by));
  return currentGuessers(game, activeIds).every((id) => done.has(id));
}

/**
 * Whether the next word may come (online's guess window): before the first
 * word always; after one, once no guess is waiting on the judge and either
 * everyone it was for has answered or GUESS_MS has run. `now` null — local
 * play — never waits.
 */
export function windowOpen(game, now = null, activeIds = null) {
  if (game.phase !== 'chain') return false;
  if (!game.chain.length || now == null) return true;
  if (hasPending(game)) return false;
  if (allIn(game, activeIds)) return true;
  return game.wordAt != null && now >= game.wordAt + GUESS_MS;
}

/** When the guess window runs out, for the screen's clock — null when there is none. */
export const windowEndsAt = (game) => (game.phase === 'chain' && game.chain.length && game.wordAt != null
  ? game.wordAt + GUESS_MS : null);

// A new turn's fields: the givers picked from who is here, a fresh deal
// number, and nothing on the chain. Not enough players for one: the game ends.
function turnStart(game, round, turn, activeIds) {
  const team = game.shape === 'teams' ? turnTeam(round, turn) : null;
  const givers = pickGivers({ ...game, team }, round, turn, activeIds);
  if (!givers) return { phase: 'finished', result: null };
  return {
    round,
    turn,
    team,
    givers,
    phase: 'deal',
    deal: (game.deal ?? 0) + 1,
    skips: 0,
    // Who asked for each re-deal this turn, for the awards (`skips` is the count).
    skipBy: [],
    dealt: null,
    chain: [],
    wordAt: null,
    guesses: [],
    result: null,
    reveal: null,
  };
}

/**
 * A new game. `teams` is `{ red, blue }` for the team shapes (shared
 * splitTeams) and ignored for a pair game; `cap` the word cap, `rounds` the
 * rounds — two turns each in the `teams` shape.
 */
export function startGame({ ids, shape = 'pair', cap = 10, rounds = 6, teams = null, pool = 'main' }) {
  const game = {
    shape: SHAPES.includes(shape) ? shape : 'pair',
    cap,
    rounds,
    // Read only by the dealing device's draw (deal.js) — on the game because
    // online that device is a giver's, not the host's that holds the settings.
    pool: pool === 'all' ? 'all' : 'main',
    order: [...ids],
    teams: isTeamShape(shape) ? { red: [...(teams?.red ?? [])], blue: [...(teams?.blue ?? [])] } : null,
    scores: Object.fromEntries(ids.map((id) => [id, 0])),
    teamScores: { red: 0, blue: 0 },
    deal: 0,
    givers: [],
    log: [],
  };
  return { ...game, ...turnStart(game, 0, 0, null) };
}

/**
 * Whether the table can still play its shape: three here in a pair game, and
 * MIN_TEAM a side in the team shapes. Below it online, the game ends.
 */
export function enoughPlayers(game, activeIds) {
  if (!isTeamShape(game.shape)) return here(game.order, activeIds).length >= MIN_PLAYERS.pair;
  return TEAMS.every((t) => here(game.teams?.[t] ?? [], activeIds).length >= MIN_TEAM[game.shape]);
}

/** A giver asks for another character (they don't know this one) — before the first word only. */
export function skip(game, by) {
  const early = game.phase === 'deal' || (game.phase === 'chain' && !game.chain.length);
  if (!early || !game.givers.includes(by) || game.skips >= SKIPS) return { patch: {} };
  return {
    patch: {
      phase: 'deal', deal: game.deal + 1, skips: game.skips + 1, skipBy: [...(game.skipBy ?? []), by], dealt: null,
    },
  };
}

/**
 * The card for deal number `deal` is in the givers' hands (online: written to
 * both secrets/ nodes; locally: the givers have looked and hidden it). The
 * chain opens.
 */
export function markDealt(game, deal) {
  if (game.phase !== 'deal' || game.deal !== deal) return { patch: {} };
  return { patch: { phase: 'chain', dealt: deal } };
}

/**
 * A giver adds the next word. It must be their go, the chain under the cap,
 * no guess waiting on the judge and the guess window open (windowOpen).
 * `text` is the typed word online — already checked against the banned list
 * on the giver's device, re-checked here only for its shape — and null
 * locally, where the word is said out loud and the device only counts it.
 */
export function addWord(game, by, text = null, { now = null, activeIds = null } = {}) {
  if (game.phase !== 'chain' || nextGiver(game) !== by || game.chain.length >= game.cap) return { patch: {} };
  if (!windowOpen(game, now, activeIds)) return { patch: {} };
  let word = null;
  if (text != null) {
    word = String(text).trim();
    if (!word || /\s/.test(word) || word.length > MAX_WORD) return { patch: {} };
  }
  return { patch: { chain: [...game.chain, { by, text: word }], wordAt: now } };
}

/**
 * Locally, the word clock ran out on `by` before they said word `n + 1`: that
 * word is lost. It still counts toward the cap, so the value drops as if it
 * had been said, and the turn passes to the other giver. Stalling costs the
 * pair a word, not the whole turn.
 *
 * `n` is how long the chain was when the clock started. A timer that fires
 * late, after a word has been said, is refused, so one timer can never lose
 * two words.
 */
export function loseWord(game, by, n) {
  if (game.phase !== 'chain' || nextGiver(game) !== by || game.chain.length !== n || n >= game.cap) return { patch: {} };
  return { patch: { chain: [...game.chain, { by, text: null, lost: true }] } };
}

// One guess, or a pass, on the current word: only from a player it was for,
// only once a word.
function answer(game, by, entry) {
  if (game.phase !== 'chain' || !game.chain.length) return { patch: {} };
  if (!currentGuessers(game).includes(by) || guessedThisWord(game, by)) return { patch: {} };
  return { patch: { guesses: [...game.guesses, { by, n: game.chain.length, ...entry }] } };
}

/** A typed guess (online). It waits, 'pending', for a giver's device to judge it. */
export function guess(game, by, text, { now = null } = {}) {
  const t = String(text ?? '').trim().slice(0, MAX_GUESS);
  if (!t) return { patch: {} };
  return answer(game, by, { text: t, at: now, verdict: 'pending' });
}

/** No guess on this word — so the window can close without waiting out the clock. */
export function passWord(game, by, { now = null } = {}) {
  return answer(game, by, { text: '', at: now, verdict: 'pass' });
}

// The end of a turn, scored. `kind`: 'got' (by guessed it after word n),
// 'out' (the cap came with nobody right), 'banned' (by said a banned word —
// local only; online one is refused before it is sent) or 'void' (a giver
// left). Only 'got' scores.
function endTurn(game, kind, by = null, n = null) {
  const value = kind === 'got' ? valueAt(game.cap, n) : 0;
  const scores = { ...game.scores };
  const teamScores = { ...game.teamScores };
  const team = kind === 'got' && isTeamShape(game.shape) ? teamOf(game, by) : null;
  if (kind === 'got') {
    if (team) teamScores[team] = (teamScores[team] ?? 0) + value;
    else {
      scores[by] = (scores[by] ?? 0) + value;
      for (const g of game.givers) scores[g] = (scores[g] ?? 0) + giverShare(value);
    }
  }
  const result = { kind, by, n, value, team };
  const entry = {
    round: game.round,
    turn: game.turn,
    // Who gave (the `teams` shape's turn); the result's `team` is who scored.
    givingTeam: game.team,
    givers: [...game.givers],
    ...result,
    words: game.chain.length,
    chain: game.chain.map((w) => w.text ?? ''),
    // Words lost to the local clock, which the reveal counts.
    lost: lostCount(game),
    character: null,
    skipped: [],
    // For the awards: who turned a character down, whose words the clock
    // took, and each guesser's wrong guesses (online; the guesses themselves
    // are cleared with the next turn).
    skipBy: [...(game.skipBy ?? [])],
    lostBy: game.chain.filter((w) => w.lost).map((w) => w.by),
    wrong: game.guesses.reduce((m, g) => (g.verdict === 'wrong' ? { ...m, [g.by]: (m[g.by] ?? 0) + 1 } : m), {}),
  };
  return { phase: 'over', scores, teamScores, result, log: [...game.log, entry] };
}

/**
 * The judge's pass over the guesses waiting on it, oldest first (by `at`,
 * then arrival). `isRight(text)` is the judging device's own check against
 * the card only it holds; it is pure, so a transaction that re-runs judges
 * the same way. The first right guess ends the turn, and anything still
 * waiting behind it is 'late' — the turn was already won.
 */
export function settleGuesses(game, isRight) {
  if (game.phase !== 'chain' || !hasPending(game)) return { patch: {} };
  const order = game.guesses
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => g.verdict === 'pending')
    .sort((a, b) => (a.g.at ?? 0) - (b.g.at ?? 0) || a.i - b.i);
  const guesses = [...game.guesses];
  let winner = null;
  for (const { g, i } of order) {
    if (winner) { guesses[i] = { ...g, verdict: 'late' }; continue; }
    const right = Boolean(isRight(g.text));
    guesses[i] = { ...g, verdict: right ? 'right' : 'wrong' };
    if (right) winner = g;
  }
  if (!winner) return { patch: { guesses } };
  return { patch: { guesses, ...endTurn({ ...game, guesses }, 'got', winner.by, winner.n) } };
}

/** Locally, the table heard it: `by` got it, after the current word. */
export function gotIt(game, by) {
  if (game.phase !== 'chain' || !game.chain.length || !currentGuessers(game).includes(by)) return { patch: {} };
  return { patch: endTurn(game, 'got', by, game.chain.length) };
}

/**
 * The cap was reached and nobody got it. Locally the table says so; online it
 * closes the way the guess window does (no guess pending, and everyone in or
 * the clock run), from any device.
 */
export function outOfWords(game, { now = null, activeIds = null } = {}) {
  if (game.phase !== 'chain' || game.chain.length < game.cap) return { patch: {} };
  if (now != null && !windowOpen(game, now, activeIds)) return { patch: {} };
  return { patch: endTurn(game, 'out') };
}

/** Locally, a giver said a banned word: the turn ends and nobody scores. */
export function bannedWord(game, by) {
  if ((game.phase !== 'chain' && game.phase !== 'deal') || !game.givers.includes(by)) return { patch: {} };
  return { patch: endTurn(game, 'banned', by) };
}

/**
 * The character, published once the turn is over — online by the giver's
 * device that holds the card, since nobody else can read it. `skipped` are
 * the characters this turn's givers turned down: published too, because the
 * givers saw them and the table should know what they passed on.
 */
export function publishReveal(game, forTurn, { character, skipped = [] }) {
  if (game.phase !== 'over' || game.reveal || turnNo(game) !== forTurn || !character) return { patch: {} };
  const reveal = { character, skipped };
  const log = game.log.map((e, i) => (i === game.log.length - 1 ? { ...e, character, skipped } : e));
  return { patch: { reveal, log } };
}

/** From a turn's reveal to the next turn (the other team, in `teams`), the next round, or the end. */
export function nextTurn(game, activeIds = null) {
  if (game.phase !== 'over') return { patch: {} };
  if (game.turn + 1 < turnsPerRound(game.shape)) return changed(game, { ...game, ...turnStart(game, game.round, game.turn + 1, activeIds) });
  if (game.round + 1 >= game.rounds) return { patch: { phase: 'finished' } };
  return changed(game, { ...game, ...turnStart(game, game.round + 1, 0, activeIds) });
}

/**
 * Re-checks the turn after the roster changed: a giver gone, or nobody left
 * to guess, voids it — the card lived on the givers' phones, and a sentence
 * with half its authors gone cannot be finished. Below the shape's minimum is
 * endGame's, not this.
 */
export function settleIfComplete(game, activeIds) {
  if (!game || (game.phase !== 'deal' && game.phase !== 'chain')) return { patch: {} };
  const gone = game.givers.find((id) => !activeIds.includes(id));
  if (gone) return { patch: endTurn(game, 'void', gone) };
  const guessers = game.shape === 'rivals'
    ? TEAMS.map((t) => guessersFor(game, game.givers.find((g) => teamOf(game, g) === t), activeIds))
    : [guessersFor(game, game.givers[0], activeIds)];
  if (guessers.some((list) => !list.length)) return { patch: endTurn(game, 'void') };
  return { patch: {} };
}

/** The room emptied below the shape's minimum: straight to the results. */
export function endGame(game) {
  if (game.phase === 'finished') return { patch: {} };
  return { patch: { phase: 'finished' } };
}

// ── Results ───────────────────────────────────────────────────────────────

/** Players best-first, ties sharing a place (a pair game). */
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

/** The winning team, or both on a tie (the team shapes). */
export function winningTeams(teamScores) {
  const red = teamScores?.red ?? 0;
  const blue = teamScores?.blue ?? 0;
  if (red === blue) return ['red', 'blue'];
  return [red > blue ? 'red' : 'blue'];
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

const VERDICTS = ['pending', 'right', 'wrong', 'pass', 'late'];
const KINDS = ['got', 'out', 'banned', 'void'];

export function normalizeCharacter(raw) {
  if (!raw || typeof raw !== 'object' || !str(raw.name)) return null;
  return { key: str(raw.key) ?? '', name: raw.name, series: str(raw.series) ?? '', imageUrl: str(raw.imageUrl) ?? '' };
}

function normalizeResult(r) {
  if (!r || typeof r !== 'object' || !KINDS.includes(r.kind)) return null;
  return { kind: r.kind, by: r.by ?? null, n: numberOr(r.n, null), value: numberOr(r.value, 0), team: TEAMS.includes(r.team) ? r.team : null };
}

function normalizeEntry(e) {
  const result = normalizeResult(e);
  if (!result) return null;
  return {
    ...result,
    round: numberOr(e.round, 0),
    turn: numberOr(e.turn, 0),
    givingTeam: TEAMS.includes(e.givingTeam) ? e.givingTeam : null,
    givers: listOf(e.givers),
    words: numberOr(e.words, 0),
    chain: listOf(e.chain).map((w) => (typeof w === 'string' ? w : '')),
    lost: numberOr(e.lost, 0),
    character: normalizeCharacter(e.character),
    skipped: listOf(e.skipped).map(normalizeCharacter).filter(Boolean),
    skipBy: listOf(e.skipBy),
    lostBy: listOf(e.lostBy),
    wrong: Object.fromEntries(Object.entries(e.wrong ?? {}).map(([id, n]) => [id, numberOr(n, 0)])),
  };
}

export function normalizeGame(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const shape = SHAPES.includes(raw.shape) ? raw.shape : 'pair';
  const scores = {};
  for (const [id, s] of Object.entries(raw.scores ?? {})) scores[id] = numberOr(s, 0);
  const phases = ['deal', 'chain', 'over', 'finished'];
  const r = raw.reveal;
  const reveal = r && typeof r === 'object' && normalizeCharacter(r.character)
    ? { character: normalizeCharacter(r.character), skipped: listOf(r.skipped).map(normalizeCharacter).filter(Boolean) }
    : null;
  return {
    shape,
    cap: numberOr(raw.cap, 10),
    rounds: numberOr(raw.rounds, 0),
    pool: raw.pool === 'all' ? 'all' : 'main',
    order: listOf(raw.order),
    teams: isTeamShape(shape) ? { red: listOf(raw.teams?.red), blue: listOf(raw.teams?.blue) } : null,
    scores,
    teamScores: { red: numberOr(raw.teamScores?.red, 0), blue: numberOr(raw.teamScores?.blue, 0) },
    round: numberOr(raw.round, 0),
    turn: numberOr(raw.turn, 0),
    team: TEAMS.includes(raw.team) ? raw.team : null,
    givers: listOf(raw.givers),
    phase: phases.includes(raw.phase) ? raw.phase : 'deal',
    deal: numberOr(raw.deal, 0),
    skips: numberOr(raw.skips, 0),
    skipBy: listOf(raw.skipBy),
    dealt: numberOr(raw.dealt, null),
    chain: listOf(raw.chain)
      .filter((w) => w && typeof w === 'object' && w.by != null)
      .map((w) => (w.lost === true ? { by: w.by, text: null, lost: true } : { by: w.by, text: str(w.text) })),
    wordAt: numberOr(raw.wordAt, null),
    guesses: listOf(raw.guesses)
      .filter((g) => g && typeof g === 'object' && g.by != null)
      .map((g) => ({
        by: g.by,
        n: numberOr(g.n, 0),
        text: str(g.text) ?? '',
        at: numberOr(g.at, null),
        verdict: VERDICTS.includes(g.verdict) ? g.verdict : 'pending',
      })),
    result: normalizeResult(raw.result),
    reveal,
    log: listOf(raw.log).map(normalizeEntry).filter(Boolean),
  };
}

// --- the game's story ----------------------------------------------------------

/**
 * The final screen's superlatives, from the turn log: five good, five roasts,
 * each a clear leader or nothing (a tie drops it rather than picking by seat).
 * The card (shared/utils/awards.js's pickAwards) shows two of each. `cap` is
 * the game's word cap. Entries from before `skipBy`/`lostBy`/`wrong` were
 * logged skip the awards that need them.
 *
 * The givers take the words in turn from the first, lost words included
 * (nextGiver), so word n was said by givers[(n - 1) % 2].
 *
 *   Mind reader         guessed one in the fewest words, three or fewer
 *   Set-up artist       said the word right before the most guesses
 *   Buzzer beater       guessed one on the very last word
 *   Hat trick           guessed three characters or more
 *   Wordsmith           every chain they gave got guessed (2+ turns)
 *   Slip of the tongue  said a banned word (roast; local, where it is said aloud)
 *   Wild guesser        the most wrong guesses (3+, roast; online)
 *   Picky               turned down the most characters (roast)
 *   Staller             the most words lost to the clock (2+, roast; local)
 *   Talked in circles   said the last word of a chain nobody got (roast)
 */
export function chainAwards(log = [], players = [], { cap = null } = {}) {
  const byId = (id) => players.find((p) => p.id === id) ?? null;
  const entries = (log ?? []).filter(Boolean);
  const gots = entries.filter((e) => e.kind === 'got' && e.by && Number.isFinite(e.n));
  const who = (e) => e.character?.name ?? 'it';
  const giverOf = (e, n) => e.givers?.[(n - 1) % (e.givers?.length || 1)] ?? null;
  const latest = (list, pick) => list.filter(pick).at(-1);
  const out = [];

  const quick = clearBest(gots, (e) => e.n, { dir: 'min' });
  if (quick && quick.n <= 3) out.push(award('Mind reader', byId(quick.by), `Got ${who(quick)} after ${times(quick.n, 'word')}`, { weight: 3 }));
  const setup = clearLeader(tally(gots, (e) => giverOf(e, e.n)));
  if (setup) {
    const e = latest(gots, (x) => giverOf(x, x.n) === setup.id);
    const word = e.chain?.[e.n - 1];
    out.push(award('Set-up artist', byId(setup.id), word
      ? `Said “${word}”, and ${byId(e.by)?.name ?? 'the table'} got ${who(e)}`
      : `Their word set up ${times(setup.n, 'guess', 'guesses')}`, { weight: 2 }));
  }
  const buzzers = gots.filter((e) => cap && e.n >= cap);
  const buzzer = clearLeader(tally(buzzers, (e) => e.by));
  if (buzzer) out.push(award('Buzzer beater', byId(buzzer.id), `Got ${who(latest(buzzers, (e) => e.by === buzzer.id))} on the last word`, { weight: 2 }));
  const hat = clearLeader(tally(gots, (e) => e.by), { min: 3 });
  if (hat) {
    const named = gots.filter((e) => e.by === hat.id).map(who).filter((n) => n !== 'it');
    const list = named.length <= 3
      ? `${named.slice(0, -1).join(', ')} and ${named.at(-1)}`
      : `${named.slice(0, 3).join(', ')} and ${named.length - 3} more`;
    out.push(award('Hat trick', byId(hat.id), named.length >= 3 ? `Got ${list}` : `Guessed ${hat.n} characters`));
  }
  const turns = {};
  const landed = {};
  for (const e of entries.filter((x) => x.kind !== 'void')) {
    for (const g of new Set(e.givers ?? [])) {
      turns[g] = (turns[g] ?? 0) + 1;
      if (e.kind === 'got') landed[g] = (landed[g] ?? 0) + 1;
    }
  }
  const smith = clearLeader(Object.fromEntries(Object.entries(turns).filter(([g, n]) => n >= 2 && landed[g] === n)));
  if (smith) out.push(award('Wordsmith', byId(smith.id), `Every chain they gave got guessed, ${smith.n} of ${smith.n}`));

  const slips = entries.filter((e) => e.kind === 'banned');
  const slip = clearLeader(tally(slips, (e) => e.by));
  if (slip) {
    const e = latest(slips, (x) => x.by === slip.id);
    out.push(award('Slip of the tongue', byId(slip.id), slip.n === 1
      ? `Said a banned word giving ${who(e) === 'it' ? 'a clue' : who(e)}`
      : `Said a banned word ${times(slip.n)}`, { roast: true }));
  }
  const wild = clearLeader(sumBy(entries, (e) => e.wrong), { min: 3 });
  if (wild) out.push(award('Wild guesser', byId(wild.id), `${wild.n} wrong guesses, all with confidence`, { roast: true }));
  const skips = entries.flatMap((e) => (e.skipBy ?? []).map((by, k) => ({ by, character: e.skipped?.[k] ?? null })));
  const picky = clearLeader(tally(skips, (s) => s.by));
  if (picky) {
    const turned = skips.filter((s) => s.by === picky.id && s.character?.name).map((s) => s.character.name);
    out.push(award('Picky', byId(picky.id), turned.length
      ? `Turned down ${turned.slice(0, 2).join(' and ')}${turned.length > 2 ? ', and more' : ''}`
      : `Turned down ${times(picky.n, 'character')}`, { roast: true }));
  }
  const stall = clearLeader(tally(entries, (e) => e.lostBy ?? []), { min: 2 });
  if (stall) out.push(award('Staller', byId(stall.id), `Lost ${stall.n} words to the clock`, { roast: true }));
  const outs = entries.filter((e) => e.kind === 'out' && e.words);
  const circles = clearLeader(tally(outs, (e) => giverOf(e, e.words)));
  if (circles) {
    const e = latest(outs, (x) => giverOf(x, x.words) === circles.id);
    out.push(award('Talked in circles', byId(circles.id), `Said the last of ${e.words} words for ${who(e) === 'it' ? 'a character' : who(e)}, and nobody got it`, { roast: true }));
  }
  return out.filter(Boolean);
}
