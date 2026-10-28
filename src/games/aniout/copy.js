import { MIN_PLAYERS, ONLINE_MIN_PLAYERS } from './rules';

export const TAGLINE = 'Five belong. Spot the one who doesn’t';

/**
 * The StartBar line for setup and the lobby, and whether Start is open — one
 * function, so the two screens cannot disagree about why a game will not start.
 *
 * `trial` is a deal made from the table as it stands (`{ deal }` or
 * `{ error, found }`), because "how many rounds do these lists hold" has no
 * cheaper answer than trying: a round needs five characters from five shows
 * sharing a value and a sixth that is out on that alone. `short` is the banner's
 * cue. The pack holds Start while it loads — it supplies most of what a round
 * is built on (studios, tags, voice actors).
 */
export function setupStatus({ count, trial, settings, packStatus, online = false }) {
  const min = online ? ONLINE_MIN_PLAYERS : MIN_PLAYERS;
  const loading = packStatus === 'loading';
  const short = !loading && count >= min && Boolean(trial?.error);
  let status;
  if (count < min) {
    status = online ? 'Waiting for more players to join.' : 'Seat at least one player.';
  } else if (loading) status = 'Loading show facts…';
  else if (short) status = `Need ${settings.rounds} rounds — these lists hold ${trial.found}.`;
  else status = `${count} player${count === 1 ? '' : 's'} · ${settings.rounds} rounds of ${settings.cards}`;
  const ready = count >= min && !loading && !short;
  return { status, ready, short };
}
