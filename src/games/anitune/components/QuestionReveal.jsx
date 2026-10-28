import { isRace, scoreAnswer, answerElapsedMs } from '../rules';
import { themeAndYear } from '../utils/labels';
import { formatPoints, formatSeconds } from '../../../shared/utils/deadline';
import { Avatar, Badge, Button, Card, CardRow, Icon } from '../../../shared/ui';
import Lives from './Lives';
import { useSoundCue } from '../../../shared/hooks/useSoundCue';
import ResultImpact from '../../../shared/components/ResultImpact';
import PlayerFace from '../../../shared/components/PlayerFace';
import { useStagger } from '../../../shared/hooks/useStagger';
import { useCountUp } from '../../../shared/hooks/useCountUp';

// A row's points ticking up as the row lands (useCountUp; final from the start
// for a reader, since nothing compares a per-song badge across devices).
function PointsBadge({ points, delayMs, skip }) {
  const shown = useCountUp(points, { delayMs, skip });
  return <Badge tone="lime" className="flex-shrink-0">+{formatPoints(shown)}</Badge>;
}

// The answer card plus the round leaderboard for this question.
//
// Every number here comes out of rules.js — scoreAnswer is the same function the
// round used to award the points, not a re-derivation of it. That is the house
// rule anirank/rules.js states: what a player reads and what they were awarded
// have to come from the same comparison, because a reveal that computes its own
// version of the score is a reveal that can disagree with the scoreboard.

