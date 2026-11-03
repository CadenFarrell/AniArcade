import { useState } from 'react';
import { Badge, Button, Card, Icon } from '../../../shared/ui';
import CategoryPicker from './CategoryPicker';
import Handoff from '../../../shared/components/Handoff';

/**
 * THE TABLE PICKS A CATEGORY FOR ONE PLAYER, while that player looks away.
 *
 * AniGuess's character assignment applied to a rule — the same moment, the same
 * words ("Look away", "Pick a category for …", "… is looking away — Ready!"), so
 * a table that has played one already knows how the other goes. One player at a
 * time, in rules.pickingFor's order, because a pick is a conversation and six
 * of them at once is noise.
 *
 * ONE COMPONENT FOR LOCAL AND ONLINE, for the reason TurnScreen is one: the
 * moment genuinely is the same moment, and what differs is only which device is
 * looking.
 *
 *   local   the device stays put and the TARGET turns round: a Handoff with
 *           their face, then the picker, then the next target's Handoff. The
 *           last lock opens the round, so nothing is ever left on screen.
 *   online  every device but the target's shows the one shared proposal, which
 *           lives in the target's assignments/ slot (unreadable to them), and
 *           the pick locks once everyone else still here has approved it — the
 *           shape of AniGuess's OnlineCharacterAssignment. The target's own
 *           device only says that the table is picking.
 *
 * The local gate RESETS DURING RENDER when the target changes, which is React's
 * documented way to adjust state on a prop change and the idiom CategoryPeek
 * already uses. An effect would repaint once with the previous target's picker
 * still open — showing the next target the clause just chosen for the last.
 */
export default function PickPhase({
  target, suggestions, noun, takenLabels = [], picked = 0, total = 0,
  // local
  handover = false, onPick,
  // online
  online = false, iAmTarget = false, proposal = null, proposedBy = null,
  approvedNames = [], needed = 0, iApproved = false, onPropose, onApprove, busy = false,
}) {
  const name = target?.name ?? 'Someone';
  const [ready, setReady] = useState(!handover);
  const [lastTarget, setLastTarget] = useState(name);
  if (lastTarget !== name) {
    setLastTarget(name);
    setReady(!handover);
  }

  const header = (
    <div className="mb-6 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-display text-xs font-extrabold uppercase tracking-widest text-fg-helper">
          Picking categories
        </p>
        <h2 className="truncate font-display text-2xl font-extrabold text-fg-strong">
          {iAmTarget ? 'The table is picking yours' : `Pick a category for ${name}`}
        </h2>
      </div>
      {total > 0 && (
        <Badge tone="neutral" className="flex-shrink-0 text-base">
          {Math.min(picked + 1, total)} of {total}
        </Badge>
      )}
    </div>
  );

  // Online, on the target's own device. Nothing to do and nothing it may see —
  // the proposal is in a node this device is refused — so it says so by name
  // rather than showing a spinner that reads as the room having stalled.
  if (iAmTarget) {
    return (
      <>
        {header}
        <Card padding="lg" className="text-center">
          <p className="font-display text-xl font-extrabold text-fg-strong">
            Everyone else is choosing your category…
          </p>
          <p className="mt-3 text-base text-fg-helper">
            Don&apos;t look at anyone else&apos;s screen. Working it out is the whole game.
          </p>
        </Card>
      </>
    );
  }

  // Local, before each pick. The device stays put; the target turns round.
  if (!ready) {
    return (
      <>
        {header}
        <Handoff
          player={target ?? { id: name, name }}
          kicker="Look away"
          note={`Everyone else — get ready to pick a category for ${name}.`}
          cta={`${name} is looking away — Ready!`}
          onReady={() => setReady(true)}
        />
      </>
    );
  }

  const lead = (
    <p className="mb-5 text-base text-fg-body">
      Pick something {name} can work out — any {noun} anyone names has to be a clear yes or no.
    </p>
  );

  if (!online) {
    return (
      <>
        {header}
        {lead}
        <CategoryPicker
          suggestions={suggestions}
          noun={noun}
          title={`${name}'s category`}
          commitLabel="Lock in"
          takenLabels={takenLabels}
          onPick={onPick}
          busy={busy}
        />
      </>
    );
  }

  // Online, everybody but the target: the shared proposal, its approvals, and a
  // picker for a counter-proposal. Changing the proposal wipes every approval,
  // because what was approved is no longer what is on the table.
  return (
    <>
      {header}
      {proposal ? (
        <Card padding="lg" className="mb-6 text-center">
          <p className="mb-2 text-sm text-fg-helper">
            Proposed{proposedBy ? ` by ${proposedBy}` : ''}
          </p>
          <p className="mb-4 font-display text-2xl font-extrabold text-fg-strong">
            {proposal.label}
          </p>
          <div className="mb-4 flex items-center justify-between font-display font-bold text-fg-strong">
            <span>Approvals</span>
            <span>{approvedNames.length} / {needed}</span>
          </div>
          {approvedNames.length > 0 && (
            <p className="mb-4 text-left text-base text-fg-body">
              <Icon name="check" className="mr-2 text-pop-lime" />
              {approvedNames.join(', ')}
            </p>
          )}
          <Button
            variant={iApproved ? 'secondary' : 'success'}
            size="lg"
            fullWidth
            disabled={busy}
            onClick={() => onApprove(!iApproved)}
          >
            {iApproved ? 'Take back my approval' : 'Approve'}
          </Button>
        </Card>
      ) : lead}
      <CategoryPicker
        suggestions={suggestions}
        noun={noun}
        title={proposal ? 'Propose a different one' : `${name}'s category`}
        commitLabel="Propose"
        takenLabels={takenLabels}
        onPick={onPropose}
        busy={busy}
      />
    </>
  );
}
