import { MIN_PLAYERS, ONLINE_MIN_PLAYERS } from './rules';

export const TAGLINE = 'Bid how many you can name — then name them';

/**
 * The StartBar line for setup and the lobby, and whether Start is open — one
 * function, so the two screens cannot disagree about why a game will not start.
 *
 * `trial` is a deal made from the table as it stands (`{ deal }` or
 * `{ error, found }`): how many categories the lists hold has no cheaper
 * answer than dealing. The pack holds Start while it loads, since it supplies
 * most of the answers a category is checked against.
 */
export function setupStatus({ count, trial, settings, packStatus, online = false }) {
  const min = online ? ONLINE_MIN_PLAYERS : MIN_PLAYERS;
  const loading = packStatus === 'loading';
  const short = !loading && count >= min && Boolean(trial?.error);
  let status;
  if (count < min) status = online ? 'Waiting for more players to join.' : 'Seat at least one player.';
  else if (loading) status = 'Loading show facts…';
  else if (short) status = `Need ${settings.rounds} categories — these lists hold ${trial.found}.`;
  else status = `${count} player${count === 1 ? '' : 's'} · ${settings.rounds} rounds · ${settings.seconds}s to name`;
  return { status, ready: count >= min && !loading && !short, short };
}
