import { useState } from 'react';
import { Badge, Button, Card, GhostButton, Icon, Input, Mark } from '../../../shared/ui';
import { MAX_PROPOSAL_LEN, WRONG_DECLARATION_COST, verdictsOf } from '../rules';
import TrailBoard from './TrailBoard';
import SeatStrip from './SeatStrip';
import CategoryPeek from './CategoryPeek';
import RoundHeader from '../../../shared/components/RoundHeader';
import SpeechBubble from '../../../shared/components/SpeechBubble';
import PlayerFace from '../../../shared/components/PlayerFace';

/**
 * One go, on whatever device is looking at it.
 *
 * ONE COMPONENT FOR LOCAL AND ONLINE, because the go genuinely is the same go:
 * somebody names one thing, the judge answers, the trail is public, and the
 * seat's clause is hidden from the seat. What differs is only which controls
 * this particular device may use, so those arrive as props rather than as a
 * second copy of the screen.
 *
 *   canName    this device is the hot seat
 *   rulers     the players this device answers FOR, in the order they will be
 *              asked. Online that is [me] when I owe an answer and [] otherwise;
 *              locally it is everyone who still owes one, because one device is
 *              all of them. ONE IS SHOWN AT A TIME — see the judging block.
 *   peek       the clause is on a device its owner can see (local play), so
 *              it sits behind CategoryPeek instead of plainly
 *
 * `category` is the hidden value — the hot seat's clause, null on their own
 * device. Online that is a Firebase rule rather than a prop decision; the value
 * never reaches the device at all.
 *
 * THE SCREEN IS A HEADER, ONE CARD, AND THE TRAIL — down from six panels of
 * identical weight, which is what it was when a turn was an uninterrupted block
 * of ten names and every state of it had to be on screen at once. `judging` and
 * `naming` are mutually exclusive by construction, so exactly one of them is the
 * thing being asked of you and it gets the only card. Everything that was a
 * panel holding one sentence is now a sentence.
 */
