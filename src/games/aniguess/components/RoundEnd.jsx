import { useMemo } from 'react';
import ResultsLayout, { Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Button } from '../../../shared/ui';
import { KANA } from '../../../shared/ui/kanaText';
import { computeRankedPlayers } from '../../../shared/utils/ranking';
import descriptor from '../index';

// The stop between rounds, on the same frame as the final leaderboard: the
// splash goes to this round's best — fewest turns to solve, everyone tied for it —
// not to the overall leader — the total is the second list, and the leader
// there is often somebody else.
export default function RoundEnd({
  players, lockedPositions, roundNumber, totalScores, departedIds = [],
  // Local pass-and-play has one device and one set of controls, so it has no
  // host concept at all — default to "you're in charge" and LocalGame keeps
  // working untouched. Only the online round end passes these.
  isHost = true, hostName = '',
  onNewRound, onEndSession,
}) {
  const ranked = useMemo(
    () => computeRankedPlayers(players, totalScores),
    [players, totalScores]
  );

  // Don't mutate the prop — .sort() is in-place, and lockedPositions comes
  // straight from game state. Shaped as standings rows (id/position/total) so
  // the round reads in the same list as the totals below it.
  const thisRound = useMemo(
    () => [...lockedPositions]
      .sort((a, b) => a.position - b.position)
      .map((lp) => ({ ...lp, id: lp.playerId, total: lp.points })),
    [lockedPositions]
  );
  const firsts = thisRound.filter((lp) => lp.position === 1);
  const leaders = firsts.map((lp) => players.find((p) => p.id === lp.id) ?? { id: lp.id, name: lp.name });
  const isTied = (lp) => thisRound.filter((o) => o.turnsUsed === lp.turnsUsed).length > 1;
  const turns = (n) => `${n} turn${n === 1 ? '' : 's'}`;

  return (
    <ResultsLayout
      game={descriptor}
      title={`Round ${roundNumber} Done!`}
      players={players}
      splash={firsts.length > 0 && (
        <Splash
          players={leaders}
          stamp={firsts.length > 1 ? 'Tied' : 'Round winner'}
          kana={KANA.round}
          score={`+${firsts[0].points} pts`}
        >
          in {turns(firsts[0].turnsUsed)}
        </Splash>
      )}
      bar={(
        // aria-live (in StartBar) because for a non-host this line is the only
        // thing that changes when the host moves the room on, and it stands in
        // for a control that would otherwise have taken focus.
        <StartBar
          width="md"
          status={isHost
            ? `${roundNumber} round${roundNumber === 1 ? '' : 's'} played`
            : `Waiting for ${hostName || 'the host'} to start the next round…`}
          ready={isHost}
        >
          {isHost && (
            <>
              <Button variant="neutral" size="lg" onClick={onEndSession}>End &amp; See Leaderboard</Button>
              <Button variant="primary" size="lg" onClick={onNewRound}>New Round</Button>
            </>
          )}
        </StartBar>
      )}
    >
      <Standings
        title="This Round"
        ranked={thisRound}
        score={(lp) => `+${lp.points} pts`}
        scoreClass="text-pop-lime"
        extra={(lp) => (
          <span className="shrink-0 text-right text-sm text-fg-subtle">
            {isTied(lp) && <span className="mr-2 font-display font-bold uppercase text-pop-amber">Tied</span>}
            {turns(lp.turnsUsed)}
          </span>
        )}
      />
      <Standings
        title="Total Scores"
        ranked={ranked}
        departedIds={departedIds}
        score={(p) => `${p.total} pts`}
        scoreClass="text-pop-purple"
      />
    </ResultsLayout>
  );
}
