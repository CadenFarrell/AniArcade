import ResultsLayout, { Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Button } from '../../../shared/ui';
import { computeRankedPlayers } from '../../../shared/utils/ranking';
import { splitPodium } from '../../../shared/utils/podium';
import descriptor from '../index';
import { useRecordResult } from '../../../shared/hooks/useRecordResult';
import { fromRanked } from '../../../shared/utils/history';

// End of session. computeRankedPlayers handles the tie rule (two players tied
// for 2nd are both 2nd, and the next is 3rd) so this screen never does its own
// sorting — every game in the arcade ends on the same leaderboard semantics.
export default function WavelengthResults({
  players, totalScores, onPlayAgain, onBack,
  playAgainLabel = 'Play again', backLabel = 'Change settings',
}) {
  const ranked = computeRankedPlayers(players, totalScores);
  const { winners, rest, stamp, kana } = splitPodium(ranked);
  // The finished game, into each seated profile's history (utils/history.js).
  useRecordResult(descriptor.id, players, winners.map((p) => p.id), fromRanked(ranked));
  const top = winners[0]?.total ?? 0;

  return (
    <ResultsLayout
      game={descriptor}
      title="Final scores"
      players={players}
      splash={winners.length > 0 && (
        <Splash players={winners} stamp={stamp} kana={kana} score={`${top} pts`} />
      )}
      bar={(
        // onPlayAgain is null online for everyone but the host — only they can
        // move the room on, and a button that silently does nothing is worse
        // than none. The status line says who the rest are waiting on.
        <StartBar width="md" status={onPlayAgain ? `${players.length} players` : 'Waiting for the host…'} ready>
          <Button variant="neutral" size="lg" onClick={onBack}>{backLabel}</Button>
          {onPlayAgain && (
            <Button variant="primary" size="lg" onClick={onPlayAgain}>{playAgainLabel}</Button>
          )}
        </StartBar>
      )}
    >
      <Standings ranked={rest} />
    </ResultsLayout>
  );
}
