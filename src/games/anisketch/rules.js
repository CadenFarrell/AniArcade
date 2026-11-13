// AniSketch's rules: pure functions over the game state, no React, no storage,
// no network. Each move returns `{ patch }` for the caller to apply; an empty
// patch means "refused", which the online hook relies on to abort its
// transaction rather than rewrite the same value.
//
//   { order, scores, turns, turn, drawer, phase, deal, dealt, drawMs,
//     choices, sharedFirst, startedAt, deadlineAt, got, guesses, reveal,
//     void, gaveUp, log }
//
// `choices` and `sharedFirst` ride on the game because the DRAWER's device
// deals the offer (online, every phone in turn), and only the host's saw the
// settings card.
//
//   phase: 'choosing' → 'drawing' → 'revealed' → 'choosing' … → 'finished'
//
// **The character is never in this object until the turn is over.** The
// drawer's device holds the offer and the pick beside the game — locally in
// the hook's own state, online in `secrets/{drawerId}` — and the game learns
// only that the offer went out (`dealt`) and, at the end, who it was
// (`publishReveal`). That is also why only the drawer's device can judge a
// typed guess (settleGuesses takes the judge as a function).
//
// **Time.** Nothing here reads a clock. A rule that needs "now" takes it, in
// server-corrected epoch ms online and Date.now() locally, and state stores
// absolute instants (AniTune's rule), so every device agrees on WHEN the
// drawing ends.
//
// Scoring: a right guess is worth more the sooner it lands —
// `GUESS_MAX × time left / drawing time`, never under GUESS_MIN — and the
// drawer takes DRAWER_PER_GUESSER for every player who names it, so a drawing
// is worth making clear rather than cryptic.
import { award, clearBest, clearLeader, sumBy, tally } from '../../shared/utils/awards';
import { roundsFor } from '../../shared/utils/match';

export const GUESS_MAX = 10;
export const GUESS_MIN = 3;
export const DRAWER_PER_GUESSER = 3;
/** A drawer and somebody to name it. */
export const MIN_PLAYERS = 2;
export const ONLINE_MIN_PLAYERS = 2;
/** A guess sent in the drawing's last instant still lands: the clock closes this long after the deadline. */
export const GRACE_MS = 1500;
/** A guess is a name, not a paragraph. */
export const MAX_GUESS = 40;
/** A turn's guess feed stops taking guesses past this, so a spammer cannot grow the room. */
export const MAX_GUESSES = 200;

export const PHASES = ['choosing', 'drawing', 'revealed', 'finished'];

const drawerAt = (order, turn) => order[turn % Math.max(1, order.length)] ?? null;

export function startGame({ ids, laps = 1, drawSeconds = 80, choices = 3, sharedFirst = true }) {
  return {
    order: [...ids],
    scores: Object.fromEntries(ids.map((id) => [id, 0])),
    turns: roundsFor(laps, ids.length),
    turn: 0,
    drawer: drawerAt(ids, 0),
    ...freshTurn(0),
    drawMs: Math.max(10, Number(drawSeconds) || 80) * 1000,
    choices: Math.max(1, Number(choices) || 3),
    sharedFirst: sharedFirst !== false,
    log: [],
  };
}

// Everything a turn resets. `deal` numbers the offers, so a stale secret is
// recognisable by its stamp (online-rooms.md, "Stamp each card").
function freshTurn(deal) {
  return {
    phase: 'choosing',
    deal,
    dealt: false,
    startedAt: null,
    deadlineAt: null,
    got: {},
    guesses: [],
    reveal: null,
    void: false,
    gaveUp: false,
  };
}

/** Who may still name the drawing: everyone seated but the drawer, here, who has not. */
export function guessersLeft(game, activeIds) {
  return game.order.filter((id) => id !== game.drawer && activeIds.includes(id) && !game.got[id]);
}

