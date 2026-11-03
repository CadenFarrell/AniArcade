import { Badge, Button, Card } from '../../../shared/ui';
import TrailBoard from './TrailBoard';
import { useSoundCue } from '../../../shared/hooks/useSoundCue';
import ResultImpact from '../../../shared/components/ResultImpact';

/**
 * One player's round is over, and what their clause was.
 *
 * IT NOW MEANS SOMETHING NARROWER THAN IT USED TO. While a turn was an
 * uninterrupted block of names this screen appeared once per player per round,
 * on every rotation. The seat moves after every name now, so it appears only
 * when somebody has actually FINISHED — solved it, given up, or spent their cap
 * — and a wrong guess does not bring it up at all. That is what makes it worth
 * being a full stop: everything smaller is a line on the turn screen.
 *
 * THE HOT SEAT IS THE AUDIENCE, and they are the only person at the table who
 * has not already seen the answer. Everyone else watched it all round; this is
 * the moment the one player it was hidden from finds out. So the clause is the
 * largest thing here, above the score.
 *
 * `category` can legitimately be null for a beat: some other device has to
 * publish it first (rules.attachCategory, since the seat cannot read its own),
 * and saying so is better than an empty space that reads as the answer having
 * been lost.
 */
export default function TurnEnd({
  seatName, isYou = false, category, result, points,
  order = [], trails = {}, cap, seatId = null, myPlayerId = null,
  nameFor, usedFor, canAdvance, isLastSeat, onNext,
}) {
  const solved = result?.solved === true;

  // A finished turn's sound, once as it appears: a solve or a missed call. On
  // the one local device it is the table's; online (`myPlayerId` set) it is the
  // seat's own result on the seat's phone and the plain reveal on everyone
  // else's. A give-up made no call, so it has nothing to sound.
  const verdict = solved ? 'correct' : result?.guess ? 'wrong' : null;
  const online = myPlayerId != null;
  // The seat's own solve or miss lands as the impact frame (with its sound);
  // anyone else's is the plain reveal sting.
  const mineToShow = !online || isYou;
  const turnKey = seatId ?? 'seat';
  useSoundCue(!mineToShow && verdict ? 'reveal' : null, turnKey);

  const heading = isYou ? 'Your category was' : `${seatName}'s category was`;

  // The one line under the badges. Built here rather than as three conditional
  // paragraphs, which is what gave this card six text weights in a column.
  const footnote = () => {
    if (!result?.guess) return isYou ? 'No claim made.' : null;
    const said = `${solved ? 'Called it as' : 'Guessed'} “${result.guess}”`;
    if (!solved) return `${said}.`;
    return `${said}, ${result.used <= 1 ? 'straight out of nowhere' : `in ${result.used} names`}.`;
  };

  return (
    <>
      <ResultImpact result={mineToShow ? verdict : null} eventKey={turnKey} />
      <Card padding="lg" className="mb-6 text-center">
        <p className="font-display text-sm font-extrabold uppercase tracking-widest text-fg-helper">
          {/* Built here rather than by the caller, which is how "Your" and an
              appended "'s" produced "Your's" the first time round. */}
          {heading}
        </p>

        {category ? (
          <p className="mt-3 font-display text-3xl font-extrabold text-fg-strong">{category.label}</p>
        ) : (
          <p className="mt-3 font-display text-xl font-extrabold text-fg-subtle">
            Waiting for it to be revealed…
          </p>
        )}

        <div className="mt-4 flex items-center justify-center gap-3">
          <Badge tone={solved ? 'lime' : 'red'} className="text-base">
            {solved ? 'SOLVED' : 'MISSED'}
          </Badge>
          <Badge tone={points > 0 ? 'amber' : 'neutral'} className="text-base">
            +{points}
          </Badge>
        </div>

        {footnote() && <p className="mt-3 text-sm text-fg-subtle">{footnote()}</p>}
      </Card>

      {/* The whole board rather than one trail: by the time anybody finishes,
          every player has names on the table and the interesting comparison is
          across them. Theirs is the block that opens. */}
      <TrailBoard
        order={order}
        trails={trails}
        open={myPlayerId ?? seatId}
        myPlayerId={myPlayerId}
        cap={cap}
        nameFor={nameFor}
        usedFor={usedFor}
        className="mb-6"
      />

      {canAdvance ? (
        <Button variant="primary" size="lg" fullWidth onClick={onNext}>
          {isLastSeat ? 'Finish the round →' : 'Carry on →'}
        </Button>
      ) : (
        <p className="text-center text-base text-fg-subtle">
          Waiting for the round to carry on…
        </p>
      )}
    </>
  );
}
