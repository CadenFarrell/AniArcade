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
 * match's awards. AniRank used to have no end at all — "New ten" forever — so
 * the evening had no winner, and the per-round results recorded each round as
 * its own game in the play history.
 *
 * The one screen that records the game (play-history rule: final results only).
 * An unscored match (Keep score off) has no totals to rank, so it records a
 * game nobody won rather than inventing a winner out of zeros.
 */
export default function AniRankFinal({
  players, totalScores = {}, log = [], played = null, rounds = 0, scoring = true, departedIds = [],
  onPlayAgain, againLabel = 'New match', onBack,
}) {
  const ranked = computeRankedPlayers(players, totalScores);
  const { winners, rest, stamp, kana } = splitPodium(ranked);
  useRecordResult(descriptor.id, players, scoring ? winners.map((p) => p.id) : [], scoring ? fromRanked(ranked) : undefined);
  const top = winners[0]?.total ?? 0;
  const count = played ?? log.length;

  return (
    <ResultsLayout
      ceremony={scoring ? rest.length : null}
      game={descriptor}
      title="Final Scores"
      subtitle={`${count} ${count === 1 ? 'round' : 'rounds'}${rounds ? ` of ${rounds}` : ''}`}
      players={players}
      onBack={onBack}
      backLabel="← Back to setup"
      splash={scoring && winners.length > 0 && (
        <Splash players={winners} stamp={stamp} kana={kana} score={`${top} pts`} />
      )}
      bar={(
        // Null online for everyone but the host, who alone moves the room on.
        <StartBar width="md" status={onPlayAgain ? `${players.length} players` : 'Waiting for the host…'} ready>
          {onPlayAgain && <Button variant="primary" size="lg" onClick={onPlayAgain}>{againLabel}</Button>}
        </StartBar>
      )}
    >
      {scoring ? (
        <Standings build ranked={rest} departedIds={departedIds} score={(p) => `${p.total} pts`} />
      ) : (
        // Unscored: nobody won, but the table still played it — say who.
        <Standings
          title="Played"
          ranked={players.map((p) => ({ ...p, position: null }))}
          departedIds={departedIds}
          score={() => ''}
        />
      )}
      <Awards awards={matchAwards(log, players)} />
    </ResultsLayout>
  );
}
