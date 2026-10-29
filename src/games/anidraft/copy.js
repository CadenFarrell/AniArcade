import { MAX_PLAYERS, MIN_PLAYERS, boardSize, picksPerRound } from './rules';

export const TAGLINE = 'Draft a team from everyone’s lists — the table votes on the best';

/**
 * How many characters a game needs from the lists: every pick of every round
 * (a drafted character is never dealt again), plus one board's worth of spare
 * so the first board still leaves a choice. deal.js reuses undrafted cards to
 * fill later boards, which is why this is not boards × rounds.
 */
export const cardsNeeded = (players, rounds) => picksPerRound(players) * rounds + (boardSize(players) - picksPerRound(players));

/**
 * The StartBar line for setup and the lobby, and whether Start is open — one
 * function, so the two screens cannot disagree about why a game will not
 * start. `poolSize` is how many characters the lists could deal.
 */
export function setupStatus({ count, settings, poolSize, online = false }) {
  if (count < MIN_PLAYERS) {
    return {
      ready: false,
      status: online ? `Waiting for players — AniDraft needs ${MIN_PLAYERS}.` : `AniDraft needs ${MIN_PLAYERS} players.`,
    };
  }
  if (count > MAX_PLAYERS) return { ready: false, status: `AniDraft seats up to ${MAX_PLAYERS} players.` };
  const need = cardsNeeded(count, settings.rounds);
  if (poolSize < need) return { ready: false, status: `These lists hold ${poolSize} characters — the game needs ${need}.` };
  return { ready: true, status: `${count} teams · ${settings.rounds} round${settings.rounds === 1 ? '' : 's'} · ${boardSize(count)} cards a board` };
}
