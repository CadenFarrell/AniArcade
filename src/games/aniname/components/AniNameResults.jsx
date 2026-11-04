import ResultsLayout, { Awards, Splash, Standings } from '../../../shared/components/Results';
import PlayerFace from '../../../shared/components/PlayerFace';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Button, Card, CardRow, Mark } from '../../../shared/ui';
import { categoryText } from '../answers';
import { splitPodium } from '../../../shared/utils/podium';
import { useRecordResult } from '../../../shared/hooks/useRecordResult';
import { fromRanked } from '../../../shared/utils/history';
import { nameAwards, standings } from '../rules';
import descriptor from '../index';

// Final standings — the one screen that records the game (play-history rule:
// final results only, never a between-rounds screen; AniName's reveal is one).
export default function AniNameResults({
  players, scores, log = [], deal = null, departedIds = [], onPlayAgain, onBack, againLabel = 'Play again',
}) {
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
          status={onPlayAgain ? `${players.length} player${players.length === 1 ? '' : 's'}` : 'Waiting for the host…'}
          ready
        >
          {onPlayAgain && (
            <Button variant="primary" size="lg" onClick={onPlayAgain}>{againLabel}</Button>
          )}
        </StartBar>
      )}
    >
      <Standings build ranked={rest} departedIds={departedIds} score={(p) => String(p.total)} />
      <Awards awards={nameAwards(log, players)} />
      <Recap log={log} deal={deal} players={players} />
    </ResultsLayout>
  );
}

// Every round, told back: the category, who took it on and for how many, and
// how far they got. The bids are the game's story, and totals alone forget it.
function Recap({ log, deal, players }) {
  const lines = (log ?? []).filter(Boolean);
  if (!lines.length) return null;
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  return (
    <Card title="The rounds" padding="sm" className="mb-6">
      {lines.map((l) => {
        const cat = deal?.cats?.[l.round];
        const bidder = players.find((p) => p.id === l.by) ?? (l.by ? { id: l.by, name: nameOf(l.by) } : null);
        return (
          <CardRow key={l.round}>
            {bidder && <PlayerFace player={bidder} />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-fg-helper">{cat ? categoryText(cat) : `Round ${l.round + 1}`}</span>
              <span className="block truncate font-display text-lg font-extrabold text-fg-strong">
                {l.void ? 'Round void' : `${nameOf(l.by)} bid ${l.n}`}
              </span>
              {!l.void && <span className="block truncate text-sm text-fg-helper">Named {l.count}</span>}
            </span>
            {!l.void && <Mark yes={l.made} label={l.made ? 'Made it' : 'Short'} />}
          </CardRow>
        );
      })}
    </Card>
  );
}