const everyoneGotIt = (game, activeIds) => (
  game.order.some((id) => id !== game.drawer && game.got[id]) && guessersLeft(game, activeIds).length === 0
);

/** What a right guess at `at` scores. */
export function pointsAt(game, at) {
  const left = Math.max(0, Math.min(1, (game.deadlineAt - at) / game.drawMs));
  return Math.max(GUESS_MIN, Math.ceil(GUESS_MAX * left));
}

const secondsLeft = (game, at) => Math.max(0, Math.ceil((game.deadlineAt - at) / 1000));

// One right guess: the guesser's points, the drawer's share, and the record.
function credit(game, by, at) {
  const points = pointsAt(game, at);
  return {
    got: { ...game.got, [by]: { at, points, left: secondsLeft(game, at) } },
    scores: {
      ...game.scores,
      [by]: (game.scores[by] ?? 0) + points,
      [game.drawer]: (game.scores[game.drawer] ?? 0) + DRAWER_PER_GUESSER,
    },
  };
}

/** The drawer's offer has gone out (to secrets/, or the hook's own state). */
export function markDealt(game, deal) {
  if (game.phase !== 'choosing' || game.dealt || game.deal !== deal) return { patch: {} };
  return { patch: { dealt: true } };
}

/** The drawer picked, and the clock starts. Only the drawer, only once the offer is out. */
export function startDrawing(game, by, now) {
  if (game.phase !== 'choosing' || !game.dealt || by !== game.drawer || now == null) return { patch: {} };
  return { patch: { phase: 'drawing', startedAt: now, deadlineAt: now + game.drawMs } };
}

/**
 * A typed guess (online). Refused from the drawer, from someone who has it
 * already or has one waiting, after the clock (plus GRACE_MS), and once the
 * feed is full. It waits as 'pending' for the drawer's device to judge.
 */
export function guess(game, by, text, { now }) {
  const clean = String(text ?? '').trim().slice(0, MAX_GUESS);
  if (game.phase !== 'drawing' || !clean || now == null) return { patch: {} };
  if (by === game.drawer || !game.order.includes(by) || game.got[by]) return { patch: {} };
  if (now > game.deadlineAt + GRACE_MS) return { patch: {} };
  if (game.guesses.length >= MAX_GUESSES) return { patch: {} };
  if (game.guesses.some((g) => g.by === by && g.verdict === 'pending')) return { patch: {} };
  const entry = { by, text: clean, at: Math.min(now, game.deadlineAt), n: game.guesses.length, verdict: 'pending' };
  return { patch: { guesses: [...game.guesses, entry] } };
}

/**
 * The drawer's device judges what is waiting, oldest first, with `isRight`
 * (text → boolean, against its own secret). A right guess's TEXT is blanked as
 * it is credited — it is the answer, and state/ is read in full by every
 * member. When nobody is left to guess, the turn is over.
 */
export function settleGuesses(game, isRight, activeIds) {
  if (game.phase !== 'drawing') return { patch: {} };
  const pending = game.guesses.filter((g) => g.verdict === 'pending').sort((a, b) => a.at - b.at || a.n - b.n);
  if (!pending.length) return { patch: {} };
  let next = { ...game, guesses: game.guesses.map((g) => ({ ...g })) };
  for (const p of pending) {
    const row = next.guesses.find((g) => g.n === p.n);
    if (!next.got[p.by] && isRight(p.text)) {
      row.verdict = 'right';
      row.text = '';
      next = { ...next, ...credit(next, p.by, p.at) };
    } else {
      row.verdict = 'wrong';
    }
  }
  const patch = { guesses: next.guesses, got: next.got, scores: next.scores };
  if (everyoneGotIt(next, activeIds)) patch.phase = 'revealed';
  return { patch };
}

