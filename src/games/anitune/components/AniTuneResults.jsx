import { computeRankedPlayers } from '../../../shared/utils/ranking';
import { formatPoints } from '../../../shared/utils/deadline';
import { themeAndYear, songCredit } from '../utils/labels';
import { hasLives, rankLives, roundAwards } from '../rules';
import ResultsLayout, { Awards, Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import { splitPodium } from '../../../shared/utils/podium';
import { Avatar, Badge, Button, Card, CardRow, Icon } from '../../../shared/ui';
import descriptor from '../index';
import { useRecordResult } from '../../../shared/hooks/useRecordResult';
import { fromRanked } from '../../../shared/utils/history';

// `departedIds` is online-only: anyone who left mid-match keeps the score they
// had, ranked alongside everyone else, but is dimmed and tagged so the standings
// don't read as though they played the whole round.
export default function AniTuneResults({
  // onBack is local-only: online "again" returns to the lobby, and there is no
  // local setup to go back to. Screen omits the row when it is undefined.
  players, scores, roundSize, mode, lives = null, eliminated = [], eliminatedAt = {},
  // The songs actually heard, for the recap below. `playedCount` matters because
  // Lives can end a round early: the questions after that were dealt but never
  // played, and listing them would both claim the table heard things it didn't
  // and hand out the answers to a re-deal from the same pool.
  round = [], playedCount = null,
  // Every settled song (rules.settle), for the awards.
  log = [],
  departedIds = [], onPlayAgain, onBack,
}) {
  const played = round.slice(0, playedCount ?? round.length);
  const lastManStanding = hasLives(mode);

  // Lives ranks by survival first and points only between players who went out
  // on the same song (rules.rankLives, which says why seat order is not a
  // tiebreak).
  const lifeRanking = lastManStanding ? rankLives(players, scores, eliminated, eliminatedAt) : null;
  const ranked = lifeRanking ? lifeRanking.ranked : computeRankedPlayers(players, scores);

  // The old "12 / 20" denominator only made sense when a question was worth
  // exactly one point. A speed bonus takes the ceiling to 2.0 per question, and
  // "12.4 / 20" would read as though 40 were unreachable rather than 20 being
  // the wrong number entirely — so the total stands alone. The count is the
  // songs HEARD: Lives can end a round early, and "over 10 songs" above a bar
  // reading "6 songs played" contradicted itself.
  const heard = played.length || roundSize;
  const suffix = heard ? `over ${heard} song${heard === 1 ? '' : 's'}` : '';

  const podium = splitPodium(ranked);
  const { winners, rest, kana } = podium;
  // "Survivor" only when it is true: exactly one player never knocked out. A
  // round that ran out of songs with several still in, or took the last two out
  // together, ranks a winner on points like any other mode and stamps it so.
  const stamp = lifeRanking && ranked.length > 1 && lifeRanking.survivors === 1 && winners.length === 1
    ? 'Survivor' : podium.stamp;
  // The finished game, into each seated profile's history (utils/history.js).
  // In Lives the survivor is the one in first place, so the podium already says it.
  useRecordResult(descriptor.id, players, winners.map((p) => p.id), fromRanked(ranked));

  const livesBadge = (p) => {
    const out = eliminated.includes(p.id);
    return (
      <Badge tone={out ? 'red' : 'lime'}>
        {out ? <><Icon name="skull" /> Out</> : <><Icon name="heart" /> {lives?.[p.id] ?? 0}</>}
      </Badge>
    );
  };

  return (
    <ResultsLayout
      ceremony={rest.length}
      game={descriptor}
      title="Final Scores"
      subtitle={suffix}
      players={players}
      onBack={onBack}
      backLabel="← Back to setup"
      splash={winners.length > 0 && (
        <Splash players={winners} stamp={stamp} kana={kana} score={`${formatPoints(winners[0].total)} pts`}>
          {lastManStanding && <div className="mt-1">{livesBadge(winners[0])}</div>}
        </Splash>
      )}
      bar={(
        // Online, only the host has a replay (onPlayAgain is null for everyone
        // else): it sends the whole room back to the lobby, which is the host's
        // call, not whoever taps first.
        <StartBar
          width="md"
          status={onPlayAgain ? `${played.length} song${played.length === 1 ? '' : 's'} played` : 'Waiting for the host…'}
          ready
        >
          {onPlayAgain && <Button variant="primary" size="lg" onClick={onPlayAgain}>Play again</Button>}
        </StartBar>
      )}
    >
      <Standings
        build
        ranked={rest}
        departedIds={departedIds}
        score={(p) => formatPoints(p.total)}
        extra={lastManStanding ? livesBadge : undefined}
      />

      <Awards
        awards={roundAwards(log, players, {
          mode,
          titleOf: (i) => round[i]?.animeTitle ?? '',
          ownersOf: (i) => round[i]?.owners ?? [],
          eliminatedAt,
        })}
      />

      {/* The round's setlist. Not a spoiler measure — the reveal already names
          the song and its performers as each one is played — just the
          "what was that second one again?" list a music quiz wants at the end,
          in one place instead of scattered across screens nobody can go back
          to. */}
      {played.length > 0 && (
        <Card title={`The ${played.length} song${played.length === 1 ? '' : 's'}`} padding="sm" className="mb-6">
          {played.map((q, i) => (
            <CardRow key={`${q.id}:${i}`} className="text-left">
              <span className="w-6 flex-shrink-0 text-sm tabular-nums text-fg-subtle">{i + 1}</span>
              {q.coverImageUrl
                ? <Avatar src={q.coverImageUrl} alt="" size="sm" className="flex-shrink-0" />
                : <span className="w-10 flex-shrink-0" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display font-extrabold text-fg-strong">
                  {songCredit(q) || '—'}
                </span>
                <span className="block truncate text-sm text-fg-subtle">
                  {q.animeTitle} · {themeAndYear(q)}
                </span>
              </span>
            </CardRow>
          ))}
        </Card>
      )}
    </ResultsLayout>
  );
}
