import ResultsLayout, { Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Button } from '../../../shared/ui';
import { computeRankedPlayers } from '../../../shared/utils/ranking';
import { splitPodium } from '../../../shared/utils/podium';
import descriptor from '../index';

// End of session. computeRankedPlayers handles the tie rule (two players tied
// for 2nd are both 2nd, and the next is 3rd) so this screen never does its own
// sorting — every game in the arcade ends on the same leaderboard semantics.
//
// Nobody here imported a list for this game, but the portraits still come from
// their profiles when they have one — the same faces the setup slots wore —
// and a player with none gets the bare panel and their initial.
export default function AniTagResults({
  players, totalScores, onPlayAgain, onBack,
  playAgainLabel = 'Play again', backLabel = 'Change settings',
}) {
  const ranked = computeRankedPlayers(players, totalScores);
  const { winners, rest, stamp, kana } = splitPodium(ranked);
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
        // Null online for everyone but the host — only they can move the room
        // on, and a button that silently does nothing is worse than none.
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
