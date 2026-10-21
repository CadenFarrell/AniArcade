import ResultsLayout, { Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import { computeRankedPlayers } from '../../../shared/utils/ranking';
import { Badge, Button } from '../../../shared/ui';
import { KANA } from '../../../shared/ui/kanaText';
import { TEAM_NAMES, teamOf } from '../rules';
import ClueLog from './ClueLog';
import TurfBoard from './TurfBoard';
import { TEAM_STYLE } from './teamStyle';
import descriptor from '../index';

// How the game was won, in the splash: a route across, a team cut off, or a
// team with nobody left to guess (online only).
function reasonFor(game) {
  const loser = TEAM_NAMES[game.loser] ?? 'The other team';
  if (game.winBy === 'cut') return `${loser} had no route left across the board.`;
  if (game.winBy === 'forfeit') return `${loser} had nobody left to guess.`;
  return `Crossed the board ${TEAM_STYLE[game.winner].goal}.`;
}

// The end of a game. The splash is the winning team — every one of them, since
// a team win is shared — and the standings count wins across the session, a
// win for each player on the team that took the turf. Below them the final
// board and the clue log: the recap a table actually argues over.
export default function AniTurfResults({
  game, players, totalScores, departedIds = [], onPlayAgain, playAgainLabel = 'Play again', onChangeTeams,
}) {
  const s = TEAM_STYLE[game.winner];
  const winners = players.filter((p) => game.teams[game.winner]?.includes(p.id));
  const ranked = computeRankedPlayers(players, totalScores);
  return (
    <ResultsLayout
      game={descriptor}
      title="Final Board"
      subtitle={`${s.name} takes the turf.`}
      players={players}
      splash={(
        <Splash players={winners} stamp="Winner" kana={KANA.winner} kicker={`${s.name} team`}>
          {reasonFor(game)}
        </Splash>
      )}
      bar={(
        <StartBar status={`${s.name} wins this one.`} ready width="md">
          {onChangeTeams && (
            <Button variant="secondary" size="lg" onClick={onChangeTeams}>Change teams</Button>
          )}
          {onPlayAgain && (
            <Button variant="primary" size="lg" onClick={onPlayAgain}>{playAgainLabel}</Button>
          )}
        </StartBar>
      )}
    >
      <Standings
        title="Wins"
        ranked={ranked}
        departedIds={departedIds}
        extra={(p) => {
          const team = teamOf(game, p.id);
          return team ? <Badge tone={TEAM_STYLE[team].tone}>{TEAM_STYLE[team].name}</Badge> : null;
        }}
      />
      <TurfBoard board={game.board} marks={game.marks} />
      <ClueLog game={game} players={players} />
    </ResultsLayout>
  );
}
