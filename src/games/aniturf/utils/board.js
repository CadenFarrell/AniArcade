// The 25 characters a game is played over, drawn from the seated players'
// lists. Pure and offline, like every pool in the arcade.
//
// A clue only works on characters the guessers know, so the draw leans toward
// the characters MORE of the table holds: everything is ranked by how many
// players own it (then portrait, then favourites), and the board is a shuffle
// of the best-ranked two boards' worth. A window rather than the top 25
// exactly, so two games with the same table do not deal the same board.
//
// Portraits are preferred, never required. A card is a portrait AND a name,
// and the name alone still plays; requiring one would lock out most lists
// imported before portraits were stored.
import { characterOwners } from '../../../shared/utils/characterPool';
import { CELLS } from '../rules';

const WINDOW = CELLS * 2;

/** Every character the board can draw from, as `{ entry, owners }`. */
export function boardPool(players, { sharedOnly = false } = {}) {
  if (!players?.length) return [];
  const all = characterOwners(players);
  return sharedOnly ? all.filter((c) => c.owners.size === players.length) : all;
}

export function drawBoard(players, { sharedOnly = false, rng = Math.random } = {}) {
  const pool = boardPool(players, { sharedOnly });
  if (pool.length < CELLS) return { board: [], enough: false, available: pool.length };
  const ranked = [...pool].sort((a, b) => (
    b.owners.size - a.owners.size
    || Number(Boolean(b.entry.imageUrl)) - Number(Boolean(a.entry.imageUrl))
    || (b.entry.favourites ?? 0) - (a.entry.favourites ?? 0)
  ));
  const window = ranked.slice(0, Math.max(CELLS, Math.min(ranked.length, WINDOW)));
  // Fisher–Yates over the window, then the first 25.
  for (let i = window.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [window[i], window[j]] = [window[j], window[i]];
  }
  // Only what a card shows travels into the game (and online, into state/):
  // role, genres and favourites are the pool's business, not the board's.
  const board = window.slice(0, CELLS).map(({ entry }) => ({
    id: entry.id,
    name: entry.name,
    series: entry.series,
    imageUrl: entry.imageUrl,
  }));
  return { board, enough: true, available: pool.length };
}
