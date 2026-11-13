import ResultsLayout, { Awards, Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import PlayerFace from '../../../shared/components/PlayerFace';
import { Avatar, Button, Card, CardRow, Mark } from '../../../shared/ui';
import { splitPodium } from '../../../shared/utils/podium';
import { useRecordResult } from '../../../shared/hooks/useRecordResult';
import { fromRanked } from '../../../shared/utils/history';
import { outAwards, standings } from '../rules';
import descriptor from '../index';

// Final standings — the one screen that records the game (play-history rule:
// final results only, never a between-rounds screen; AniOut's reveal is one).
export default function AniOutResults({
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
      <Awards
        awards={outAwards(log, players, {
          reasonsOn: Boolean(deal?.reasonsOn),
          nameOf: (round, key) => deal?.sets?.[round]?.cards?.find((c) => c.key === key)?.name ?? '',
          oddOf: (round) => {
            const set = deal?.sets?.[round];
            return set?.cards?.find((c) => c.key === set.odd)?.name ?? '';
          },
        })}
      />
      <Recap log={log} deal={deal} players={players} />
    </ResultsLayout>
  );
}

// Every round, told back: the odd one out, what the others had in common, and
// who saw it. The connections are the game, and totals alone forget them.
function Recap({ log, deal, players }) {
  const lines = (log ?? []).filter(Boolean);
  if (!lines.length || !deal?.sets?.length) return null;
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  return (
    <Card title={deal.mode === 'groups' ? 'The boards' : 'The rounds'} padding="sm" className="mb-6">
      {lines.map((l) => {
        const set = deal.sets[l.round];
        if (!set) return null;
        // A board has no one face: its row leads with the groups' links.
        const board = Boolean(set.groups);
        const odd = board ? null : set.cards.find((c) => c.key === set.odd);
        const nobody = !l.got.length;
        return (
          <CardRow key={l.round}>
            {!board && <Avatar src={odd?.imageUrl} alt="" size="sm" />}
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-fg-helper [overflow-wrap:anywhere]">
                {board ? set.groups.map((g) => g.sentence).join(' · ') : set.sentence}
              </span>
              <span className="block truncate font-display text-lg font-extrabold text-fg-strong">
                {board ? `Board ${l.round + 1}` : (odd?.name ?? 'The odd one out')}
              </span>
              <span className="flex flex-wrap items-center gap-1 text-sm text-fg-helper">
                {nobody ? (board ? 'Nobody sorted it all' : 'It fooled everyone') : (
                  <>
                    {l.got.map((id) => <PlayerFace key={id} player={players.find((p) => p.id === id) ?? { id, name: nameOf(id) }} />)}
                    <span className="truncate">{l.got.map(nameOf).join(', ')}</span>
                  </>
                )}
              </span>
            </span>
            <Mark yes={!nobody} label={nobody ? 'Nobody' : `${l.got.length} got it`} />
          </CardRow>
        );
      })}
    </Card>
  );
}
