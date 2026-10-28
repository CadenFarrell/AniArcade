// The deal: every round's cards, which one is out, why, and the reasons on
// offer — decided once on the dealing device, so the table never waits on a
// lookup and a room's guests never need the pack.
//
// Pure, with an injectable rng, so a seed is a replay.
//
// **A round has exactly one answer, or it is not dealt.** That is the whole
// difficulty of this game, and it is three checks (`validRound`):
//
//   1. The rule holds: the five share the value, and the odd one is KNOWN not
//      to — an unknown is never dealt as the answer.
//   2. The odd one stands out on nothing else. Every value the five share
//      besides the rule, the odd one shares too, so there is one true reason
//      and the odd card is never also "the only man" or "the only film". A
//      same-show round skips the show-level kinds here: five Naruto characters
//      also share Naruto's studio and year, and that difference is the show.
//   3. No other card is out on anything. For every other card, whatever the
//      remaining five share, it shares — and if it is unknown on a kind where
//      the other five agree, the round is refused, because a player who knows
//      the answer we do not could rightly pick it.
//
// A show-level rule draws its five from five different shows, so "same show"
// can never stand in for "same studio".
import { shuffle } from '../../shared/utils/random';
import { KINDS, RULE_KINDS, sentenceFor } from './connections';
import { cardPool } from './utils/pool';

export const CARDS_RANGE = { min: 5, max: 7 };
const DECOYS = 3;
// Search budgets per round. A pool of a few thousand characters makes an
// exhaustive search pointless; these find a round in every list big enough
// to hold one, and keep a setup screen's trial deal well under a frame budget.
const BUCKETS_PER_KIND = 14;
const GROUPS_PER_BUCKET = 5;
const ODD_SAMPLE = 60;
const ODDS_PER_GROUP = 12;

const has = (card, kind, key) => Boolean(card.vals[kind]?.some((v) => v.key === key));

/** The values every card in `cards` holds for `kind`, as key → label. Any unknown: none. */
export function sharedValues(kind, cards) {
  if (!cards.length || cards.some((c) => !c.vals[kind])) return new Map();
  let out = new Map(cards[0].vals[kind].map((v) => [v.key, v.label]));
  for (const c of cards.slice(1)) {
    out = new Map([...out].filter(([key]) => has(c, kind, key)));
    if (!out.size) break;
  }
  return out;
}

/** True when `card` is out on something the other cards in `others` all share. */
function standsOut(card, others, skipKinds = null, skip = null) {
  for (const { id } of KINDS) {
    if (skipKinds?.has(id)) continue;
    for (const key of sharedValues(id, others).keys()) {
      if (skip && skip.kind === id && skip.key === key) continue;
      if (!card.vals[id] || !has(card, id, key)) return true;
    }
  }
  return false;
}

/** The three checks in this file's header. `cards` in display order. */
export function validRound(cards, oddKey, rule) {
  const odd = cards.find((c) => c.key === oddKey);
  const group = cards.filter((c) => c.key !== oddKey);
  if (!odd || group.length !== cards.length - 1) return false;
  // 1
  if (!odd.vals[rule.kind] || has(odd, rule.kind, rule.key)) return false;
  if (!sharedValues(rule.kind, group).has(rule.key)) return false;
  // 2
  const entailed = rule.kind === 'show' ? new Set(KINDS.filter((k) => k.show).map((k) => k.id)) : null;
  if (standsOut(odd, group, entailed, rule)) return false;
  // 3
  for (const c of group) {
    if (standsOut(c, cards.filter((x) => x !== c))) return false;
  }
  return true;
}

// Most-known first with a little noise, so a character three players know
// tends to beat one only its importer has seen without the same faces leading
// every game.
const byFame = (cards, rng) => cards
  .map((c) => ({ c, w: c.owners + rng() * 2 }))
  .sort((a, b) => b.w - a.w)
  .map(({ c }) => c);

