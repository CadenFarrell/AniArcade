// Should this piece of motion just show its finished state?
//
// Two reasons, and the second is a bug fix rather than a courtesy. A count-up
// has to be driven by requestAnimationFrame to track real elapsed time — but a
// BACKGROUND TAB DOES NOT RUN rAF AT ALL, so a reveal that lands while the
// player is looking at something else freezes every score at its start and
// stays there. It self-heals when they come back, which is exactly what makes it
// dangerous: a screenshot, a shared screen or a second monitor shows a table
// where nobody scored anything, and it is right again by the time anyone checks
// (AniWave's reveal shipped that bug; its RevealScreen.test.jsx pins the fix).
//
// Correctness must not depend on an animation completing. An animation nobody
// can see is worth nothing anyway, so a hidden document skips straight to the
// answer. Callers read this ONCE, at mount: a tab that becomes visible later
// shows the finished picture rather than starting a stale sequence.
export const prefersStill = () => (
  typeof window === 'undefined'
  || document.hidden
  || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
);
