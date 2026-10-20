import { Badge } from '../../../shared/ui';

// The clue on screen: a big paper panel, its category on an ink tab across the
// top-left edge and its stake stamped top-right in the score ink, the prompt in
// display type between them. Ink-ruled, not crimson, for Board's reason.
export default function ClueCard({ clue, category, stakeLabel, className = '' }) {
  if (!clue) return null;
  return (
    <section className={`relative border-[3px] border-ink bg-surface px-5 pt-9 pb-7 text-center shadow-pop sm:px-8 ${className}`}>
      {category && (
        <span
          className="absolute -top-[3px] -left-[3px] max-w-[70%] truncate border-[3px] border-ink bg-ink px-2.5 py-1
            font-display text-xs font-bold uppercase tracking-[0.15em] text-paper"
        >
          {category}
        </span>
      )}
      <Badge tone="amber" className="absolute top-2 right-2">{stakeLabel ?? clue.value}</Badge>
      <p className="font-display text-2xl font-bold leading-snug text-fg-strong sm:text-3xl">
        {clue.prompt}
      </p>
    </section>
  );
}
