// The top of a round's screen: what is happening, in display caps, with where
// we are in the game as an ink tab beside it ("Turn 3", "Song 2/10") and a
// one-line hint under it. `children` is the clock when there is one, so a
// countdown sits inside the panel it is timing rather than floating as a lone
// number between buttons (AniGuess's big green "60s" read as a score).
//
// The title is the screen's heading, and the playtest bots read several of
// them — AniGuess's "<name>'s Turn" / "Your Turn" tell a bot whose go it is
// (strategies/aniguess.js) — so a caller changing its words changes a bot.
export default function RoundHeader({ title, tag, hint, children, className = '' }) {
  return (
    <header className={`mb-5 border-2 border-ink bg-surface px-4 py-3 shadow-pop-sm sm:px-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <h2
          className="min-w-0 font-display text-3xl font-bold uppercase leading-none tracking-wide text-fg-strong
            [overflow-wrap:anywhere] sm:text-4xl"
        >
          {title}
        </h2>
        {tag && (
          <span
            className="shrink-0 border-2 border-ink bg-ink px-2 py-0.5 font-display text-xs font-bold uppercase
              tracking-[0.2em] text-paper"
          >
            {tag}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-sm text-fg-helper">{hint}</p>}
      {children && <div className="mt-3">{children}</div>}
    </header>
  );
}
