import { usePlayerPortrait } from '../context/tablePortraitsContext';
import Portrait from './Portrait';

// A player's face at row size, for the lists that name players one per line:
// who answered what, who buzzed, who said which clue, a round's summary, a
// compare grid's headers. The same face their seat, turn strip and results
// wear — looked up by id from the table's share-out (TablePortraits), so a
// list that only holds `{ id, name }` still finds it.
//
// Beside a name, never instead of one: it is aria-hidden, and the name next to
// it is what a screen reader and a colour-blind reader both go by.
//
// Rows only, by decision: a face inside a running sentence ("Liam got it!")
// made the line busy, and a face beside a CHARACTER card (AniGuess's who-is-
// who) reads as part of the answer, since a player's face is a character too.
const SIZES = {
  sm: { box: 'h-6 w-6 border', initial: 'text-xs' },
  md: { box: 'h-9 w-9 border-2', initial: 'text-base' },
};

export default function PlayerFace({ player, size = 'md', className = '' }) {
  const portrait = usePlayerPortrait(player);
  const { box, initial } = SIZES[size] ?? SIZES.md;
  if (!player) return null;
  return (
    <span
      aria-hidden="true"
      className={`relative isolate inline-block flex-shrink-0 overflow-hidden border-ink bg-surface-2 align-middle
        ${box} ${className}`}
    >
      <Portrait portrait={portrait} name={player.name} initialClass={initial} />
    </span>
  );
}
