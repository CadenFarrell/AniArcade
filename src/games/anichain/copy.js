import { teamsReady } from '../../shared/utils/teams';
import { MIN_PLAYERS, MIN_TEAM, SKIPS, isTeamShape, turnsPerRound } from './rules';

export const TAGLINE = 'Two clue-givers, one word each — and they can’t confer';

export const SHAPE_NAME = { pair: 'One pair', rivals: 'Rival givers', teams: 'Team pairs' };

/** The heading of a finished turn — what the playtest bots tell the reveal by. */
export function revealTitle(result) {
  if (!result) return 'Turn Over';
  return { got: 'Got It!', out: 'Out of Words', banned: 'Banned Word', void: 'Round Void' }[result.kind] ?? 'Turn Over';
}

/** How many characters a game needs dealt: one a turn, plus the skips one turn may use. */
export const charactersNeeded = (settings) => settings.rounds * turnsPerRound(settings.shape) + SKIPS;

/**
 * The StartBar line for setup and the lobby, and whether Start is open — one
 * function, so the two screens cannot disagree about why a game will not
 * start. `teams` is the split as it stands (ignored for a pair game);
 * `poolSize` how many characters the lists could deal. The pack holds Start
 * while it loads: it supplies most of a show's cast, which is most of the
 * banned list.
 */
export function setupStatus({ count, teams, settings, poolSize, packStatus, online = false }) {
  const { shape } = settings;
  const min = MIN_PLAYERS[shape];
  const split = isTeamShape(shape) ? teamsReady(teams, MIN_TEAM[shape]) : { ok: true };
  const need = charactersNeeded(settings);
  if (count < min) {
    return {
      ready: false,
      status: online ? `Waiting for players — ${SHAPE_NAME[shape]} needs ${min}.` : `${SHAPE_NAME[shape]} needs ${min} players.`,
    };
  }
  if (!split.ok) return { ready: false, status: split.reason };
  if (packStatus === 'loading') return { ready: false, status: 'Loading show facts…' };
  if (poolSize < need) return { ready: false, status: `These lists hold ${poolSize} characters — the game needs ${need}.` };
  const who = isTeamShape(shape) ? `Red ${teams.red.length} v Blue ${teams.blue.length}` : `${count} players`;
  return { ready: true, status: `${who} · ${settings.rounds} rounds · up to ${settings.cap} words` };
}
