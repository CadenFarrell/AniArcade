// A draining countdown bar with the seconds beside it.
//
// Takes a *fraction remaining* and a seconds count rather than a deadline, so
// it stays a dumb presentational primitive and the clock lives in
// shared/hooks/useDeadline.js. Any screen can therefore drive it from a shared
// online deadline or a purely local one without the bar knowing which.
//
// The colour steps lime -> amber -> red on seconds left, not on fraction: five
// seconds is the same amount of panic whether the window was 10s or 60s, and
// the thresholds match the ones AniGuess's turn timer has always used so the
// two games' clocks feel like the same clock.
//
// Announced politely rather than assertively. A bar that re-announced every
// tick would talk over a screen-reader user for the entire round, so the live
// region carries only the coarse seconds and only while the clock is running.

// The bar also lights, and the halo widens as the clock runs out — 12px of lime
// at the start against 22px of red at the end. That is the one place in the app
// where glow carries information rather than emphasis, and it is worth it here
// because the whole point of a countdown is to be noticed from across a room
// without being read. A paused clock is unlit, for the same reason a disabled
// button is: nothing is happening, so nothing should be emitting.
function toneFor(secondsLeft) {
  if (secondsLeft > 10) {
    return { bar: 'bg-pop-lime [--glow:var(--color-pop-lime)] shadow-[0_0_12px_-2px_var(--glow)]', text: 'text-pop-lime' };
  }
  if (secondsLeft > 5) {
    return { bar: 'bg-pop-amber [--glow:var(--color-pop-amber)] shadow-[0_0_16px_-2px_var(--glow)]', text: 'text-pop-amber' };
  }
  return { bar: 'bg-pop-red [--glow:var(--color-pop-red)] shadow-[0_0_22px_-1px_var(--glow)]', text: 'text-pop-red' };
}

export default function TimerBar({
  secondsLeft = 0,
  fraction = 0,
  paused = false,
  label = 'Time left',
  className = '',
}) {
  const tone = paused
    ? { bar: 'bg-wash-bar', text: 'text-fg-subtle' }
    : toneFor(secondsLeft);
  // `fraction` is elapsed; the bar shows what is left.
  const pct = Math.min(100, Math.max(0, (1 - fraction) * 100));

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="h-4 flex-1 overflow-hidden rounded-pop-sm border-2 border-ink bg-surface-2"
        role="progressbar"
        aria-label={label}
        aria-valuenow={secondsLeft}
        aria-valuemin={0}
        aria-valuetext={paused ? 'Paused' : `${secondsLeft} seconds left`}
      >
        {/* No transition on width: this is redrawn every 100ms, and a CSS
            transition of comparable length turns a smooth drain into a lag. */}
        <div className={`h-full ${tone.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={`w-14 text-right font-display text-xl font-extrabold tabular-nums ${tone.text}`}
        aria-hidden="true"
      >
        {paused ? '⏸' : `${secondsLeft}s`}
      </span>
      <span className="sr-only" aria-live="polite">
        {paused ? 'Timer paused' : `${secondsLeft} seconds left`}
      </span>
    </div>
  );
}
