import { useState } from 'react';
import { prefersStill } from '../utils/motion';

/**
 * Timing for a reveal that lands one piece at a time — the house pattern
 * AniWave's dial set (bands, then each marker at 260 + 110·i ms), made shared.
 *
 * The rule every staged reveal keeps: THE MARKUP IS COMPLETE FROM THE FIRST
 * RENDER. Staging is a CSS animation-delay over finished content, with
 * from-state keyframes only (index.css), so:
 * - reduced motion, which strips the animations, leaves the finished picture;
 * - jsdom, which never fires animationend, sees every row at once, and the
 *   playtest bots read every word and button straight away;
 * - no button ever waits on an animation, so a skip is a convenience and never
 *   the only way forward (the bots refuse to press "skip").
 *
 * `rootProps` goes on the reveal's wrapper. Any press or key inside it sets
 * `data-skip`, which index.css uses to finish every animation at once, and
 * `skipped`, which callers pass to their count-ups and step cues. The press is
 * not swallowed — it still reaches whatever button it landed on.
 *
 * `key` names the reveal: a new key (the next round on a screen that stays
 * mounted) restarts the sequence. Reduced motion and a hidden tab are read once
 * at mount (utils/motion.js) and start it already finished.
 */
export function useStagger({ count, stepMs = 110, leadMs = 0, order = 'forward', key = null } = {}) {
  const [still] = useState(prefersStill);
  const [skippedKey, setSkippedKey] = useState(undefined);
  const off = still || skippedKey === key;

  const indexAt = (i) => (order === 'reverse' ? count - 1 - i : i);
  const delay = (i) => (off ? 0 : leadMs + indexAt(i) * stepMs);
  const totalMs = off ? 0 : leadMs + Math.max(0, count - 1) * stepMs;
  const style = (i) => (off ? undefined : { animationDelay: `${delay(i)}ms` });
  const skip = () => { if (!off) setSkippedKey(key); };
  const rootProps = {
    'data-skip': off ? '' : undefined,
    onPointerDown: skip,
    onKeyDown: skip,
  };
  return { delay, style, totalMs, skipped: off, rootProps };
}
