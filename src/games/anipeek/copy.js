import { MIN_PLAYERS } from './rules';

export const TAGLINE = 'Bid low, peek less, name them';

/**
 * The StartBar line for setup and the lobby, and whether Start is open — one
 * function, so the two screens cannot disagree about why a game will not start.
 * `short` is "not enough portraits", which both screens explain in a banner.
 */
export function setupStatus({ count, available, settings, packStatus, online = false }) {
  const short = available < settings.rounds;
  let status;
  if (count < MIN_PLAYERS) {
    status = online ? 'Waiting for more players to join.' : `Seat at least ${MIN_PLAYERS} players.`;
  } else if (short) status = `Need ${settings.rounds} portraits — found ${available}.`;
  else if (settings.hints && packStatus === 'loading') status = 'Loading show facts for the hint cards…';
  else status = `${count} players · ${available} portraits to draw from`;
  const ready = count >= MIN_PLAYERS && !short && !(settings.hints && packStatus === 'loading');
  return { status, ready, short };
}
