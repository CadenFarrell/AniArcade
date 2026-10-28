import { useEffect, useRef } from 'react';
import { playCue } from '../services/sound';
import { prefersStill } from '../utils/motion';

/**
 * Sounds timed to a staged reveal's steps: `steps` is `[{ atMs, name }]`, read
 * when `key` changes and played once per key (useSoundCue's promise, for a
 * sequence). Steps still pending are dropped when the reveal is skipped, the
 * screen unmounts, or the tab is hidden — a sting that arrives after the picture
 * already finished, or from a tab nobody is looking at, is noise.
 *
 * Under reduced motion only the first step sounds, at once: the picture arrives
 * whole, and one cue is what an unstaged reveal would have played.
 */
export function useStepCues(steps, key, { skip = false } = {}) {
  const sounded = useRef(undefined);
  const timers = useRef([]);
  const stepsRef = useRef(steps);
  useEffect(() => { stepsRef.current = steps; });

  useEffect(() => {
    if (key == null || key === false || sounded.current === key) return;
    sounded.current = key;
    const all = stepsRef.current ?? [];
    const list = prefersStill() ? all.slice(0, 1).map((s) => ({ ...s, atMs: 0 })) : all;
    timers.current.forEach(clearTimeout);
    timers.current = list.map(({ atMs, name }) => setTimeout(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      playCue(name);
    }, Math.max(0, atMs)));
  }, [key]);

  useEffect(() => {
    if (!skip) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, [skip]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
}
