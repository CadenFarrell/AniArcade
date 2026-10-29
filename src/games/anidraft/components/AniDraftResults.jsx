import ResultsLayout, { Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import { useRecordResult } from '../../../shared/hooks/useRecordResult';
import { fromRanked } from '../../../shared/utils/history';
import { splitPodium } from '../../../shared/utils/podium';
import { Avatar, Button, Card } from '../../../shared/ui';
import { roleOf } from '../roles';
import { standings, winnersOf } from '../rules';
import descriptor from '../index';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Final standings — the one screen that records the game (play-history rule:
// final results only, never a round's reveal). Points are roles won; votes
// received break a tie, and the rows say both so the tie-break is visible.
// Below them, every round's teams told back role by role, with what won — the
// recap a table argues over.
export default function AniDraftResults({ game, players, departedIds = [], onPlayAgain, onBack, againLabel = 'Play again' }) {
  const ranked = standings(players, game);
  const { winners, rest, stamp, kana } = splitPodium(ranked);
  useRecordResult(descriptor.id, players, winners.map((p) => p.id), fromRanked(ranked));

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
        <Splash
          players={winners}
          stamp={stamp}
          kana={kana}
          score={plural(winners[0].total, 'role')}
        >
          <p className="text-sm text-fg-body">{plural(winners[0].votes, 'vote')} received</p>
        </Splash>
      )}
      bar={(
        // Null online for everyone but the host, who alone moves the room on.
        <StartBar
          width="md"
          status={onPlayAgain ? `${plural(game.log.length, 'round')} drafted` : 'Waiting for the host…'}
          ready
        >
          {onPlayAgain && <Button variant="primary" size="lg" onClick={onPlayAgain}>{againLabel}</Button>}
        </StartBar>
      )}
    >
      <Standings
        build
        ranked={rest}
        departedIds={departedIds}
        score={(p) => String(p.total)}
        extra={(p) => <span className="text-xs text-fg-helper">{plural(p.votes, 'vote')}</span>}
      />
      <Recap game={game} players={players} />
    </ResultsLayout>
  );
}

// Every round: each role, the pick that won it and by whom.
function Recap({ game, players }) {
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  if (!game.log.length) return null;
  return (
    <>
      {game.log.map((entry) => (
        <Card key={entry.round} title={`Round ${entry.round + 1}`} padding="sm" className="mb-6">
          <ol>
            {entry.roles.map((roleId, i) => {
              const won = winnersOf(entry.tally[i], game.order);
              const top = won[0];
              const card = top ? entry.teams[top]?.[i] : null;
              return (
                // A round's roles are distinct, and their place is their identity.
                <li key={roleId} className="flex items-center gap-3 border-b border-line px-2 py-2 last:border-0">
                  <Avatar src={card?.imageUrl} alt="" size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-fg-helper">{roleOf(roleId).name}</p>
                    <p className="truncate font-display text-base font-bold uppercase tracking-wide text-fg-strong">
                      {card?.name ?? 'No votes'}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-sm font-bold text-fg-body">
                    {won.length ? won.map(nameOf).join(' & ') : '—'}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      ))}
    </>
  );
}
