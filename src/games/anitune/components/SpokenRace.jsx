import { useState } from 'react';
import { themeAndYear } from '../utils/labels';
import { Button, Card, GhostButton } from '../../../shared/ui';
import PlayerFace from '../../../shared/components/PlayerFace';

/**
 * Race on one device, shouted (`localRace: 'shout'`): nobody grabs the phone.
 * The table shouts the answer, someone taps "Someone got it", picks who said it
 * first (rules.claimSpoken — the clip pauses and their speed is measured to
 * that tap), and then the answer comes up for the table to check together
 * (rules.awardSpoken). A wrong call ends the song: the answer is on the screen.
 *
 * Words the playtest bot presses: "Someone got it", "<name> said it first",
 * "Right", "Wrong", and the shared "Nobody got it — reveal the answer".
 */
export default function SpokenRace({
  players, lockedOut = [], buzzedBy, question, clipDone, onClaim, onAward, onGiveUp,
}) {
  const [picking, setPicking] = useState(false);

  if (buzzedBy) {
    const who = players.find((p) => p.id === buzzedBy);
    return (
      <Card padding="lg" className="mt-6 text-center">
        <p className="mb-1 text-sm font-bold uppercase tracking-[0.15em] text-fg-helper">
          {who?.name} said it first — was it…
        </p>
        <p className="font-display text-3xl font-bold uppercase tracking-wide text-fg-strong [overflow-wrap:anywhere]">
          {question?.animeTitle}
        </p>
        <p className="mt-1 text-sm text-fg-helper">{themeAndYear(question)}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="danger" size="lg" sound="no" onClick={() => onAward(false)}>Wrong</Button>
          <Button variant="success" size="lg" sound="yes" onClick={() => onAward(true)}>Right</Button>
        </div>
      </Card>
    );
  }

  const stillIn = players.filter((p) => !lockedOut.includes(p.id));

  if (picking) {
    return (
      <div className="mt-6">
        <p className="mb-4 text-center font-display text-xl font-extrabold text-fg-strong">Who said it first?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {stillIn.map((p) => (
            <Button
              key={p.id}
              variant="neutral"
              size="lg"
              fullWidth
              sound="buzz"
              aria-label={`${p.name} said it first`}
              onClick={() => { setPicking(false); onClaim(p.id); }}
              className="justify-start gap-3"
            >
              <PlayerFace player={p} />
              <span className="min-w-0 flex-1 truncate text-left">{p.name}</span>
            </Button>
          ))}
        </div>
        <div className="mt-4 text-center">
          <GhostButton onClick={() => setPicking(false)}>← Keep listening</GhostButton>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="mb-4 text-center text-base text-fg-body">Shout it out — first to name the show takes the point.</p>
      <Button variant="primary" size="xl" fullWidth sound="buzz" onClick={() => setPicking(true)}>
        Someone got it
      </Button>
      {clipDone && (
        <div className="mt-4 text-center">
          <GhostButton onClick={onGiveUp}>Nobody got it — reveal the answer</GhostButton>
        </div>
      )}
    </div>
  );
}