// "Caden and Alex" / "Caden, Alex and Sam" — a list a person would say out loud.
function nameList(names) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export default function QuestionReveal({
  question, mode, players, answers, windowMs = null, lives = null, onNext, nextLabel,
  // Online only: whose phone this is, so the sound is that player's own result.
  myId = null,
  // The final song's double (rules.songMultiplier): the scores already carry
  // it, so the rows must show the points that were actually awarded.
  multiplier = 1,
}) {
  const race = isRace(mode);
  const scorers = players.filter((p) => answers[p.id]?.correct);
  const winner = race ? scorers[0] : null;

  // The reveal's sound, once as it appears. Online it is MY result — right,
  // wrong, or (a race I never buzzed in) just the reveal; on the one local
  // device it is the table's: anybody right is a cheer, nobody is a miss.
  const mine = myId ? answers[myId] : undefined;
  const cue = myId
    ? (mine?.correct ? 'correct' : mine ? 'wrong' : 'reveal')
    : (scorers.length ? 'correct' : 'wrong');
  // Right or wrong lands as the impact frame (which plays its own sound); the
  // plain reveal — a race I never buzzed in — is a sound only.
  const impact = cue === 'reveal' ? null : cue;
  useSoundCue(impact ? null : cue, question.id);

  // Fastest correct answer, so every other row can show how far behind it was.
  // Only correct answers race each other — being quickly wrong is not a result.
  const fastest = players.reduce((best, p) => {
    const answer = answers[p.id];
    if (!answer?.correct) return best;
    const ms = answerElapsedMs(answer);
    if (ms == null) return best;
    return best == null || ms < best ? ms : best;
  }, null);

  // Race only ever shows the players who actually buzzed; everyone else never
  // had a turn and a row of "passed" would misdescribe that. Sorted by answer
  // time so the leaderboard reads as a race.
  const rows = players
    .filter((p) => !race || answers[p.id])
    .map((p) => ({
      player: p,
      answer: answers[p.id],
      ms: answerElapsedMs(answers[p.id]),
      points: scoreAnswer(answers[p.id], windowMs) * multiplier,
    }))
    .sort((a, b) => {
      if (a.ms == null) return b.ms == null ? 0 : 1;
      if (b.ms == null) return -1;
      return a.ms - b.ms;
    });

  // Whose lists this show came from. Only worth saying when it is *some* of the
  // table — under "shared songs only" it is always everybody, and a line that
  // never varies is noise. It is the one fact here that is about the players
  // rather than the song, which is why it earns a place at all.
  const owners = question.owners ?? [];
  const ownerNames = players.filter((p) => owners.includes(p.id)).map((p) => p.name);
  const showOwners = ownerNames.length > 0 && ownerNames.length < players.length;

  // Staged: the answer card is unveiled, then the rows land fastest first with
  // their points ticking up. "Next" is live from the first frame (useStagger).
  const stagger = useStagger({ count: rows.length, stepMs: 160, leadMs: 520, key: question.id });
  const on = !stagger.skipped;

  return (
    <div className="mt-6 text-center" {...stagger.rootProps}>
      <ResultImpact result={impact} eventKey={question.id} />
      <div className={`mb-3 text-5xl ${scorers.length ? 'text-pop-pink' : 'text-pop-red'}`}>
        <Icon name={scorers.length ? 'burst' : 'cross'} />
      </div>
      <p
        className={`mb-4 font-display text-2xl font-extrabold ${
          scorers.length ? 'text-pop-lime' : 'text-fg-body'
        }`}
      >
        {multiplier > 1 && scorers.length > 0 && <span className="mr-2 text-pop-amber">×{multiplier}</span>}
        {race
          ? (winner ? `${winner.name} got it!` : 'Nobody got it')
          : (scorers.length
            ? `${scorers.length} of ${players.length} got it`
            : 'Nobody got it')}
      </p>

      <Card padding="lg" className={`mb-5 ${on ? 'curtain-in' : ''}`}>
        <div className="flex items-start gap-4 text-left">
          {question.coverImageUrl && (
            <Avatar src={question.coverImageUrl} alt="" size="lg" className="flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-extrabold text-fg-strong">{question.animeTitle}</p>
            {question.displayTitle !== question.animeTitle && (
              <p className="text-sm text-fg-subtle">{question.displayTitle}</p>
            )}
            <p className="mt-2 text-fg-strong">{themeAndYear(question)}</p>
            {question.songTitle && (
              <p className="mt-1 font-display font-extrabold text-pop-blue">
                {question.songTitle}
              </p>
            )}
            {/* The performer belongs here: "oh, THAT'S who sings this" is half
                the payoff of a music quiz, and it is what AMQ shows too.
                It was briefly moved to the end-of-round recap over a spoiler
                worry that turned out to be unfounded, and the reason is worth
                recording so nobody re-derives it. A voice actor singing an ED is
                often credited under their *character's* name — but AnimeThemes
                keeps that in the artist-song pivot's `as` field, and
                questionPool's artistNames reads `a.name`. So this line says
                "Kana Hanazawa", never "Nadeko Sengoku": no character is ever
                named. (`as` is the field that would spoil. Leave it alone, or
                gate it if it is ever wanted.) */}
            {question.artists?.length > 0 && (
              <p className="text-sm text-fg-helper">{question.artists.join(', ')}</p>
            )}
          </div>
        </div>

        {showOwners && (
          <p className="mt-4 border-t-2 border-line pt-3 text-left text-sm text-fg-subtle">
            From {nameList(ownerNames)}&apos;s list{ownerNames.length > 1 ? 's' : ''}
          </p>
        )}
      </Card>

      {/* Everyone's answer, so a near-miss is visible rather than just "wrong" —
          now with how long it took and what it was worth, which is the whole
          reason answers are timestamped.
          Omitted entirely when empty: a race nobody buzzed on has no rows, and
          an empty Card renders as a bare box that reads as something failing to
          load rather than as nothing having happened. */}
      {rows.length > 0 && (
      <Card padding="sm" className="mb-5">
        {rows.map(({ player: p, answer, ms, points }, i) => (
          <CardRow key={p.id} className={`text-left ${on ? 'reveal-row' : ''}`} style={on ? stagger.style(i) : undefined}>
            <span className={`w-6 flex-shrink-0 text-lg ${answer?.correct ? 'text-pop-lime' : 'text-pop-red'}`}>
              <Icon name={answer?.correct ? 'check' : 'cross'} label={answer?.correct ? 'Right' : 'Wrong'} />
            </span>
            <PlayerFace player={p} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display font-extrabold text-fg-strong">
                {p.name}
                {lives && (
                  <span className="ml-2 align-middle text-sm text-pop-red">
                    <Lives count={lives[p.id]} />
                  </span>
                )}
              </span>
              <span className="block truncate text-sm text-fg-subtle">
                {answer?.aloud
                  ? (answer.correct ? 'said it' : 'missed it')
                  : answer?.text?.trim() ? `“${answer.text}”` : 'passed'}
              </span>
            </span>
            {ms != null && (
              <span className="flex-shrink-0 text-right text-sm tabular-nums text-fg-subtle">
                {formatSeconds(ms)}
                {answer?.correct && fastest != null && ms > fastest && (
                  <span className="block text-xs text-fg-disabled">+{formatSeconds(ms - fastest)}</span>
                )}
              </span>
            )}
            {points > 0 && <PointsBadge points={points} delayMs={stagger.delay(i)} skip={stagger.skipped} />}
          </CardRow>
        ))}
      </Card>
      )}

      <Button variant="secondary" size="lg" fullWidth onClick={onNext}>
        {nextLabel}
      </Button>
    </div>
  );
}
