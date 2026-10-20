import Icon from './Icon';

// A stamped right/wrong (or yes/no): solid ink, paper text, the ✓ or ✗ and the
// word together. The shape carries the meaning and the colour only agrees —
// lime/red is the pair a red-green colour-blind player cannot separate, and
// wrong's red sits beside the brand's own. Use it wherever a result is shown in
// a row (AniGuess's question log, AniQuiz's reveal, AniTag's trails), instead
// of a coloured word.
export default function Mark({ yes, label, className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 border-2 border-ink px-1.5 py-0.5 font-display text-xs
        font-bold uppercase tracking-wider text-paper ${yes ? 'bg-pop-lime' : 'bg-pop-red'} ${className}`}
    >
      <Icon name={yes ? 'check' : 'cross'} /> {label}
    </span>
  );
}
