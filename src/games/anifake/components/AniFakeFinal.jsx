import ResultsLayout, { Awards, Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import PlayerFace from '../../../shared/components/PlayerFace';
import { Button, Card, CardRow, Mark } from '../../../shared/ui';
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
      <MatchRecap log={log} players={players} />
    </ResultsLayout>
  );
}

// Every round, told back: who was the fake, who they were bluffing about, and
// whether the table caught them. The totals alone forget the match's story,
// which is the part a table retells. Lines written before the secret was
// logged (an old room mid-deploy) simply leave the character out.
function MatchRecap({ log, players }) {
  const lines = (log ?? []).filter(Boolean);
  if (!lines.length) return null;
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  return (
    <Card title="The rounds" padding="sm" className="mb-6">
      {lines.map((l, i) => {
        const fake = players.find((p) => p.id === l.fakeId) ?? { id: l.fakeId, name: '?' };
        const namers = (l.namedBy ?? []).map(nameOf);
        return (
          // The log only grows, and a round's place in it is its identity.
          <CardRow key={i}>
            <PlayerFace player={fake} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-fg-helper">
                Round {i + 1}{l.secretName ? ` · the character was ${l.secretName}` : ''}
              </span>
              <span className="block truncate font-display text-lg font-extrabold text-fg-strong">
                {fake.name} was the fake
              </span>
              <span className="block truncate text-sm text-fg-helper">
                {namers.length ? `Named by ${namers.join(', ')}` : 'Nobody named them'}
                {l.stole ? ' · guessed the character' : ''}
              </span>
            </span>
            <Mark yes={!l.escaped} label={l.escaped ? 'Escaped' : 'Caught'} />
          </CardRow>
        );
      })}
    </Card>
  );
}
