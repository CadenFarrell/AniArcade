import ResultsLayout, { Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Button } from '../../../shared/ui';
import { splitPodium } from '../../../shared/utils/podium';
import { useRecordResult } from '../../../shared/hooks/useRecordResult';
import { fromRanked } from '../../../shared/utils/history';
import { standings } from '../rules';
import descriptor from '../index';

// Final standings — the one screen that records the game (play-history rule:
// final results only, never a between-rounds screen, of which AniPeek has none).
export default function AniPeekResults({ players, scores, departedIds = [], onPlayAgain, onBack, againLabel = 'Play again' }) {
  const ranked = standings(players, scores);
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
      splash={winners.length > 0 && (
        <Splash players={winners} stamp={stamp} kana={kana} score={`${top} pts`} />
      )}
      bar={(
        // Null online for everyone but the host, who alone moves the room on.
        <StartBar
          width="md"
          status={onPlayAgain ? `${players.length} players` : 'Waiting for the host…'}
          ready
        >
          {onPlayAgain && (
            <Button variant="primary" size="lg" onClick={onPlayAgain}>{againLabel}</Button>
          )}
        </StartBar>
      )}
    >
      <Standings build ranked={rest} departedIds={departedIds} score={(p) => String(p.total)} />
    </ResultsLayout>
  );
}
