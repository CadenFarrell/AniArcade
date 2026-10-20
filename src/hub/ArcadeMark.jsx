// AniArcade's joystick, on a vermilion seal.
//
// This is public/favicon.svg brought into the app — the logo had lived only in
// the tab. It stands on the title screen, where it is the arcade's mark; the
// top bar carries a smaller square cut of the same joystick beside the name.
//
// Colours are token classes rather than the favicon's hex literals: that file
// has to spell them out because a file in public/ cannot see the theme, and
// this one has no such excuse.
//
// Set at a slight angle, the way a hanko stamp never lands quite square — the
// one rotated object on a ruled page, which is what makes it read as stamped
// on rather than printed with the rest.
export default function ArcadeMark({ className = '' }) {
  return (
    <div
      style={{ transform: 'rotate(-3deg)' }}
      className={`grid h-16 w-28 place-items-center rounded-pop border-2 border-ink
        bg-pop-pink shadow-pop ${className}`}
    >
      {/* A wide plaque rather than a square one, and that is the whole trick.
          A joystick alone is a person — the exact glyph the profile control in
          the bar wears — so it needs the buttons beside it to become a control
          panel. But squeezed into 64px square, a ball and two dots collapse
          into a FACE. Width is free here while height is not, so the plaque
          spends width to give the three shapes room.

          The buttons sit on a diagonal, as they do on a real cabinet, which is
          also what stops a symmetrical pair reading as eyes. */}
      <svg viewBox="0 0 84 48" aria-hidden="true" className="h-10">
        {/* Base, then shaft, then ball, so each caps the one below — the order
            favicon.svg draws them in. */}
        <ellipse className="fill-ink" cx="24" cy="37" rx="16" ry="4.5" />
        <rect
          className="fill-ink"
          x="21" y="17" width="6" height="20"
          transform="rotate(-18 24 37)"
        />
        <circle
          className="fill-paper stroke-ink"
          cx="24" cy="16" r="7" strokeWidth="3"
          transform="rotate(-18 24 37)"
        />
        <circle className="fill-paper stroke-ink" cx="58" cy="19" r="6.5" strokeWidth="3" />
        <circle className="fill-paper stroke-ink" cx="71" cy="33" r="6.5" strokeWidth="3" />
      </svg>
    </div>
  );
}
