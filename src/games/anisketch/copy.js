import { roundsFor } from '../../shared/utils/match';
import { MIN_PLAYERS, ONLINE_MIN_PLAYERS } from './rules';

export const TAGLINE = 'Draw someone from your list. The table names them';

/**
 * The StartBar line for setup and the lobby, and whether Start is open — one
 * function, so the two screens cannot disagree about why a game will not
 * start. `poolSize` is how many pictured characters the lists hold: every
 * turn draws one, never the same twice, and the drawer needs a choice.
 */
export function setupStatus({ count, settings, poolSize, online = false }) {
  const min = online ? ONLINE_MIN_PLAYERS : MIN_PLAYERS;
  if (count < min) {
    return { ready: false, short: false, status: online ? 'Waiting for more players to join.' : `AniSketch needs ${min} players.` };
  }
  const turns = roundsFor(settings.laps, count);
  const need = turns + Math.max(0, settings.choices - 1);
  if (poolSize < need) {
    return { ready: false, short: true, status: `These lists hold ${poolSize} pictured characters — the game needs ${need}.` };
  }
  return { ready: true, short: false, status: `${count} players · ${turns} drawings · ${settings.drawSeconds}s each` };
}
