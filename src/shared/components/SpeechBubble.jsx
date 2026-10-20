// A question as a manga speech balloon: a rounded ink outline with its tail,
// the asker's name on a tab above it. The one rounded shape in an arcade of
// square panels, on purpose — a balloon is how a page says "somebody is
// talking", and the question IS somebody talking, to the whole table.
//
// `children` is what was said; nothing here is a control. `verb` is the
// caption's — AniGuess's "<name> asks", AniTag's "<name> names".
export default function SpeechBubble({ who, verb = 'asks', children, className = '' }) {
  return (
    <figure className={`relative mx-auto mb-6 max-w-md ${className}`}>
      {who && (
        <figcaption
          className="mb-2 text-center font-display text-xs font-bold uppercase tracking-[0.25em] text-fg-helper"
        >
          {who} {verb}
        </figcaption>
      )}
      <blockquote
        className="relative rounded-[2rem] border-[3px] border-ink bg-surface px-6 py-5 text-center font-display
          text-2xl font-bold leading-snug text-fg-strong shadow-pop-sm [overflow-wrap:anywhere]"
      >
        {children}
        {/* The tail: a square turned 45°, bordered on its two outer sides only,
            sitting over the balloon's bottom edge so the outline runs into it. */}
        <span
          aria-hidden="true"
          className="absolute -bottom-[11px] left-10 h-5 w-5 rotate-45 border-r-[3px] border-b-[3px] border-ink
            bg-surface"
        />
      </blockquote>
    </figure>
  );
}
