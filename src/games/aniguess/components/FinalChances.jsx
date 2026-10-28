import { useState } from 'react';
import { Banner, Button, GhostButton } from '../../../shared/ui';

/**
 * The two ways a round can end for a player without a solve (rules.turnsLeft,
 * rules.giveUp), on the guesser's own turn screen.
 *
 * `turnsLeft` is null until final chances apply — everyone else here has
 * solved — and then counts down to the turn that locks them out. Said on the
 * screen they are playing, not discovered when the round suddenly ends.
 *
 * Giving up takes two presses: the first arms it and says what it costs, the
 * second does it. Not a browser confirm(), which blocks every other device's
 * updates on a phone and the playtest's whole run. "Give up" is a word the
 * bots refuse to press, so this is never the only way forward.
 */
export default function FinalChances({ turnsLeft = null, onGiveUp, name }) {
  const [armed, setArmed] = useState(false);
  return (
    <div className="mb-5">
      {turnsLeft != null && (
        <Banner tone="warning" className="mb-3">
          Final chances: {name ? `${name}, everyone` : 'Everyone'} else has solved.{' '}
          <strong>
            {turnsLeft} {turnsLeft === 1 ? 'turn' : 'turns'} left
          </strong>{' '}
          before the character is revealed.
        </Banner>
      )}
      {onGiveUp && (
        <div className="text-center">
          {armed ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-sm text-fg-helper">No points this round, and your character is shown.</span>
              <GhostButton onClick={() => setArmed(false)}>Keep going</GhostButton>
              <Button variant="danger" size="sm" onClick={() => { setArmed(false); onGiveUp(); }}>
                Yes, give up
              </Button>
            </div>
          ) : (
            <GhostButton onClick={() => setArmed(true)}>Give up this round</GhostButton>
          )}
        </div>
      )}
    </div>
  );
}