// A near miss beats a stranger: the odd one that shares the most with the five
// (a genre, a studio, a year) is the one that makes a table argue.
function overlap(card, group, ruleKind) {
  let n = 0;
  for (const { id } of KINDS) {
    if (id === ruleKind) continue;
    for (const v of card.vals[id] ?? []) n += group.filter((g) => has(g, id, v.key)).length;
  }
  return n;
}

// Weighted order without replacement: heavier kinds tend to come first.
function weightedOrder(kinds, rng) {
  const left = [...kinds];
  const out = [];
  while (left.length) {
    const total = left.reduce((s, k) => s + k.weight, 0);
    let r = rng() * total;
    const i = left.findIndex((k) => (r -= k.weight) < 0);
    out.push(...left.splice(i < 0 ? left.length - 1 : i, 1));
  }
  return out;
}

// value key → cards holding it, for one kind.
function buckets(pool, kind) {
  const out = new Map();
  for (const c of pool) {
    for (const v of c.vals[kind] ?? []) {
      if (!out.has(v.key)) out.set(v.key, { label: v.label, cards: [] });
      out.get(v.key).cards.push(c);
    }
  }
  return out;
}

// Five (size − 1) cards holding the value. A show-level rule takes one card per
// show, so the five come from five different shows.
function pickGroup(members, kindDef, need, rng) {
  if (kindDef.id === 'show') return byFame(members, rng).slice(0, need);
  const perShow = new Map();
  for (const c of byFame(shuffle(members, rng), rng)) {
    const show = c.vals.show?.[0]?.key ?? c.key;
    if (!perShow.has(show)) perShow.set(show, c);
  }
  if (perShow.size < need) return null;
  return shuffle([...perShow.values()].slice(0, need * 2), rng).slice(0, need);
}

function buildRound(pool, kindDef, size, rng, usedOdd) {
  const need = size - 1;
  const all = [...buckets(pool, kindDef.id)].filter(([, b]) => b.cards.length >= need);
  for (const [key, bucket] of shuffle(all, rng).slice(0, BUCKETS_PER_KIND)) {
    const rule = { kind: kindDef.id, key, label: bucket.label };
    const outsiders = pool.filter((c) => c.vals[kindDef.id] && !has(c, kindDef.id, key) && !usedOdd.has(c.key));
    if (!outsiders.length) continue;
    for (let g = 0; g < GROUPS_PER_BUCKET; g++) {
      const group = pickGroup(bucket.cards, kindDef, need, rng);
      if (!group) break;
      const groupShows = new Set(group.map((c) => c.vals.show?.[0]?.key));
      const sample = shuffle(outsiders, rng).slice(0, ODD_SAMPLE)
        // A same-show round's outsider is from another show, by definition;
        // that is what makes it out.
        .filter((c) => kindDef.id !== 'show' || !groupShows.has(c.vals.show?.[0]?.key))
        .map((c) => ({ c, w: overlap(c, group, kindDef.id) + rng() }))
        .sort((a, b) => b.w - a.w)
        .slice(0, ODDS_PER_GROUP);
      for (const { c: odd } of sample) {
        const cards = shuffle([...group, odd], rng);
        if (validRound(cards, odd.key, rule)) return { cards, odd, rule };
      }
    }
  }
  return null;
}

/**
 * Three false reasons a table could believe. Each is "All <value>" for a value
 * at least one of the five is KNOWN to lack (an unknown could make it true),
 * and the most plausible come first: a value most of the five hold reads as
 * the answer to someone half-sure. One per kind before any kind repeats.
 */
