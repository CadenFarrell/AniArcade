import { useCallback, useEffect, useRef, useState } from 'react';

// The launch wipe's clock. `wipe(swap)` starts the overlay (PanelWipe.jsx) and
// runs `swap` — the state change that replaces the screen — at SWAP_MS, which is
// when the ink slab covers the viewport, so the old screen never visibly pops
// out and the new one is simply there when the slab moves on.
//
// TIMERS, NOT `animationend`. jsdom never fires animation events, so a swap
// hung on one would never happen in a component test; and a backgrounded tab
// can freeze CSS animations outright, which would strand a real player on the
// old screen. A timer fires either way.
//
// Reduced motion swaps at once with no overlay at all — the CSS rule that drops
// the animation is the second line of defence, not the first.
export const WIPE_MS = 520;
export const SWAP_MS = 230;

function prefersReducedMotion() {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

export function useWipe() {
  // An id rather than a boolean, so PanelWipe can be keyed on it and a second
  // wipe restarts the animation instead of inheriting the first one's frame.
  const [wipeId, setWipeId] = useState(null);
  // A press during a wipe is ignored: two quick taps on two tiles would
  // otherwise queue two swaps and open whichever landed last.
  const busy = useRef(false);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Returns whether the swap was taken: a caller that must not be dropped (a
  // device following its table into the next game) runs it itself when not.
  const wipe = useCallback((swap) => {
    if (busy.current) return false;
    if (prefersReducedMotion()) {
      swap();
      return true;
    }
    busy.current = true;
    setWipeId((n) => (n ?? 0) + 1);
    timers.current.push(
      setTimeout(swap, SWAP_MS),
      setTimeout(() => {
        busy.current = false;
        setWipeId(null);
      }, WIPE_MS),
    );
    return true;
  }, []);

  return { wipe, wipeId };
}
