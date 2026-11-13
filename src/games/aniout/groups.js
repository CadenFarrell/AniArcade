// "Groups of four": AniOut's second mode. A board is 16 characters (12 on a
// small board) that sort into four (three) hidden groups of four, each group
// joined by one connection. Everyone sorts the board in secret; deal.js's
// `dealGame` hands a groups match here.
//
// Pure, with an injectable rng, so a seed is a replay.
//
// **A board has exactly one sort, or it is not dealt** — `validBoard`, the
// groups twin of `validRound`, and the whole difficulty of the mode.
//
// What counts as a group had to be decided before "exactly one" means
// anything, and the obvious answer does not work. If ANY four cards sharing ANY
// value made a group, the broad values would always offer a second sort: most
// anime are adapted from manga, half a board is women, "Action" covers a third
// of any list. So the rule the table is told (howTo.js) is narrower:
//
//   **A group's link is something those four share and NO other card on the
//   board has.**
//
// Two checks follow from it:
//
//   1. Each dealt group is tight: its four hold the value, and the other
//      twelve are KNOWN to lack it. An unknown is never dealt as "lacks" —
//      the same conservatism as validRound's check 1.
//   2. The sort is unique. Every four-card set that COULD be a tight group,
//      on any kind (check-only gender, role and format included — gender is on
//      every portrait), is a candidate, counting an unknown as possibly
//      holding the value AND four cards unknown on a kind as possibly sharing
//      a value we never saw. An exact-cover search over the candidates must
//      find exactly one partition of the board: the dealt one.
//
// That second check lets a red herring in on purpose — a card from the studio
// group whose debut year matches the 2006 group's is fine, as long as only one
// whole sort survives. Herrings are what make a board a puzzle.
import { shuffle } from '../../shared/utils/random';
import { KINDS, RULE_KINDS, sentenceFor } from './connections';
import { cardPool } from './utils/pool';
import { buckets, decoySentences, has, noteFor, pickGroup, weightedOrder } from './deal';

export const GROUP_SIZE = 4;
/** A full board's groups, then the smaller board a short list falls back to. */
export const BOARD_GROUPS = [4, 3];
/** Decoy reasons beside a board's true ones (with reasons on). */
const BOARD_DECOYS = 2;
// Search budgets. A board is four tight groups at once, so most attempts die
// on the uniqueness check; these find a board in every list big enough to hold
// one and keep the setup screen's trial deal to a few tens of milliseconds.
const BOARD_TRIES = 24;
const BUCKETS_PER_SLOT = 8;
// A board whose candidate groups pass this is one with so many unknowns that
// nobody could say it has one answer — refused rather than searched.
const MAX_CANDIDATES = 3000;

const known = (card, kind) => Array.isArray(card.vals[kind]);
const lacks = (card, rule) => known(card, rule.kind) && !has(card, rule.kind, rule.key);

// Every k-subset of `items`, as arrays.
function subsets(items, k) {
  const out = [];
  const pick = (start, acc) => {
    if (acc.length === k) { out.push(acc); return; }
    for (let i = start; i <= items.length - (k - acc.length); i++) pick(i + 1, [...acc, items[i]]);
  };
  if (k >= 0 && k <= items.length) pick(0, []);
  return out;
}

/**
 * Every four-card set on the board that could be a tight group, as bitmasks
 * over `cards`' indexes (a board is at most 16 cards). Null when there are too
 * many to call — see MAX_CANDIDATES.
 */
export function candidateGroups(cards) {
  const masks = new Set();
  const add = (idxs) => { masks.add(idxs.reduce((m, i) => m | (1 << i), 0)); };
  for (const { id } of KINDS) {
    const unknown = cards.map((c, i) => (known(c, id) ? -1 : i)).filter((i) => i >= 0);
    const holders = new Map();
    cards.forEach((c, i) => {
      for (const v of c.vals[id] ?? []) {
        if (!holders.has(v.key)) holders.set(v.key, []);
        holders.get(v.key).push(i);
      }
    });
    // A value somebody on the board holds: its holders plus enough unknowns.
    for (const held of holders.values()) {
      if (held.length > GROUP_SIZE || held.length + unknown.length < GROUP_SIZE) continue;
      for (const extra of subsets(unknown, GROUP_SIZE - held.length)) add([...held, ...extra]);
      if (masks.size > MAX_CANDIDATES) return null;
    }
    // A value nobody's record shows: four unknowns could share it.
    for (const four of subsets(unknown, GROUP_SIZE)) add(four);
    if (masks.size > MAX_CANDIDATES) return null;
  }
  return [...masks];
}

/** How many ways `candidates` partition `n` cards, counting no further than `limit`. */
export function countSorts(n, candidates, limit = 2) {
  const full = (1 << n) - 1;
  const byCard = Array.from({ length: n }, () => []);
  for (const m of candidates) for (let i = 0; i < n; i++) if (m & (1 << i)) byCard[i].push(m);
  let found = 0;
  const search = (used) => {
    if (used === full) { found += 1; return; }
    let first = 0;
    while (used & (1 << first)) first += 1;
    for (const m of byCard[first]) {
      if (m & used) continue;
      search(used | m);
      if (found >= limit) return;
    }
  };
  search(0);
  return found;
}

/**
 * The two checks in this file's header. `cards` is the board; `groups` is
 * `[{ rule: { kind, key }, keys: [four card keys] }]`.
 */
