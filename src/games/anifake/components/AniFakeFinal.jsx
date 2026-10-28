import ResultsLayout, { Awards, Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Button } from '../../../shared/ui';
import { computeRankedPlayers } from '../../../shared/utils/ranking';
import { splitPodium } from '../../../shared/utils/podium';
import { useRecordResult } from '../../../shared/hooks/useRecordResult';
import { fromRanked } from '../../../shared/utils/history';
import { matchAwards } from '../rules';
import descriptor from '../index';

/**
 * The end of a match (rules.DEFAULT_MATCH_ROUNDS rounds, or whenever the table
 * ended an endless one): the totals counted down to the winner, and the
 * match's awards. AniFake used to have no such screen — every round's reveal
 * was the end, so an evening of it never crowned anyone.
 *
 * The one screen that records the game (play-history rule: final results only).
 * The per-round reveal used to record each round as its own game, a side's win;
 * a match is now one line with places by total, like every other game.
 */
export default function AniFakeFinal({
  players, totalScores = {}, log = [], played: playedProp = null, rounds = 0, departedIds = [], onPlayAgain,
  againLabel = 'New match', onBack,
}) {
  const ranked = computeRankedPlayers(players, totalScores);
  const { winners, rest, stamp, kana } = splitPodium(ranked);
  useRecordResult(descriptor.id, players, winners.map((p) => p.id), fromRanked(ranked));
  const top = winners[0]?.total ?? 0;
  // Online passes the round count: an unscored round writes no log line.
  const played = playedProp ?? log.length;

  return (
    <ResultsLayout
      ceremony={rest.length}
      game={descriptor}
      title="Final Scores"
      subtitle={`${played} ${played === 1 ? 'round' : 'rounds'}${rounds ? ` of ${rounds}` : ''}`}
      players={players}
      onBack={onBack}
      backLabel="← Back to setup"
      splash={winners.length > 0 && (
        <Splash players={winners} stamp={stamp} kana={kana} score={`${top} pts`} />
      )}
      bar={(
        // Null online for everyone but the host, who alone moves the room on.
        <StartBar width="md" status={onPlayAgain ? `${players.length} players` : 'Waiting for the host…'} ready>
          {onPlayAgain && <Button variant="primary" size="lg" onClick={onPlayAgain}>{againLabel}</Button>}
        </StartBar>
      )}
    >
      <Standings build ranked={rest} departedIds={departedIds} scoreClass="text-pop-teal" score={(p) => `${p.total} pts`} />
      <Awards awards={matchAwards(log, players)} />
    </ResultsLayout>
  );
}