export default function TurnScreen({
  seatName, roundNumber, totalRounds, noun,
  phase, pending, trails = {}, order = [], cap, left, lastPlayed = null,
  category = null, peek = false,
  canName = false, rulers = [], pendingJudges = [],
  myPlayerId = null, nameFor, usedFor,
  onPropose, onDeclare, onRule, onPass, onAbandon = null,
}) {
  const [draft, setDraft] = useState('');
  const [declaring, setDeclaring] = useState(false);

  // Both resets happen DURING RENDER rather than in an effect — React's
  // documented way to adjust state when a prop changes, and the pattern
  // wavelength's OnlineGame uses to clear a stale dial draft. An effect would
  // repaint once with the old text still in the box.
  //
  // Cleared when the ANSWER LANDS rather than in the submit handler, which is
  // the important half: a name the rules rejected (a double tap, a write that
  // lost a race) never reaches 'judging', so the text stays where the player
  // typed it instead of being silently eaten by a submit that did nothing.
  const [lastPhase, setLastPhase] = useState(phase);
  if (lastPhase !== phase) {
    setLastPhase(phase);
    if (phase === 'judging') setDraft('');
  }

  // A new go opens on the naming box, never on a declaration box the previous
  // player left open — and never carrying their half-typed guess into it. Keyed on the seat, which now changes after
  // every single name rather than once a turn, so this fires far more often and
  // matters far more: on a shared device the box is handed straight over.
  const turnKey = `${roundNumber} ${seatName}`;
  const [lastTurn, setLastTurn] = useState(turnKey);
  if (lastTurn !== turnKey) {
    setLastTurn(turnKey);
    setDeclaring(false);
    setDraft('');
  }

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    if (!declaring) { onPropose(text); return; }
    onDeclare(text);
  };

  // "Your go" only where there is a "you". Online this device is one player, so
  // `canName` means the seat is me; locally it is always true because the device
  // is whoever is holding it — and with the seat moving after every name, a
  // heading that says "Your go" to a table of four names nobody. `myPlayerId` is
  // null exactly in that case, which makes it the test.
  const iAmSeat = canName && !!myPlayerId;
  const waitingOnJudge = phase === 'judging';
  // Whoever is next to answer on this device. ONE AT A TIME rather than a pair
  // of buttons per player: locally `rulers` is the whole table, and at six that
  // was twelve full-size blocks and six nested panels in one card. They answer
  // in turn anyway — the device is passed or leaned over — so the screen asks
  // one person and says who is behind them.
  const ruler = rulers[0] ?? null;
  const iRule = rulers.length > 0;
  const laterNames = pendingJudges
    .filter((p) => p.id !== ruler?.id)
    .map((p) => p.name)
    .join(', ');

  const instruction = () => {
    if (canName) return `Name one ${noun}. The judge will tell you yes or no.`;
    if (iRule) return `Answer ${seatName} honestly.`;
    if (laterNames || ruler) return 'Watch, and say nothing.';
    return `${seatName} is naming. Watch, and say nothing.`;
  };

  return (
    <>
      {/* The hint line is what this device is FOR, said once and as a
          sentence. Without it a judge's screen and a spectator's are identical
          apart from two buttons, and the person who has to answer does not know
          it is them. */}
      <RoundHeader
        title={iAmSeat ? 'Your go' : `${seatName}'s go`}
        tag={`Round ${roundNumber}/${totalRounds}`}
        hint={instruction()}
      >
        <Badge tone={left > 0 ? 'lime' : 'red'} className="text-sm">
          {left} name{left === 1 ? '' : 's'} left
        </Badge>
      </RoundHeader>

      <SeatStrip order={order} myPlayerId={myPlayerId} className="mb-5" />

      {/* WHAT JUST HAPPENED. It earns its place because a missed declaration no
          longer stops the round to announce itself — the seat simply moves on —
          so without this the only trace of somebody guessing and being told no
          is a row inside a collapsed trail. Suppressed during judging, where the
          card below is the news. */}
      {!waitingOnJudge && lastPlayed && (
        <LastPlayed entry={lastPlayed} nameFor={nameFor} myPlayerId={myPlayerId} />
      )}

      {/* The seat's clause, absent entirely on their own device. A strip
          rather than a panel — it is a thing to consult, not the thing being
          asked. */}
      {category && (peek
        ? <CategoryPeek label={category.label} seatName={seatName} bare className="mb-5" />
        : (
          <div className="mb-5 rounded-pop-sm bg-wash-soft px-3 py-2">
            <p className="font-display text-xs font-extrabold uppercase tracking-widest text-fg-helper">
              {seatName}&apos;s category
            </p>
            <p className="mt-0.5 font-display text-xl font-extrabold text-fg-strong">
              {category.label}
            </p>
          </div>
        ))}

      {/* THE ONE CARD. Judging and naming cannot both be true, so whichever one
          is asking gets the whole surface. */}
      {waitingOnJudge && pending && (
        <Card padding="md" className="mb-5 text-center">
          <p className="font-display text-sm font-extrabold uppercase tracking-widest text-fg-helper">
            {pending.kind === 'declaration' ? 'Their guess at the category' : `Is this ${noun} in it?`}
          </p>
          <SpeechBubble who={seatName} verb={pending.kind === 'declaration' ? 'guesses' : 'names'} className="my-3">
            {pending.text}
          </SpeechBubble>

          {ruler && (
            <>
              {/* Named whenever the device is shared, so the person holding it
                  knows the answer is theirs to give. */}
              {!myPlayerId && (
                <p className="mb-2 font-display text-base font-extrabold text-pop-purple">
                  {ruler.name}, your answer
                </p>
              )}
              <div className="flex gap-3">
                <Button variant="success" size="lg" sound="yes" fullWidth onClick={() => onRule(ruler.id, true)}>
                  <Icon name="check" /> Yes
                </Button>
                <Button variant="danger" size="lg" sound="no" fullWidth onClick={() => onRule(ruler.id, false)}>
                  <Icon name="cross" /> No
                </Button>
              </div>
            </>
          )}

          {/* Everyone can see how far off a full answer is, which is what stops
              a slow table looking like a broken one. */}
          {laterNames && (
            <p className="mt-3 text-sm text-fg-subtle">
              {ruler ? 'Then' : 'Waiting on'} {laterNames}.
            </p>
          )}
          {!ruler && !laterNames && <p className="text-base text-fg-subtle">Waiting…</p>}
        </Card>
      )}

      {canName && !waitingOnJudge && (
        <Card padding="md" className="mb-5">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            maxLength={MAX_PROPOSAL_LEN}
            autoFocus
            aria-label={declaring ? 'Your guess at the category' : `A ${noun} to try`}
            placeholder={declaring ? 'e.g. wears glasses' : `Name a ${noun}…`}
            className="mb-3"
          />
          <Button
            variant={declaring ? 'success' : 'primary'}
            size="lg"
            fullWidth
            disabled={declaring ? !draft.trim() : (!draft.trim() || left <= 0)}
            onClick={submit}
          >
            {declaring ? 'That is my category' : 'Ask — then pass'}
          </Button>

          {/* DECLARING IS A REAL BUTTON, NOT A GHOST LINK. It is the win
              condition of the game and it used to sit at the same dim weight as
              "give up", on the same row, which said the two were alternatives of
              equal standing. Always reachable, including with no names spent —
              scoreTurn caps what a blind guess pays rather than forbidding it —
              and it is the ONLY thing still reachable once the names run out. */}
          <Button
            variant={declaring ? 'neutral' : 'secondary'}
            size="md"
            fullWidth
            className="mt-3"
            onClick={() => { setDeclaring((v) => !v); setDraft(''); }}
          >
            {declaring ? `← Back to naming ${noun}s` : 'I know the category'}
          </Button>

          {!declaring && (
            <p className="mt-3 text-sm text-fg-subtle">
              {left <= 0
                ? 'Out of names — say what you think it is, or sit out the round.'
                : `A wrong guess costs ${WRONG_DECLARATION_COST} names, not your round.`}
            </p>
          )}
        </Card>
      )}

      <TrailBoard
        order={order}
        trails={trails}
        // Locally there is no "me" — the device is whoever is up — so the open
        // block follows the seat. Online it follows this device's player, whose
        // own evidence is the thing they came back to read.
        open={myPlayerId ?? order.find((r) => r.isSeat)?.playerId ?? null}
        myPlayerId={myPlayerId}
        cap={cap}
        nameFor={nameFor}
        usedFor={usedFor}
        className="mb-5"
      />

      {/* The quiet row. Everything here ends something, and none of it is the
          thing the screen is asking for. */}
      {(canName || onAbandon) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {canName
            ? <GhostButton onClick={onPass}>Give up — sit out the round</GhostButton>
            : <span />}
          {/* The wedge presence cannot see: a hot seat who is connected and
              simply not naming anything. It lives here rather than under the
              screen so it inherits the width instead of re-declaring it, and so
              it reads as what it is — an escape hatch, beside the other one.
              Solid crimson, not faded: at /70 it blended to 4.17:1 on paper,
              under the 4.5:1 body text needs (the playtest's axe pass). */}
          {onAbandon && (
            <GhostButton className="text-pop-red hover:text-pop-red" onClick={onAbandon}>
              End {seatName}&apos;s round
            </GhostButton>
          )}
        </div>
      )}
    </>
  );
}