/** Locally the drawer taps whoever shouted it: `now` sets the points. */
export function markGot(game, by, now, activeIds) {
  if (game.phase !== 'drawing' || by === game.drawer || !game.order.includes(by) || game.got[by] || now == null) {
    return { patch: {} };
  }
  const patch = credit(game, by, Math.min(now, game.deadlineAt));
  if (everyoneGotIt({ ...game, ...patch }, activeIds)) patch.phase = 'revealed';
  return { patch };
}

/**
 * The clock has run out. Waits GRACE_MS past the deadline, and for any guess
 * still waiting on the judge, so a guess sent in the last instant is judged
 * before the turn closes on it.
 */
export function timeUp(game, now) {
  if (game.phase !== 'drawing' || now == null || now < game.deadlineAt + GRACE_MS) return { patch: {} };
  if (game.guesses.some((g) => g.verdict === 'pending')) return { patch: {} };
  return { patch: { phase: 'revealed' } };
}

/** The drawer gives up on this one: straight to the reveal. */
export function giveUp(game, by) {
  if (!['choosing', 'drawing'].includes(game.phase) || by !== game.drawer) return { patch: {} };
  return { patch: { phase: 'revealed', gaveUp: true } };
}

/** The drawer's device says who it was, once the turn is over. */
export function publishReveal(game, turn, character) {
  if (game.phase !== 'revealed' || game.turn !== turn || game.reveal || game.void || !character?.name) return { patch: {} };
  return {
    patch: {
      reveal: {
        key: String(character.key ?? ''),
        name: String(character.name),
        series: String(character.series ?? ''),
        imageUrl: String(character.imageUrl ?? ''),
      },
    },
  };
}

/**
 * Re-checks the turn after the roster changed (online). The drawer gone voids
 * it — only their phone held the character, so nobody can say who it was.
 * Nobody left to guess voids it too, unless somebody already named it, which
 * makes it simply over.
 */
export function settleIfComplete(game, activeIds) {
  if (!['choosing', 'drawing'].includes(game?.phase)) return { patch: {} };
  if (!activeIds.includes(game.drawer)) return { patch: { phase: 'revealed', void: true } };
  const others = game.order.filter((id) => id !== game.drawer && activeIds.includes(id));
  if (!others.length) return { patch: { phase: 'revealed', void: !Object.keys(game.got).length } };
  if (game.phase === 'drawing' && everyoneGotIt(game, activeIds)) return { patch: { phase: 'revealed' } };
  return { patch: {} };
}

/** Whether a room still has a game in it. */
export const enoughPlayers = (game, activeIds) => game.order.filter((id) => activeIds.includes(id)).length >= ONLINE_MIN_PLAYERS;

// The turn just revealed, as one line of the game's story: plain values, so it
// survives RTDB.
function logLine(game, activeIds) {
  const wrong = {};
  for (const g of game.guesses) if (g.verdict === 'wrong') wrong[g.by] = (wrong[g.by] ?? 0) + 1;
  return {
    turn: game.turn,
    drawer: game.drawer,
    character: game.reveal ?? null,
    got: Object.fromEntries(Object.entries(game.got).map(([id, g]) => [id, { left: g.left, points: g.points }])),
    wrong,
    // Who could have named it: everyone seated and here but the drawer.
    guessers: game.order.filter((id) => id !== game.drawer && (activeIds.includes(id) || game.got[id])),
    void: Boolean(game.void),
    gaveUp: Boolean(game.gaveUp),
  };
}

/**
 * From the reveal to the next drawer — or the end. Anyone may press it. Online
 * a departed player's turns to draw are skipped rather than voided one by one.
 */
export function nextTurn(game, activeIds) {
  if (game.phase !== 'revealed') return { patch: {} };
  const log = [...game.log, logLine(game, activeIds)];
  let turn = game.turn + 1;
  while (turn < game.turns && !activeIds.includes(drawerAt(game.order, turn))) turn += 1;
  if (turn >= game.turns) return { patch: { phase: 'finished', log } };
  return { patch: { turn, drawer: drawerAt(game.order, turn), ...freshTurn(game.deal + 1), log } };
}

