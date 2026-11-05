// The final screen's superlatives, the shared half. Each game derives its own
// awards in its pure rules.js from what the match logged — an award is a FACT
// about the game ("Missed 4 clues"), never a pat on the back for everyone —
// and these helpers are the arithmetic every one of them was hand-rolling:
// tally by player, then a clear leader or nothing.
//
// **A tie drops the award.** Two players level on "most wrong guesses" is not
// a story about either of them, and picking one by seat would hand it to
// whoever sat down first. **A count needs a minimum** for the same reason: one
// wrong guess is not a "most", it is a game.
//
// A game hands the card everything its players earned; `pickAwards` decides
// what the card shows (up to four), so how to choose is written once. Awards
// carry a `weight` (how rare the feat is: a perfect board outranks a hot
// streak) and `roast` (a playful jab at a bad or odd play — "Butterfingers",
// "Bold strategy"). The roasts are half the fun, so the card always makes room
// for one when one was earned.

/**
 * Counts how many times each id appears across `lines`. `idsOf(line)` returns
 * the ids a line credits (an array, or one id, or nothing); a null line is
 * skipped, so a log with gaps (an unscored round) needs no filtering first.
 */
export function tally(lines = [], idsOf) {
  const counts = {};
  for (const line of lines ?? []) {
    if (line == null) continue;
    const ids = idsOf(line);
    for (const id of Array.isArray(ids) ? ids : ids == null ? [] : [ids]) {
      if (id == null) continue;
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Adds up `amountOf(line)` per id: `{ id: amount }` across the log, for the
 * awards that weigh something rather than count it (points banked, misses
 * that cost). `amountOf(line)` returns `{ id: number }`.
 */
export function sumBy(lines = [], amountOf) {
  const sums = {};
  for (const line of lines ?? []) {
    if (line == null) continue;
    for (const [id, n] of Object.entries(amountOf(line) ?? {})) {
      if (!Number.isFinite(n)) continue;
      sums[id] = (sums[id] ?? 0) + n;
    }
  }
  return sums;
}

/**
 * The one id with the most (or, `dir: 'min'`, the fewest) in `counts`, as
 * `{ id, n }` — or null when two share the top or the top is under `min`
 * (over `max` for 'min'). `ids` limits the field (`dir: 'min'` over players
 * who never scored needs them listed, since a tally has no zero rows).
 */
export function clearLeader(counts = {}, { min = 1, max = Infinity, dir = 'max', ids = null } = {}) {
  const rows = (ids ?? Object.keys(counts ?? {})).map((id) => [id, counts?.[id] ?? 0]);
  if (!rows.length) return null;
  const sign = dir === 'min' ? 1 : -1;
  rows.sort((a, b) => sign * (a[1] - b[1]));
  const [top, next] = rows;
  if (next && next[1] === top[1]) return null;
  if (dir === 'min' ? top[1] > max : top[1] < min) return null;
  return { id: top[0], n: top[1] };
}

/**
 * The single item whose `valueOf(item)` is highest (or lowest, `dir: 'min'`),
 * or null when another item ties it AND belongs to someone else — the same
 * player twice at the top is still their award. Items whose value is not a
 * finite number are skipped. `whoOf(item)` names the player (default `.by`).
 */
export function clearBest(items = [], valueOf, { dir = 'max', whoOf = (x) => x?.by } = {}) {
  const scored = (items ?? [])
    .filter((x) => x != null)
    .map((x) => ({ x, v: valueOf(x) }))
    .filter(({ v }) => Number.isFinite(v));
  if (!scored.length) return null;
  const best = dir === 'min' ? Math.min(...scored.map((s) => s.v)) : Math.max(...scored.map((s) => s.v));
  const top = scored.filter((s) => s.v === best);
  if (new Set(top.map((s) => whoOf(s.x))).size > 1) return null;
  return top[0].x;
}

/**
 * The longest run of consecutive lines each id is credited in (`idsOf(line)`),
 * as `{ id: longest }`. A null line breaks every run, as a round nobody
 * played would.
 */
export function longestRuns(lines = [], idsOf) {
  const run = {};
  const best = {};
  for (const line of lines ?? []) {
    const got = new Set(line == null ? [] : idsOf(line) ?? []);
    for (const id of Object.keys(run)) if (!got.has(id)) run[id] = 0;
    for (const id of got) {
      run[id] = (run[id] ?? 0) + 1;
      best[id] = Math.max(best[id] ?? 0, run[id]);
    }
  }
  return best;
}

/** "1 time" / "3 times" — the detail lines' one recurring plural. */
export const times = (n, one = 'time', many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * One award, in the card's shape — or null when there is no player for it,
 * so a game can build every candidate unconditionally and let the card drop
 * what nobody earned. `weight` ranks it (default 1; ~3 for the rare feats),
 * `roast` marks a playful jab.
 */
export function award(title, player, detail, { weight = 1, roast = false } = {}) {
  if (!player) return null;
  return { title, player, detail, weight, roast };
}

export const MAX_AWARDS = 4;

/**
 * What the card shows, from everything the game says was earned:
 *
 *   1. the heaviest first (stable on the game's own order within a weight);
 *   2. one per player while anyone is still without one — the winner is
 *      already on the splash, and a card that names four different people
 *      is the one that gets the whole table talking;
 *   3. then whatever is left, heaviest first, into the empty slots;
 *   4. and if a roast was earned but none made it, the best roast takes the
 *      last slot — four compliments in a row is a press release.
 *
 * Titles are unique (the card keys rows by title; the first one wins), and
 * an award without a player is dropped.
 */
export function pickAwards(list = [], { max = MAX_AWARDS } = {}) {
  const seen = new Set();
  const all = [];
  (list ?? []).forEach((a, i) => {
    if (!a?.player || !a.title || seen.has(a.title)) return;
    seen.add(a.title);
    all.push({ a, i, w: a.weight ?? 1 });
  });
  all.sort((x, y) => y.w - x.w || x.i - y.i);
  const picked = [];
  const named = new Set();
  for (const e of all) {
    if (picked.length >= max) break;
    const who = e.a.player.id ?? e.a.player.name;
    if (named.has(who)) continue;
    picked.push(e);
    named.add(who);
  }
  for (const e of all) {
    if (picked.length >= max) break;
    if (!picked.includes(e)) picked.push(e);
  }
  if (picked.length && !picked.some((e) => e.a.roast)) {
    const roast = all.find((e) => e.a.roast);
    if (roast) picked[picked.length - 1] = roast;
  }
  // Back in the game's own order within the card, heaviest first, so the
  // card reads the same way every time for the same match.
  return picked.sort((x, y) => y.w - x.w || x.i - y.i).map((e) => e.a);
}
