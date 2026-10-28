import ResultsLayout, { Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import { TEAM_STYLE } from '../../../shared/components/teams/teamStyle';
import { useRecordResult } from '../../../shared/hooks/useRecordResult';
import { fromRanked } from '../../../shared/utils/history';
import { splitPodium } from '../../../shared/utils/podium';
import { teamOf } from '../../../shared/utils/teams';
import { Avatar, Badge, Button, Card } from '../../../shared/ui';
import { KANA } from '../../../shared/ui/kanaText';
import { isTeamShape, standings, winningTeams } from '../rules';
import descriptor from '../index';

// Final standings — the one screen that records the game (play-history rule:
// final results only, never a between-turns reveal). A pair game ranks
// players; the team shapes rank the two teams, and the whole winning team won
// (both, on a tie). Below them, every turn told back: who it was and how many
// words it took — the recap a table argues over.
export default function AniChainResults({ game, players, departedIds = [], onPlayAgain, onBack, againLabel = 'Play again' }) {
  const teamGame = isTeamShape(game.shape);
  const ranked = standings(players, game.scores);
  const { winners, rest, stamp, kana } = splitPodium(ranked);
  const winTeams = teamGame ? winningTeams(game.teamScores) : [];
  const teamWinners = players.filter((p) => winTeams.includes(teamOf(game, p.id)));
  const winnerIds = (teamGame ? teamWinners : winners).map((p) => p.id);
  useRecordResult(
    descriptor.id,
    players,
    winnerIds,
    teamGame
      ? { places: Object.fromEntries(players.map((p) => [p.id, winnerIds.includes(p.id) ? 1 : 2])) }
      : fromRanked(ranked),
  );

  const splash = teamGame ? (
    <Splash
      players={teamWinners}
      stamp={winTeams.length > 1 ? 'Draw' : 'Winner'}
      kana={KANA.winner}
      kicker={winTeams.length > 1 ? 'Both teams' : `${TEAM_STYLE[winTeams[0]].name} team`}
      score={`${game.teamScores[winTeams[0]]} pts`}
    />
  ) : winners.length > 0 && (
    <Splash players={winners} stamp={stamp} kana={kana} score={`${winners[0].total} pts`} />
  );

  return (
    <ResultsLayout
      ceremony={teamGame ? players.length : rest.length}
      game={descriptor}
      title="Final Scores"
      players={players}
      // Local only; online "again" returns everyone to the lobby.
      onBack={onBack}
      backLabel="← Back to setup"
      splash={splash}
      bar={(
        // Null online for everyone but the host, who alone moves the room on.
        <StartBar
          width="md"
          status={onPlayAgain ? `${game.log.length} turn${game.log.length === 1 ? '' : 's'} played` : 'Waiting for the host…'}
          ready
        >
          {onPlayAgain && <Button variant="primary" size="lg" onClick={onPlayAgain}>{againLabel}</Button>}
        </StartBar>
      )}
    >
      {teamGame ? (
        <Standings
          build
          title="Teams"
          ranked={['red', 'blue']
            .map((t) => ({ id: t, name: TEAM_STYLE[t].name, total: game.teamScores[t] ?? 0 }))
            .sort((x, y) => y.total - x.total)
            .map((t, i, all) => ({ ...t, position: i > 0 && all[0].total === t.total ? 1 : i + 1 }))}
          score={(t) => String(t.total)}
          extra={(t) => <Badge tone={TEAM_STYLE[t.id].tone}>{(game.teams?.[t.id] ?? []).length} players</Badge>}
        />
      ) : (
        <Standings build ranked={rest} departedIds={departedIds} score={(p) => String(p.total)} />
      )}
      <Recap game={game} players={players} />
    </ResultsLayout>
  );
}

// Every turn, one line: the character, how it ended and in how many words.
function Recap({ game, players }) {
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  if (!game.log.length) return null;
  return (
    <Card title="Every turn" padding="sm" className="mb-6">
      <ol>
        {game.log.map((e, i) => {
          const how = e.kind === 'got' ? `${nameOf(e.by)} in ${e.n} (+${e.value})`
            : e.kind === 'out' ? 'Out of words'
              : e.kind === 'banned' ? 'Banned word'
                : 'Void';
          return (
            // The log only grows, and a turn's place in it is its identity.
            <li key={i} className="flex items-center gap-3 border-b border-line px-2 py-2 last:border-0">
              <Avatar src={e.character?.imageUrl} alt="" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-bold uppercase tracking-wide text-fg-strong">
                  {e.character?.name ?? 'Unrevealed'}
                </p>
                <p className="truncate text-sm text-fg-helper">
                  {e.givers.map(nameOf).join(' & ')}
                  {e.chain.some(Boolean) ? ` — “${e.chain.join(' ')}”` : ''}
                </p>
              </div>
              <span className="shrink-0 text-right text-sm font-bold text-fg-body">{how}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
