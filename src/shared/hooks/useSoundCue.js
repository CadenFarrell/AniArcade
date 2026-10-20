import { useEffect, useRef } from 'react';
import { playCue } from '../services/sound';

// Play a game sound when something HAPPENS, from state rather than from a press:
// a verdict arriving over the network, a reveal, a turn coming round.
//
// `key` names the event. The sound plays once each time it changes to a new
// non-null value — including on mount, so a reveal screen that mounts with its
// round's key sounds as it appears — and never again for the same key. That is
// what keeps a re-render, a room update that changes nothing relevant, or
// StrictMode's double effect from replaying it: the ref survives all three.
// Pass null (or false) for "nothing has happened"; going back to null and then
// to a key seen before does NOT replay it, because the ref remembers the last
// key it sounded for, not whether it is currently set.
//
// `name` may differ per key (correct vs wrong for one answer) and is read when
// the key changes; a name changing under the same key plays nothing.
export function useSoundCue(name, key) {
  const last = useRef(undefined);
  useEffect(() => {
    if (key == null || key === false || last.current === key) return;
    last.current = key;
    if (name) playCue(name);
  }, [name, key]);
}

// A countdown's last seconds: a tick on each of the final five, and `timeup`
// when it reaches zero. Only on the way DOWN — a clock that mounts already at
// zero (an expired round reloaded) or resets to full for the next question is
// silent. `running` false (paused, or no clock this round) silences it.
export function useCountdownCue(secondsLeft, running = true) {
  const prev = useRef(null);
  useEffect(() => {
    const was = prev.current;
    prev.current = secondsLeft;
    if (!running || was == null || !(secondsLeft < was)) return;
    if (secondsLeft <= 0) playCue('timeup');
    else if (secondsLeft <= 5) playCue('tick');
  }, [secondsLeft, running]);
}
