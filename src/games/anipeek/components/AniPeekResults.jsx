import ResultsLayout, { Awards, Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Avatar, Button, Card, CardRow, Mark } from '../../../shared/ui';
import { splitPodium } from '../../../shared/utils/podium';
import { useRecordResult } from '../../../shared/hooks/useRecordResult';
import { fromRanked } from '../../../shared/utils/history';
import { peekAwards, standings } from '../rules';
import descriptor from '../index';

// Final standings — the one screen that records the game (play-history rule:
// final results only, never a between-rounds screen, of which AniPeek has none).
export default function AniPeekResults({
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
      <Awards awards={peekAwards(log, players, { nameOf: (i) => deal?.cards?.[i]?.name ?? '' })} />
      <Recap log={log} deal={deal} players={players} />
    </ResultsLayout>
  );
}

// Every round's portrait, now that it is safe to show whole, with the bid that
// won it and how it went. The faces are the best part of the game, and a final
// screen of totals made them vanish the moment the last one was named.
function Recap({ log, deal, players }) {
  const lines = (log ?? []).filter(Boolean);
  if (!lines.length || !deal?.cards?.length) return null;
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  return (
    <Card title="The portraits" padding="sm" className="mb-6">
      {lines.map((l, i) => {
        const card = deal.cards[l.card];
        let how;
        if (l.void) how = 'No points this round';
        else if (!l.by) how = '';
        else how = `${nameOf(l.by)} bid ${l.bid} · used ${l.tiles} tile${l.tiles === 1 ? '' : 's'}${l.hints ? `, ${l.hints} hint${l.hints === 1 ? '' : 's'}` : ''}`;
        return (
          // The log only grows, and a round's place in it is its identity.
          <CardRow key={i}>
            <Avatar src={card?.imageUrl} alt="" size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-lg font-extrabold text-fg-strong">{card?.name ?? 'Unknown'}</span>
              {card?.series && <span className="block truncate text-sm text-fg-helper">{card.series}</span>}
              {how && <span className="block truncate text-sm text-fg-helper">{how}</span>}
            </span>
            {!l.void && l.by && <Mark yes={l.correct} label={l.correct ? `+${l.points}` : 'Missed'} />}
          </CardRow>
        );
      })}
    </Card>
  );
}
