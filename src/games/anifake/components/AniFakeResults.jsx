import { stealIsCorrect, voteOutcome } from '../rules';
import { getMode } from '../modes';
import { computeRankedPlayers } from '../../../shared/utils/ranking';
import ResultsLayout, { Splash, Standings } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Avatar, Badge, Banner, Button, Card, Icon } from '../../../shared/ui';
import { KANA } from '../../../shared/ui/kanaText';
import descriptor from '../index';

/**
 * One ballot, grouped by who was ACCUSED rather than by who voted.
 *
 * The old list was one row per voter reading "Ann → Cy", which left the table
 * adding the counts up in their heads to find out what actually happened. The
 * outcome is what this card exists to say, so the count leads and the voters are
 * the detail underneath. Safe to show in full here and nowhere earlier: the
 * vote has closed, which is the whole reason VoteScreen shows none of it.
 */
function Ballot({ votes = {}, counts = {}, caught, fakeId, players, departedIds = [] }) {
  const cast = Object.keys(votes).length;
  const playerOf = (id) => players.find((p) => p.id === id) ?? null;
  const nameOf = (id) => playerOf(id)?.name ?? id;
  // Sorted by count, then by seat so an equal pair does not swap order between
  // the two ballots of the same round.
  const accused = Object.keys(counts).sort(
    (a, b) => counts[b] - counts[a] || (playerOf(a)?.seat ?? 99) - (playerOf(b)?.seat ?? 99)
  );
  const silent = players.filter((p) => !votes[p.id]);

  if (!cast) return <p className="text-fg-subtle">Nobody voted.</p>;

  return (
    <div className="flex flex-col gap-4">
      {accused.map((id) => {
        const n = counts[id];
        const isCaught = id === caught;
        return (
          <div key={id} className={departedIds.includes(id) ? 'opacity-40' : ''}>
            <div className="flex items-center gap-2">
              <span className="w-6 flex-shrink-0 text-center font-display text-sm
                font-extrabold text-fg-subtle">
                {playerOf(id)?.seat ?? '–'}
              </span>
              <span className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-fg-strong">
                {id === fakeId && <><Icon name="mask" label="The fake" className="text-pop-red" />{' '}</>}
                {nameOf(id)}
              </span>
              <Badge tone={isCaught ? 'red' : 'neutral'}>
                {n} {n === 1 ? 'vote' : 'votes'}
              </Badge>
            </div>
            {/* The bar is the tally made readable at a glance — red only for the
                one the ballot landed on, so a tie shows two neutral bars of
                equal length and says "nobody" without needing a caption. */}
            <div className="mt-1.5 ml-8 h-2 overflow-hidden rounded-pop-sm bg-wash">
              <div
                className={`h-full rounded-pop-sm ${isCaught ? 'bg-pop-red' : 'bg-wash-mid'}`}
                style={{ width: `${(n / cast) * 100}%` }}
              />
            </div>
            <p className="mt-1 ml-8 truncate text-sm text-fg-subtle">
              {Object.entries(votes)
                .filter(([, target]) => target === id)
                .map(([voter]) => nameOf(voter))
                .join(', ')}
            </p>
          </div>
        );
      })}
      {silent.length > 0 && (
        <p className="text-sm text-fg-subtle">
          Didn&apos;t vote: {silent.map((p) => p.name).join(', ')}
        </p>
      )}
    </div>
  );
}

