import ResultsLayout, { Awards, Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import { useRecordResult } from '../../../shared/hooks/useRecordResult';
import { fromRanked } from '../../../shared/utils/history';
import { splitPodium } from '../../../shared/utils/podium';
import { Avatar, Button, Card, CardRow, Mark } from '../../../shared/ui';
import { sketchAwards, standings } from '../rules';
import descriptor from '../index';

// Final standings — the one screen that records the game (play-history rule:
// final results only, never a turn's reveal). Below them, every turn told
// back: who drew whom, and who named it.
export default function AniSketchResults({ game, players, departedIds = [], onPlayAgain, onBack, againLabel = 'Play again' }) {
  const ranked = standings(players, game.scores);
  const { winners, rest, stamp, kana } = splitPodium(ranked);
  useRecordResult(descriptor.id, players, winners.map((p) => p.id), fromRanked(ranked));
  const top = winners[0]?.total ?? 0;

  return (
    <ResultsLayout
      ceremony={rest.length}
      game={descriptor}
      title="Final Scores"
      players={players}
      // Local only; online "again" returns everyone to the lobby.
      onBack={onBack}
      backLabel="← Back to setup"
      splash={winners.length > 0 && <Splash players={winners} stamp={stamp} kana={kana} score={`${top} pts`} />}
      bar={(
        // Null online for everyone but the host, who alone moves the room on.
        <StartBar
          width="md"
          status={onPlayAgain ? `${game.log.length} drawing${game.log.length === 1 ? '' : 's'}` : 'Waiting for the host…'}
          ready
        >
          {onPlayAgain && <Button variant="primary" size="lg" onClick={onPlayAgain}>{againLabel}</Button>}
        </StartBar>
      )}
    >
      <Standings build ranked={rest} departedIds={departedIds} score={(p) => String(p.total)} />
      <Awards awards={sketchAwards(game.log, players)} />
      <Recap log={game.log} players={players} />
    </ResultsLayout>
  );
}

// Every turn: the character, who drew them, and how many named them.
function Recap({ log, players }) {
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  if (!log.length) return null;
  return (
    <Card title="The drawings" padding="sm" className="mb-6">
      {log.map((l) => {
        const named = Object.keys(l.got ?? {});
        return (
          <CardRow key={l.turn}>
            <Avatar src={l.character?.imageUrl} alt="" size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-fg-helper">Drawn by {nameOf(l.drawer)}</span>
              <span className="block font-display text-lg font-extrabold text-fg-strong [overflow-wrap:anywhere]">
                {l.character?.name ?? (l.void ? 'Turn void' : 'Nobody knows')}
              </span>
              {named.length > 0 && (
                <span className="block text-sm text-fg-helper [overflow-wrap:anywhere]">{named.map(nameOf).join(', ')}</span>
              )}
            </span>
            <Mark yes={named.length > 0} label={named.length ? `${named.length} named it` : 'Nobody'} />
          </CardRow>
        );
      })}
    </Card>
  );
}