/** The room emptied below ONLINE_MIN_PLAYERS: straight to the results. */
export function endGame(game) {
  if (game.phase === 'finished') return { patch: {} };
  return { patch: { phase: 'finished' } };
}

/** Every character offered or drawn this game, so none comes round twice. */
export const usedKeys = (game) => game.log.map((l) => l.character?.key).filter(Boolean);

/**
 * The final screen's superlatives, from the log: five good, five roasts, each
 * a clear leader or nothing (a tie drops it). The card shows two of each.
 *
 *   Snap judgement   the fastest right guess of the game
 *   Speed painter    the drawing named soonest
 *   Masterpiece      every guesser named it (two or more), most often
 *   Art critic       the only one who named a drawing
 *   Eye for detail   named every drawing they could, three or more
 *   Abstract art     a drawing nobody named (roast)
 *   Blank canvas     gave up on a drawing (roast)
 *   Squint harder    named none of three or more drawings (roast)
 *   Photo finish     the latest right guess, ten seconds or less to go (roast)
 *   Spray and pray   five or more wrong guesses (roast, online)
 */
export function sketchAwards(log = [], players = []) {
  const byId = (id) => players.find((p) => p.id === id) ?? null;
  const lines = (log ?? []).filter((l) => l && !l.void);
  const who = (l) => l.character?.name || 'the drawing';
  const latest = (list, id) => list.filter((x) => x.by === id).at(-1);
  const out = [];

  const guesses = lines.flatMap((l) => Object.entries(l.got ?? {}).map(([by, g]) => ({ by, left: g.left ?? 0, l })));
  const snap = clearBest(guesses, (g) => g.left);
  if (snap) out.push(award('Snap judgement', byId(snap.by), `Named ${who(snap.l)} with ${snap.left}s to go`, { weight: 2 }));

  const firsts = lines.filter((l) => Object.keys(l.got ?? {}).length)
    .map((l) => ({ by: l.drawer, left: Math.max(...Object.values(l.got).map((g) => g.left ?? 0)), l }));
  const fast = clearBest(firsts, (f) => f.left);
  if (fast) out.push(award('Speed painter', byId(fast.by), `Drew ${who(fast.l)} — named with ${fast.left}s to go`));

  const full = lines.filter((l) => (l.guessers ?? []).length >= 2 && l.guessers.every((id) => l.got?.[id]))
    .map((l) => ({ by: l.drawer, l }));
  const master = clearLeader(tally(full, (x) => x.by));
  if (master) out.push(award('Masterpiece', byId(master.id), `Every one of you named their ${who(latest(full, master.id).l)}`, { weight: 2 }));

  const solos = lines.filter((l) => (l.guessers ?? []).length >= 2 && Object.keys(l.got ?? {}).length === 1)
    .map((l) => ({ by: Object.keys(l.got)[0], l }));
  const critic = clearLeader(tally(solos, (x) => x.by));
  if (critic) out.push(award('Art critic', byId(critic.id), `The only one who saw ${who(latest(solos, critic.id).l)}`));

  const chances = (id) => lines.filter((l) => (l.guessers ?? []).includes(id));
  const perfect = players.filter((p) => chances(p.id).length >= 3 && chances(p.id).every((l) => l.got?.[p.id]));
  if (perfect.length === 1) out.push(award('Eye for detail', perfect[0], `Named all ${chances(perfect[0].id).length} drawings they saw`, { weight: 3 }));

  const blanks = lines.filter((l) => !l.gaveUp && (l.guessers ?? []).length && !Object.keys(l.got ?? {}).length)
    .map((l) => ({ by: l.drawer, l }));
  const abstract = clearLeader(tally(blanks, (x) => x.by));
  if (abstract) out.push(award('Abstract art', byId(abstract.id), `Nobody saw ${who(latest(blanks, abstract.id).l)} in it`, { roast: true }));

  const quits = lines.filter((l) => l.gaveUp).map((l) => ({ by: l.drawer, l }));
  const quit = clearLeader(tally(quits, (x) => x.by));
  if (quit) out.push(award('Blank canvas', byId(quit.id), `Gave up on ${who(latest(quits, quit.id).l)}`, { roast: true }));

  const blind = players.filter((p) => chances(p.id).length >= 3 && chances(p.id).every((l) => !l.got?.[p.id]));
  if (blind.length === 1) out.push(award('Squint harder', blind[0], `Named none of ${chances(blind[0].id).length} drawings`, { roast: true }));

  const late = clearBest(guesses.filter((g) => g.left <= 10), (g) => g.left, { dir: 'min' });
  if (late) out.push(award('Photo finish', byId(late.by), `Named ${who(late.l)} with ${late.left}s to spare`, { roast: true }));

  const spray = clearLeader(sumBy(lines, (l) => l.wrong ?? {}), { min: 5 });
  if (spray) out.push(award('Spray and pray', byId(spray.id), `${spray.n} wrong guesses`, { roast: true }));

  return out.filter(Boolean);
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

const objectOf = (raw) => (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {});

function normalizeGot(raw) {
  const out = {};
  for (const [id, g] of Object.entries(objectOf(raw))) {
    if (g && typeof g === 'object') out[id] = { at: numberOr(g.at, 0), points: numberOr(g.points, 0), left: numberOr(g.left, 0) };
  }
  return out;
}

export function normalizeCharacter(raw) {
  if (!raw || typeof raw !== 'object' || !raw.name) return null;
  return { key: String(raw.key ?? ''), name: String(raw.name), series: String(raw.series ?? ''), imageUrl: String(raw.imageUrl ?? '') };
}

export function normalizeGame(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const scores = {};
  for (const [id, s] of Object.entries(objectOf(raw.scores))) scores[id] = numberOr(s, 0);
  return {
    order: listOf(raw.order),
    scores,
    turns: numberOr(raw.turns, 0),
    turn: numberOr(raw.turn, 0),
    drawer: raw.drawer ?? null,
    phase: PHASES.includes(raw.phase) ? raw.phase : 'choosing',
    deal: numberOr(raw.deal, 0),
    dealt: Boolean(raw.dealt),
    drawMs: numberOr(raw.drawMs, 80000),
    choices: numberOr(raw.choices, 3),
    sharedFirst: raw.sharedFirst !== false,
    startedAt: raw.startedAt == null ? null : numberOr(raw.startedAt, null),
    deadlineAt: raw.deadlineAt == null ? null : numberOr(raw.deadlineAt, null),
    got: normalizeGot(raw.got),
    guesses: listOf(raw.guesses)
      .filter((g) => g && typeof g === 'object' && typeof g.by === 'string')
      .map((g) => ({
        by: g.by,
        text: typeof g.text === 'string' ? g.text : '',
        at: numberOr(g.at, 0),
        n: numberOr(g.n, 0),
        verdict: ['pending', 'right', 'wrong'].includes(g.verdict) ? g.verdict : 'pending',
      })),
    reveal: normalizeCharacter(raw.reveal),
    void: Boolean(raw.void),
    gaveUp: Boolean(raw.gaveUp),
    log: listOf(raw.log)
      .filter((l) => l && typeof l === 'object')
      .map((l) => ({
        turn: numberOr(l.turn, 0),
        drawer: l.drawer ?? null,
        character: normalizeCharacter(l.character),
        got: Object.fromEntries(Object.entries(objectOf(l.got)).map(([id, g]) => [id, { left: numberOr(g?.left, 0), points: numberOr(g?.points, 0) }])),
        wrong: Object.fromEntries(Object.entries(objectOf(l.wrong)).map(([id, n]) => [id, numberOr(n, 0)])),
        guessers: listOf(l.guessers),
        void: Boolean(l.void),
        gaveUp: Boolean(l.gaveUp),
      })),
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