export function decoysFor(cards, odd, rule, rng) {
  const group = cards.filter((c) => c !== odd);
  const truth = sentenceFor(rule.kind, rule);
  const options = [];
  for (const k of KINDS) {
    if (!k.rule && !k.decoy) continue;
    const seen = new Map();
    for (const c of cards) for (const v of c.vals[k.id] ?? []) if (!seen.has(v.key)) seen.set(v.key, v);
    for (const v of seen.values()) {
      if (k.id === rule.kind && v.key === rule.key) continue;
      const known = group.filter((c) => c.vals[k.id]);
      if (!known.some((c) => !has(c, k.id, v.key))) continue;
      const holders = group.filter((c) => has(c, k.id, v.key)).length;
      // A same-show round's other shows are the obvious giveaway, not a decoy.
      if (k.id === 'show' && rule.kind === 'show') continue;
      options.push({ kind: k.id, text: sentenceFor(k.id, v), w: holders + rng() });
    }
  }
  options.sort((a, b) => b.w - a.w);
  const out = [];
  const kinds = new Set();
  for (const pass of [true, false]) {
    for (const o of options) {
      if (out.length >= DECOYS) break;
      if (o.text === truth || out.includes(o.text)) continue;
      if (pass && kinds.has(o.kind)) continue;
      kinds.add(o.kind);
      out.push(o.text);
    }
  }
  return out;
}

// What the reveal prints under each card: its value for the round's kind. A
// card without the value (the odd one, on a genre or tag round) shows two of
// its own instead, so the reveal says what it IS rather than only what it is
// not. A same-show round needs nothing — every card's show is printed anyway.
function noteFor(card, rule) {
  if (rule.kind === 'show') return '';
  const vals = card.vals[rule.kind] ?? [];
  const hit = vals.find((v) => v.key === rule.key);
  if (hit) return hit.label;
  return vals.slice(0, 2).map((v) => v.label).join(', ');
}

/**
 * Deals a game. Returns `{ deal }`, or `{ error, found }` when the lists hold
 * fewer rounds than asked for (`found` is how many they did hold).
 *
 * `settings`: `{ rounds, cards, reasons, sharedOnly }` (prefs.js). `pack` is
 * the indexed fact pack or null.
 */
export function dealGame(players, settings, pack = null, rng = Math.random) {
  const rounds = settings?.rounds ?? 8;
  const size = Math.min(CARDS_RANGE.max, Math.max(CARDS_RANGE.min, settings?.cards ?? 6));
  const reasonsOn = settings?.reasons !== false;
  const pool = cardPool(players, { sharedOnly: Boolean(settings?.sharedOnly) }, pack);

  const sets = [];
  const usedOdd = new Set();
  const used = new Set();
  let showRounds = 0;
  let last = null;
  const showCap = Math.max(1, Math.floor(rounds / 4));

  while (sets.length < rounds) {
    const kinds = RULE_KINDS.filter((k) => k.id !== last && (k.id !== 'show' || showRounds < showCap));
    let built = null;
    // Fresh faces first; a list too small for that may repeat a face in the
    // five, but never deals the same odd one twice.
    for (const fresh of [true, false]) {
      const from = fresh ? pool.filter((c) => !used.has(c.key)) : pool;
      for (const k of weightedOrder(kinds, rng)) {
        built = buildRound(from, k, size, rng, usedOdd);
        if (built) break;
      }
      if (built) break;
    }
    if (!built) break;
    const { cards, odd, rule } = built;
    for (const c of cards) used.add(c.key);
    usedOdd.add(odd.key);
    if (rule.kind === 'show') showRounds += 1;
    last = rule.kind;

    const truth = sentenceFor(rule.kind, rule);
    const reasons = reasonsOn ? shuffle([truth, ...decoysFor(cards, odd, rule, rng)], rng) : [];
    sets.push({
      kind: rule.kind,
      sentence: truth,
      odd: odd.key,
      cards: cards.map((c) => ({
        key: c.key,
        name: c.name,
        series: c.series,
        imageUrl: c.imageUrl,
        note: noteFor(c, rule),
      })),
      reasons,
      reason: reasonsOn ? reasons.indexOf(truth) : -1,
    });
  }

  if (sets.length < rounds) {
    return { error: `These lists hold ${sets.length} round${sets.length === 1 ? '' : 's'} — need ${rounds}.`, found: sets.length };
  }
  return { deal: { rounds, size, reasonsOn, sets } };
}

