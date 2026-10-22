import ResultsLayout, { Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Button } from '../../../shared/ui';
import { splitPodium } from '../../../shared/utils/podium';
import { standings } from '../rules';
import descriptor from '../index';
import { useRecordResult } from '../../../shared/hooks/useRecordResult';
import { fromRanked } from '../../../shared/utils/history';

// Scores can be negative — a lost wager is the only way — so they are printed
// signed rather than assumed positive.
const signed = (n) => (n < 0 ? `−${Math.abs(n).toLocaleString()}` : n.toLocaleString());

// Final standings. A table of one is a real game here (a quiz on your own), and
// splitPodium stamps it "Finished" rather than crowning the only player.
export default function QuizResults({ players, scores, departedIds = [], onPlayAgain, onBack, againLabel = 'Play again' }) {
  const ranked = standings(players, scores);
  const { winners, rest, stamp, kana } = splitPodium(ranked);
  // The finished game, into each seated profile's history (utils/history.js).
  useRecordResult(descriptor.id, players, winners.map((p) => p.id), fromRanked(ranked));
  const top = winners[0]?.total ?? 0;

  return (
    <ResultsLayout
      game={descriptor}
      title="Final Scores"
      players={players}
      // Local only: online "again" returns to the lobby, and there is no local
      // setup to go back to. Screen omits the row when it is undefined.
      onBack={onBack}
      backLabel="← Back to setup"
      splash={winners.length > 0 && (
        <Splash players={winners} stamp={stamp} kana={kana} score={`${signed(top)} pts`} />
      )}
      bar={(
        // Null online for everyone but the host, who alone moves the room on.
        <StartBar
          width="md"
          status={onPlayAgain
            ? `${players.length} player${players.length === 1 ? '' : 's'}`
            : 'Waiting for the host…'}
          ready
        >
          {onPlayAgain && (
            <Button variant="primary" size="lg" onClick={onPlayAgain}>{againLabel}</Button>
          )}
        </StartBar>
      )}
    >
      <Standings
        ranked={rest}
        departedIds={departedIds}
        score={(p) => signed(p.total)}
        scoreClass={(p) => (p.total < 0 ? 'text-pop-red' : 'text-pop-amber')}
      />
    </ResultsLayout>
  );
}
