import { useEffect, useState } from 'react';
import { useDeadline } from '../../../shared/hooks/useDeadline';
import { TimerBar } from '../../../shared/ui';

/**
 * One player's clock on a shared device. Mounted per player (the caller keys
 * it), so the deadline is fixed the moment the device is in their hands — the
 * pass-and-play rule AniTune's beginEntry states: everyone gets the same
 * seconds from when they are holding it, not from when the clue came up.
 */
export default function LocalClock({ ms, onExpire }) {
  const [deadline] = useState(() => Date.now() + ms);
  const clock = useDeadline(deadline, { windowMs: ms });
  useEffect(() => {
    if (clock.expired) onExpire();
    // onExpire is a fresh arrow each render; firing once on expiry is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.expired]);
  return <TimerBar className="mb-4" secondsLeft={clock.secondsLeft} fraction={clock.fraction} label="Time to answer" />;
}