export function validBoard(cards, groups) {
  const keys = new Set(cards.map((c) => c.key));
  const dealt = groups.flatMap((g) => g.keys);
  if (dealt.length !== cards.length || new Set(dealt).size !== cards.length || !dealt.every((k) => keys.has(k))) return false;
  for (const g of groups) {
    if (g.keys.length !== GROUP_SIZE) return false;
    for (const c of cards) {
      const inside = g.keys.includes(c.key);
      if (inside && !has(c, g.rule.kind, g.rule.key)) return false;
      if (!inside && !lacks(c, g.rule)) return false;
    }
  }
  const candidates = candidateGroups(cards);
  return candidates != null && countSorts(cards.length, candidates) === 1;
}

// One attempt at a board of `n` groups: each slot takes a kind (one the board
// has not used yet first, and never a second same-show group), a value every
// card already on the board is KNOWN to lack, and four cards that hold it and
// are known to lack every value already dealt. Tightness inside the board is
// then true by construction; the uniqueness check is what usually refuses.
function tryBoard(index, n, rng) {
  const groups = [];
  const onBoard = [];
  const order = weightedOrder(RULE_KINDS, rng);
  for (let slot = 0; slot < n; slot++) {
    const used = new Set(groups.map((g) => g.rule.kind));
    const kinds = [...order.filter((k) => !used.has(k.id)), ...order.filter((k) => used.has(k.id) && k.id !== 'show')];
    let placed = null;
    for (const kindDef of kinds) {
      const values = [...index.get(kindDef.id)]
        .filter(([key, b]) => b.cards.length >= GROUP_SIZE
          && onBoard.every((c) => lacks(c, { kind: kindDef.id, key })));
      for (const [key, bucket] of shuffle(values, rng).slice(0, BUCKETS_PER_SLOT)) {
        const rule = { kind: kindDef.id, key, label: bucket.label };
        const members = bucket.cards.filter((c) => !onBoard.includes(c) && groups.every((g) => lacks(c, g.rule)));
        const four = members.length >= GROUP_SIZE ? pickGroup(members, kindDef, GROUP_SIZE, rng) : null;
        if (four) { placed = { rule, cards: four }; break; }
      }
      if (placed) break;
    }
    if (!placed) return null;
    groups.push({ rule: placed.rule, keys: placed.cards.map((c) => c.key) });
    onBoard.push(...placed.cards);
  }
  const cards = shuffle(onBoard, rng);
  return validBoard(cards, groups) ? { cards, groups } : null;
}

/** A board of `n` groups from `pool`, or null within the budget. */
export function buildBoard(pool, n, rng) {
  // Cards known on every kind a group can be about make tight groups and
  // leave the candidate search little to doubt, so they are tried first;
  // the whole pool is the fallback.
  const sure = pool.filter((c) => RULE_KINDS.every((k) => known(c, k.id)));
  for (const from of sure.length >= n * GROUP_SIZE ? [sure, pool] : [pool]) {
    const index = new Map(RULE_KINDS.map((k) => [k.id, buckets(from, k.id)]));
    for (let t = 0; t < BOARD_TRIES; t++) {
      const board = tryBoard(index, n, rng);
      if (board) return board;
    }
  }
  return null;
}

/**
 * Deals a groups match: `settings.boards` boards, each the full four groups
 * when the lists hold one and three when they only hold that. Returns
 * `{ deal }`, or `{ error, found }` like dealFrom. Fresh faces first, as in
 * the odd-one-out deal: not dealt lately on this device, then not yet this
 * game, then anything — a tier, never a filter.
 */
export function dealBoards(players, settings, pack, rng, recent, sharedOnly) {
  const boards = settings?.boards ?? 3;
  const reasonsOn = settings?.reasons !== false;
  const pool = cardPool(players, { sharedOnly }, pack);
  const used = new Set();
  const sets = [];

  while (sets.length < boards) {
    let built = null;
    const tiers = recent?.size ? ['unseen', 'fresh', 'any'] : ['fresh', 'any'];
    for (const n of BOARD_GROUPS) {
      for (const tier of tiers) {
        const from = tier === 'any' ? pool
          : pool.filter((c) => !used.has(c.key) && (tier === 'fresh' || !recent.has(c.key)));
        if (from.length < n * GROUP_SIZE) continue;
        built = buildBoard(from, n, rng);
        if (built) break;
      }
      if (built) break;
    }
    if (!built) break;
    for (const c of built.cards) used.add(c.key);
    sets.push(boardSet(built, reasonsOn, rng));
  }

  if (sets.length < boards) {
    return { error: `These lists hold ${sets.length} board${sets.length === 1 ? '' : 's'} — need ${boards}.`, found: sets.length };
  }
  return { deal: { mode: 'groups', rounds: boards, reasonsOn, sets } };
}

// A built board as the deal stores it: plain values only, so it survives RTDB.
// Each card's `note` is its value for its OWN group's connection, for the
// reveal; each group's `reason` indexes `reasons`, the board's true sentences
// shuffled among two decoys.
function boardSet({ cards, groups }, reasonsOn, rng) {
  const truths = groups.map((g) => sentenceFor(g.rule.kind, g.rule));
  const byKey = new Map(cards.map((c) => [c.key, c]));
  const members = groups.map((g) => g.keys.map((k) => byKey.get(k)));
  const reasons = reasonsOn
    ? shuffle([...truths, ...decoySentences(members, cards, truths, rng, { count: BOARD_DECOYS })], rng)
    : [];
  const groupOf = new Map(groups.flatMap((g, i) => g.keys.map((k) => [k, i])));
  return {
    groups: groups.map((g, i) => ({
      kind: g.rule.kind,
      sentence: truths[i],
      keys: [...g.keys],
      reason: reasonsOn ? reasons.indexOf(truths[i]) : -1,
    })),
    cards: cards.map((c) => ({
      key: c.key,
      name: c.name,
      series: c.series,
      imageUrl: c.imageUrl,
      note: noteFor(c, groups[groupOf.get(c.key)].rule),
    })),
    reasons,
  };
}
