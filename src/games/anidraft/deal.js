// The board: one round's characters, drawn from every list at the table.
// Nothing on it is hidden, so whoever deals it may — locally the one device,
// online whichever phone starts the game or moves it to the next round
// (useDraftRoom), inside the transaction that opens the round.
//
// Pure, with an injectable rng, so a seed is a replay.
import { characterOwners, hasPortrait } from '../../shared/utils/characterPool';
import { dealRoles } from './roles';
import { ROLES_PER_ROUND, boardSize, draftedKeys } from './rules';

const isMain = (entry) => /main/i.test(entry?.role ?? '');

/**
 * Every character the table could be dealt, as `[{ entry, owners }]`
 * (characterPool's shape). `pool` is the setting: 'main' keeps the main
 * characters — the ones a table has opinions about — and falls back to
 * everyone when the lists mark nobody main (AniChain's chainPool does the same).
 */
export function draftPool(players, pool = 'main') {
  const all = characterOwners(players);
  if (pool !== 'main') return all;
  const mains = all.filter((c) => isMain(c.entry));
  return mains.length ? mains : all;
}

// A character more of the table holds is likelier — a draft argument needs
// people who know who they are arguing about — a main twice as likely as a
// supporting one, and one with no portrait far less: the board is a wall of
// portraits, and a grey silhouette there is a card nobody can read at a glance.
const weight = (c) => c.owners.size * (isMain(c.entry) ? 2 : 1) * (hasPortrait(c.entry.imageUrl) ? 1 : 0.25);

// `n` picks without replacement, each weighted.
function drawWeighted(list, n, rng) {
  const left = [...list];
  const out = [];
  while (out.length < n && left.length) {
    const total = left.reduce((s, c) => s + weight(c), 0);
    let r = rng() * total;
    let at = left.length - 1;
    for (let i = 0; i < left.length; i++) if ((r -= weight(left[i])) < 0) { at = i; break; }
    out.push(left[at]);
    left.splice(at, 1);
  }
  return out;
}

const toCard = ({ entry }) => ({ key: entry.id, name: entry.name, series: entry.series, imageUrl: entry.imageUrl ?? '' });

/**
 * A board of up to `size` cards, `[{ key, name, series, imageUrl }]`, in the
 * random order they were drawn (the board shows them that way, and autoPick
 * takes the first left).
 *
 * Characters never dealt this game (`used`) come first. Only when the lists run
 * short does it top up with ones dealt before but never drafted (`drafted`
 * excluded) — a card left on last round's board is new to nobody, but a game
 * that ends early for want of a few cards is worse. A drafted character is
 * never dealt again, so no character plays for two teams in one game.
 */
export function dealBoard(players, { size, pool = 'main', used = [], drafted = [] } = {}, rng = Math.random) {
  const seen = new Set(used);
  const gone = new Set(drafted);
  const all = draftPool(players, pool).filter((c) => !gone.has(c.entry.id));
  const fresh = all.filter((c) => !seen.has(c.entry.id));
  const cards = drawWeighted(fresh, size, rng);
  if (cards.length < size) cards.push(...drawWeighted(all.filter((c) => seen.has(c.entry.id)), size - cards.length, rng));
  return cards.map(toCard);
}

/** The first round's board and roles, for rules.startGame. */
export function firstDeal(players, { pool = 'main' } = {}, rng = Math.random) {
  return {
    board: dealBoard(players, { size: boardSize(players.length), pool }, rng),
    roles: dealRoles(ROLES_PER_ROUND, rng),
  };
}

/**
 * The next round's board and roles, for rules.nextRound: avoiding everything
 * this game has dealt, never a character already drafted, and — where the
 * deck allows — none of this round's roles. `players` are the SEATED players'
 * profiles, departed ones included: their lists stay part of the table's pool.
 */
export function roundDeal(players, game, rng = Math.random) {
  return {
    board: dealBoard(players, {
      size: boardSize(game.order.length), pool: game.pool, used: game.used, drafted: draftedKeys(game),
    }, rng),
    roles: dealRoles(ROLES_PER_ROUND, rng, game.roles),
  };
}
