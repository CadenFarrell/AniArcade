import ResultsLayout, { Awards, Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import PlayerFace from '../../../shared/components/PlayerFace';
import { Badge, Button, Card, CardRow } from '../../../shared/ui';
import { sessionAwards } from '../rules';
import { computeRankedPlayers } from '../../../shared/utils/ranking';
import { splitPodium } from '../../../shared/utils/podium';
import descriptor from '../index';
import { useRecordResult } from '../../../shared/hooks/useRecordResult';
import { fromRanked } from '../../../shared/utils/history';

// End of session. computeRankedPlayers handles the tie rule (two players tied
// for 2nd are both 2nd, and the next is 3rd) so this screen never does its own
// sorting — every game in the arcade ends on the same leaderboard semantics.
export default function WavelengthResults({
  players, totalScores, log = [], onPlayAgain, onBack,
  playAgainLabel = 'Play again', backLabel = 'Change settings',
}) {
  const lines = log.filter(Boolean);
  const playerOf = (id) => players.find((p) => p.id === id) ?? null;
  const ranked = computeRankedPlayers(players, totalScores);
  const { winners, rest, stamp, kana } = splitPodium(ranked);
  // The finished game, into each seated profile's history (utils/history.js).
  useRecordResult(descriptor.id, players, winners.map((p) => p.id), fromRanked(ranked));
  const top = winners[0]?.total ?? 0;

  return (
    <ResultsLayout
      ceremony={rest.length}
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
      <Standings build ranked={rest} />
      <Awards awards={sessionAwards(lines, players)} />
      {/* Every round, told back: who was psychic, the spectrum, the clue, where
          the target really was and who read it best. The game is the clues,
          and a final screen of totals alone forgets every one of them. */}
      {lines.length > 0 && (
        <Card title="The rounds" padding="sm" className="mb-6">
          {lines.map((l) => {
            const psychic = playerOf(l.psychicId);
            const best = playerOf(l.bestId);
            return (
              <CardRow key={l.round}>
                <PlayerFace player={psychic ?? { id: l.psychicId, name: '?' }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg-helper">
                    {psychic?.name ?? 'Psychic'} · {l.left} → {l.right}
                  </span>
                  <span className="block truncate font-display text-lg font-extrabold text-fg-strong">
                    {l.clue || '—'}
                  </span>
                  {best && (
                    <span className="block truncate text-sm text-fg-helper">
                      Closest: {best.name}, off by {l.bestDistance}
                    </span>
                  )}
                </span>
                <Badge tone="neutral">{l.target}</Badge>
              </CardRow>
            );
          })}
        </Card>
      )}
    </ResultsLayout>
  );
}
