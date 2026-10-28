import { useMemo } from 'react';
import ResultsLayout, { Awards, Splash, Standings } from '../../../shared/components/Results';
import { matchAwards } from '../rules';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Button } from '../../../shared/ui';
import { computeRankedPlayers } from '../../../shared/utils/ranking';
import { splitPodium } from '../../../shared/utils/podium';
import descriptor from '../index';
import { useRecordResult } from '../../../shared/hooks/useRecordResult';
import { fromRanked } from '../../../shared/utils/history';

// `departedIds` is online-only: anyone who left mid-session keeps the points
// they earned and stays in the standings, dimmed and tagged, so the result
// doesn't read as though they played it out.
//
// The stepped 2-1-3 podium this screen used to open with is the splash now, as
// on every results screen: one panel for the winner (or everyone tied for it),
// wearing the character they sat down as.
export default function Leaderboard({
  players, totalScores, roundNumber, departedIds = [], onPlayAgain, onEditLists,
  // Every finished round's locks (the match's story), for the awards.
  roundHistory = [],
}) {
  const ranked = useMemo(
    () => computeRankedPlayers(players, totalScores),
    [players, totalScores]
  );
  const { winners, rest, stamp, kana } = splitPodium(ranked);
  // The finished game, into each seated profile's history (utils/history.js).
  useRecordResult(descriptor.id, players, winners.map((p) => p.id), fromRanked(ranked));

  // A tie below first is said in words beside the place mark: two "2"s in a
  // column otherwise read as a typo.
  const isTied = (player) => ranked.filter((p) => p.position === player.position).length > 1;
  const rounds = `${roundNumber} round${roundNumber !== 1 ? 's' : ''} played`;

  return (
    <ResultsLayout
      ceremony={rest.length}
      game={descriptor}
      title="Final Results"
      subtitle={rounds}
      players={players}
      splash={winners.length > 0 && (
        <Splash players={winners} stamp={stamp} kana={kana} score={`${winners[0].total} pts`} />
      )}
      bar={(
        <StartBar width="md" status={`${players.length} players`} ready>
          <Button variant="neutral" size="lg" onClick={onEditLists}>Edit Character Lists</Button>
          <Button variant="primary" size="lg" onClick={onPlayAgain}>Play Again</Button>
        </StartBar>
      )}
    >
      <Standings
        build
        ranked={rest}
        departedIds={departedIds}
        score={(p) => `${p.total} pts`}
        extra={(p) => isTied(p) && (
          <span className="font-display text-xs font-bold uppercase tracking-wider text-pop-amber">Tied</span>
        )}
      />
      <Awards awards={matchAwards(roundHistory, players)} />
    </ResultsLayout>
  );
}
