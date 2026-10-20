import { computeRankedPlayers } from '../../../shared/utils/ranking';
import { formatPoints } from '../../../shared/utils/deadline';
import { themeAndYear, songCredit } from '../utils/labels';
import { hasLives } from '../rules';
import ResultsLayout, { Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import { splitPodium } from '../../../shared/utils/podium';
import { Avatar, Badge, Button, Card, CardRow, Icon } from '../../../shared/ui';
import descriptor from '../index';

// `departedIds` is online-only: anyone who left mid-match keeps the score they
// had, ranked alongside everyone else, but is dimmed and tagged so the standings
// don't read as though they played the whole round.
export default function AniTuneResults({
  // onBack is local-only: online "again" returns to the lobby, and there is no
  // local setup to go back to. Screen omits the row when it is undefined.
  players, scores, roundSize, mode, lives = null, eliminated = [],
  // The songs actually heard, for the recap below. `playedCount` matters because
  // Lives can end a round early: the questions after that were dealt but never
  // played, and listing them would both claim the table heard things it didn't
  // and hand out the answers to a re-deal from the same pool.
  round = [], playedCount = null,
  departedIds = [], onPlayAgain, onBack,
}) {
  const played = round.slice(0, playedCount ?? round.length);
  const lastManStanding = hasLives(mode);

  // Lives ranks by survival first and points only as a tiebreak, because that is
  // what the mode asks of you: a player who outlasted everyone on lucky guesses
  // beat the one who scored more and went out in round three. `eliminated` is
  // append-only, so its order IS the elimination order — later out is better.
  const ranked = lastManStanding
    ? [...players]
      .map((p) => ({ ...p, total: scores[p.id] || 0, outAt: eliminated.indexOf(p.id) }))
      .sort((a, b) => {
        if ((a.outAt < 0) !== (b.outAt < 0)) return a.outAt < 0 ? -1 : 1;
        if (a.outAt !== b.outAt) return b.outAt - a.outAt;
        return b.total - a.total;
      })
      .map((p, i) => ({ ...p, position: i + 1 }))
    : computeRankedPlayers(players, scores);

  // The old "12 / 20" denominator only made sense when a question was worth
  // exactly one point. A speed bonus takes the ceiling to 2.0 per question, and
  // "12.4 / 20" would read as though 40 were unreachable rather than 20 being
  // the wrong number entirely — so the total stands alone.
  const suffix = roundSize ? `over ${roundSize} song${roundSize === 1 ? '' : 's'}` : '';

  const podium = splitPodium(ranked);
  const { winners, rest, kana } = podium;
  // Lives has no ties at the top — survival orders everyone — and the one left
  // standing is what the mode is about, so the stamp says so.
  const stamp = lastManStanding && ranked.length > 1 ? 'Survivor' : podium.stamp;

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
        <StartBar width="md" status={`${played.length} song${played.length === 1 ? '' : 's'} played`} ready>
          <Button variant="primary" size="lg" onClick={onPlayAgain}>Play again</Button>
        </StartBar>
      )}
    >
      <Standings
        ranked={rest}
        departedIds={departedIds}
        score={(p) => formatPoints(p.total)}
        extra={lastManStanding ? livesBadge : undefined}
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
