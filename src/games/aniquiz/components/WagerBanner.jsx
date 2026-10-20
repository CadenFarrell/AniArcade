// The Daily Double and the final, announced as the moments they are: a block of
// the score ink with speed lines bursting behind the words, rather than a line
// of amber text above the wager box. Amber because a wager is points (the
// palette's score ink), and solid with paper text per the accent contract.
export default function WagerBanner({ finalRound = false, category = null }) {
  return (
    <div className="relative mb-6 overflow-hidden border-[3px] border-ink bg-pop-amber px-5 py-6 text-center text-paper shadow-pop">
      <span aria-hidden="true" className="speed-lines absolute inset-0 opacity-30 [--lines:var(--color-paper)]" />
      <p className="relative font-display text-4xl font-bold uppercase leading-none tracking-wide sm:text-5xl">
        {finalRound ? 'Final round' : 'Daily Double!'}
      </p>
      {category && (
        <p className="relative mt-2 text-base">
          Category: <span className="font-bold">{category}</span>
        </p>
      )}
    </div>
  );
}