/**
 * The last thing the table watched, in one line.
 *
 * Reads the same `verdictsOf` the trail does, so the three stored verdict shapes
 * are flattened in exactly one place. A miss says what it COST, because that is
 * the half a player cannot see anywhere else: the name count simply jumps.
 */
function LastPlayed({ entry, nameFor, myPlayerId }) {
  const who = entry.playerId === myPlayerId ? 'You' : (nameFor?.(entry.playerId) ?? 'Someone');
  const verdicts = verdictsOf(entry);
  const missed = entry.kind === 'declaration';

  return (
    <div
      className={`mb-5 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-pop-sm px-3 py-2
        ${missed ? 'bg-pop-red/10' : 'bg-wash-soft'}`}
    >
      <span className="flex items-center gap-2 text-base text-fg-body">
        <PlayerFace player={{ id: entry.playerId, name: who }} size="sm" />
        {who} {missed ? 'guessed' : 'named'}
      </span>
      <span className="min-w-0 font-display text-base font-extrabold text-fg-strong">
        {entry.text}
      </span>
      <span className="flex flex-wrap gap-1.5">
        {verdicts.map(({ judgeId, verdict }) => (
          <Mark
            key={judgeId ?? 'only'}
            yes={verdict}
            label={`${verdicts.length > 1 ? `${nameFor?.(judgeId) ?? '?'} ` : ''}${verdict ? 'yes' : 'no'}`}
          />
        ))}
      </span>
      {missed && (
        <span className="text-sm text-pop-red">
          −{WRONG_DECLARATION_COST} names
        </span>
      )}
    </div>
  );
}
