// The secret character of one turn, drawn on the dealing device only — locally
// the one device, online the first clue-giver's phone (useChainRoom), so no
// guesser's device ever holds it.
//
// Pure, with an injectable rng, so a seed is a replay.
import { characterOwners, hasPortrait } from '../../shared/utils/characterPool';
import { bannedWords } from './chainWords';

const isMain = (entry) => /main/i.test(entry?.role ?? '');

/**
 * Every character the table could be dealt, as `[{ entry, owners }]`
 * (characterPool's shape). `pool` is the setting: 'main' keeps main
 * characters — the ones a table can build a sentence towards — and falls back
 * to everyone when the lists mark nobody main.
 */
export function chainPool(players, pool = 'main') {
  const all = characterOwners(players);
  if (pool !== 'main') return all;
  const mains = all.filter((c) => isMain(c.entry));
  return mains.length ? mains : all;
}

// One weighted pick: a character more of the table holds is likelier, a main
// twice as likely as a supporting one, and one with no portrait half as likely
// — the reveal is mostly the portrait.
function weightedPick(list, rng) {
  const weight = (c) => c.owners.size * (isMain(c.entry) ? 2 : 1) * (hasPortrait(c.entry.imageUrl) ? 1 : 0.5);
  const total = list.reduce((s, c) => s + weight(c), 0);
  let r = rng() * total;
  for (const c of list) if ((r -= weight(c)) < 0) return c;
  return list[list.length - 1];
}

/**
 * The turn's character: `{ key, name, series, imageUrl }`, or null when the
 * lists are spent. `givers` and `guessers` are player ids; `used` the keys
 * already dealt (and skipped) this game, never dealt again.
 *
 * Someone has to know them on both sides, so the draw tries, in order:
 *   1. a character a giver holds AND an eligible guesser holds;
 *   2. one a giver holds;
 *   3. anyone's.
 * The first tier with anything in it is drawn from; the later ones are only
 * there so a table whose lists never meet still gets a game.
 */
export function drawCharacter(players, { givers = [], guessers = [], used = [], pool = 'main' } = {}, rng = Math.random) {
  const spent = new Set(used);
  const left = chainPool(players, pool).filter((c) => !spent.has(c.entry.id));
  const holds = (c, ids) => ids.some((id) => c.owners.has(id));
  const tiers = [
    left.filter((c) => holds(c, givers) && holds(c, guessers)),
    left.filter((c) => holds(c, givers)),
    left,
  ];
  const tier = tiers.find((t) => t.length);
  if (!tier) return null;
  const { entry } = weightedPick(tier, rng);
  return { key: entry.id, name: entry.name, series: entry.series, imageUrl: entry.imageUrl ?? '' };
}

/** A dealt card: the character and the words its givers may not say. */
export function dealCard(index, character) {
  return character ? { character, banned: bannedWords(index, character) } : null;
}