// The reveal. Everything here is derived from the published cards
// (rules.deriveTruth) rather than from an answer key anyone was trusted to
// hold — see the note on rules.publishCard for why. `secret` and `fakeCard` are
// both published cards, which is why they carry names and portraits: with no
// board to look a character up in, the published set is the only record of who
// they were.
//
// `fakeCard` is the half of the round that used to end unsaid — what the fake
// was actually holding. In decoy mode that is the character they were handed
// instead of the secret and never knew was wrong, which is the whole payoff of
// the mode; in blind mode it is the one word they were bluffing off.
//
// `fakeId` null means the room genuinely could not reconstruct the round: too
// many players left before publishing. That is shown as an unscored round
// rather than by inventing a culprit.
export default function AniFakeResults({
  players = [],
  game,
  fakeId,
  secret = null,
  fakeCard = null,
  roundScores = {},
  totalScores = {},
  departedIds = [],
  onPlayAgain,
  playAgainLabel = 'New round',
  // onBack is local-only: online "again" returns to the lobby, and there is no
  // local setup to go back to. Screen omits the row when it is undefined.
  onBack,
}) {
  const mode = getMode(game?.mode);
  // Across both ballots. `counts` is whichever one decided; `firstCounts` is the
  // opening vote, kept so a runoff round can show what forced it.
  const { counts, firstCounts, caught, isRunoff, tiedOut } = voteOutcome(game);
  const anyVotes = Object.keys(game?.votes ?? {}).length > 0;
  const scored = Boolean(fakeId);
  const fake = players.find((p) => p.id === fakeId) ?? null;
  const ranked = computeRankedPlayers(players, totalScores);
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? id;

  const stolenName = game?.steal?.name ?? null;
  const stoleIt = stealIsCorrect(game?.steal, secret);

  // Decoy mode's second card. Only worth showing once there is a fake to pin it
  // on — an unscored round has nobody to attribute it to, and a card floating
  // free of a name reads as a second secret.
  const showDecoy = scored && mode.id === 'decoy';

  const wasCaught = caught === fakeId;

  // The round's verdict, said once — in the splash for a scored round, and as
  // the status line beside the way on.
  const verdict = wasCaught
    ? (isRunoff ? 'Caught — in the runoff.' : 'Caught.')
    : caught
      ? `The table accused ${nameOf(caught)}${isRunoff ? ' in the runoff' : ''} instead — the fake walks.`
      : tiedOut
        // The floor the runoff stops at, said plainly so it reads as the rule
        // rather than as the game losing the vote.
        ? 'It tied again in the runoff, so nobody was accused — the fake walks.'
        : anyVotes
          ? 'The vote tied, so nobody was accused — the fake walks.'
          : 'Nobody voted, so nobody was accused — the fake walks.';

  return (
    <ResultsLayout
      game={descriptor}
      title="Reveal"
      subtitle={mode.label}
      players={players}
      onBack={onBack}
      backLabel="← Back to setup"
      // The splash is the fake, not the leader: who it was is what the whole
      // round was asking, and the standings are further down for the rest.
      splash={scored && (
        <Splash
          players={fake ? [fake] : []}
          stamp={wasCaught ? 'Caught' : 'Got away'}
          kana={KANA.fake}
          kicker="The fake was"
          title={fake?.name ?? 'Someone'}
        >
          <p>{verdict}</p>
          {/* A correct guess is named properly rather than echoed back: the
              steal stores what they typed, and "they named makima correctly"
              reads like the game does not know who she is. A wrong guess IS
              quoted, because there the typing is the point. */}
          {stolenName && (
            <p className="mt-1">
              {stoleIt
                ? `…but they named ${secret?.name ?? stolenName} correctly and took a point back.`
                : `Their guess of “${stolenName}” was wrong.`}
            </p>
          )}
          {/* Blind mode's whole hand, finally said out loud. Absent rather
              than blank when the character carried no genres — utils/pool.js's
              hintFor deals no word at all there, and SecretCard has already
              told the fake they were going in blind. */}
          {fakeCard?.hint && (
            <p className="mt-2 text-fg-helper">
              They were bluffing off one word:{' '}
              <span className="font-display font-extrabold text-fg-strong">{fakeCard.hint}</span>
            </p>
          )}
        </Splash>
      )}
      bar={(
        <StartBar width="md" status={scored ? (wasCaught ? 'The fake was caught.' : 'The fake got away.') : 'This round doesn’t score.'} ready>
          <Button variant="primary" size="lg" onClick={onPlayAgain}>{playAgainLabel}</Button>
        </StartBar>
      )}
    >
      {!scored && (
        <Banner tone="warning" className="mb-6">
          Too many players left before the reveal to work out who the fake was —
          this round doesn&apos;t score.
        </Banner>
      )}

      <Card title="The secret" padding="lg" className="mb-6">
        {secret ? (
          <div className="flex items-center gap-4">
            <Avatar src={secret.imageUrl} alt="" size="lg" />
            <div className="min-w-0">
              <p className="truncate font-display text-2xl font-extrabold text-pop-lime">
                {secret.name}
              </p>
              <p className="truncate text-fg-helper">{secret.series}</p>
            </div>
          </div>
        ) : (
          <p className="text-fg-subtle">
            Nobody published enough cards to say who it was.
          </p>
        )}
      </Card>

      {/* The pair is the point: the two cards sit together, red against the
          secret's lime, so the table can see at a glance how close the fake's
          character was to the one everyone else held. */}
      {showDecoy && (
        <Card title="The decoy" padding="lg" className="mb-6">
          {fakeCard?.name ? (
            <>
              <div className="flex items-center gap-4">
                <Avatar src={fakeCard.imageUrl} alt="" size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-display text-2xl font-extrabold text-pop-red">
                    {fakeCard.name}
                  </p>
                  <p className="truncate text-fg-helper">{fakeCard.series}</p>
                </div>
              </div>
              <p className="mt-4 text-fg-body">
                {fake?.name ?? 'The fake'} was holding this one — and never knew.
              </p>
            </>
          ) : (
            // Reachable two ways: the fake left before publishing (so they were
            // named by elimination, with no card to show), or a decoy deal ran
            // on a pool of one. Say so rather than render an empty frame.
            <p className="text-fg-subtle">
              {fake?.name ?? 'The fake'} never turned their card over.
            </p>
          )}
        </Card>
      )}

      {/* Both ballots, in the order they happened, so the round reads as the
          story it was rather than as a single number nobody can source. */}
      <Card title={isRunoff ? 'The opening vote' : 'The vote'} padding="lg" className="mb-6">
        <Ballot
          votes={game?.votes}
          counts={firstCounts}
          // Nobody was caught on this ballot if it went to a runoff — leaving
          // `caught` in would paint the runoff's loser red on the wrong chart.
          caught={isRunoff ? null : caught}
          fakeId={fakeId}
          players={players}
          departedIds={departedIds}
        />
      </Card>

      {isRunoff && (
        <Card title="The runoff" padding="lg" className="mb-6">
          <Ballot
            votes={game?.runoff?.votes}
            counts={counts}
            caught={caught}
            fakeId={fakeId}
            players={players}
            departedIds={departedIds}
          />
        </Card>
      )}

      <Standings
        ranked={ranked}
        departedIds={departedIds}
        scoreClass="text-pop-teal"
        extra={(p) => (roundScores[p.id] ?? 0) > 0 && <Badge tone="lime">+{roundScores[p.id]}</Badge>}
      />
    </ResultsLayout>
  );
}
