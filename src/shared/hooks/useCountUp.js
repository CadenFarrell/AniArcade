import { useEffect, useState } from 'react';
import { prefersStill } from '../utils/motion';

const DURATION_MS = 420;

/**
 * A number that ticks from `from` to `value`, the way a reveal's pieces land
 * one at a time. Purely presentational: it always settles on `value`.
 *
 * Written against requestAnimationFrame rather than an interval so it tracks
 * real elapsed time — a tab that was throttled mid-reveal resumes at the right
 * number instead of finishing seconds late. Under reduced motion, in a hidden
 * tab (utils/motion.js) or once `skip` is set it is simply `value`.
 *
 * Generalised from AniWave's reveal badges: `from` lets a results screen count
 * a total up from where it stood before the last round, and a value below
 * `from` counts down the same way (AniQuiz's wagers can take a total down).
 */
export function useCountUp(value, { from = 0, delayMs = 0, durationMs = DURATION_MS, skip = false } = {}) {
  const startAt = () => (prefersStill() ? value : from);
  // Seeded to the finished value when nothing should move, so a reduced-motion
  // reader never sees the start at all — not even for the frame before an
  // effect could correct it.
  const [shown, setShown] = useState(startAt);

  // Reset DURING RENDER rather than in an effect, the pattern shared/ui/Avatar.jsx
  // uses: a synchronous setState inside an effect is the cascading render the
  // react-hooks rule exists to catch, and callers key rows by player id, so they
  // survive into the next round — without a reset, round two would count up
  // from round one's score.
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setShown(startAt());
  }

  useEffect(() => {
    if (skip || prefersStill() || value === from) return undefined;
    let frame = 0;
    let start = 0;
    const tick = (now) => {
      if (!start) start = now;
      const elapsed = now - start - delayMs;
      // Nothing moves until the delay is up, so the number holds its start
      // rather than running ahead of the row or marker that explains it.
      if (elapsed < 0) { frame = requestAnimationFrame(tick); return; }
      const t = Math.min(1, elapsed / durationMs);
      // The last frame is the exact value: AniTune's totals carry a decimal
      // that rounding the in-between frames would otherwise leave off.
      setShown(t >= 1 ? value : Math.round(from + (value - from) * t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, from, delayMs, durationMs, skip]);

  return skip ? value : shown;
}
