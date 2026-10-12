import { Badge } from '../../../shared/ui';

// The clue itself, as the one big thing on screen. Never shows the answer —
// the reveal is a separate component, so no prop on this one can leak it.
//
// `stake` replaces the face value on a wagered clue: on a Daily Double or the
// final the number on the card is the player's own bet, and printing the
// cell's value there would be printing a number that no longer means anything.
export default function ClueCard({ clue, category, stakeLabel, className = '' }) {
  if (!clue) return null;
  return (
    <div className={`card-pop border-pop-red/60 p-6 text-center sm:p-8 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        {category && <Badge tone="neutral">{category}</Badge>}
        <Badge tone="amber">{stakeLabel ?? clue.value}</Badge>
      </div>
      <p className="font-display text-2xl font-extrabold leading-snug text-white sm:text-3xl">
        {clue.prompt}
      </p>
    </div>
  );
}
