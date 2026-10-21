import PlayerRow from '../../../shared/components/PlayerRow';
import { Icon } from '../../../shared/ui';

// The table as the arcade's row of faces (PlayerRow), so an AniWave round
// wears the same faces as its setup slots and its results, like every other
// game's round does. One component for every screen of the round, local and
// online, because the screens differ only in which of these they pass:
//
//   psychicId   marked "Psychic" on every screen — the one seat playing a
//               different role, and the one the table is guessing at
//   activeId    NOW: whoever holds the device locally (the psychic, then each
//               guesser in turn). Online nobody takes turns to dial, so it is
//               the psychic while they clue and nobody after.
//   pendingIds  guess phase only: who has not dialled yet. A ✓ marks that a
//               dial is IN — never where, which nobody may see before the
//               reveal. Null outside the guess phase draws no marks.
//   scores      the running totals.
export default function WaveSeats({
  players, psychicId = null, activeId = null, pendingIds = null, youId = null, scores = null, departedIds = [],
}) {
  if ((players?.length ?? 0) < 2) return null;
  return (
    <PlayerRow
      players={players}
      activeId={activeId}
      youId={youId}
      dimIds={departedIds}
      score={scores ? (p) => scores[p.id] ?? 0 : undefined}
      status={(p) => {
        if (p.id === psychicId) {
          // A text ROLE, not an opacity (axe).
          return (
            <span className="font-display text-[10px] font-bold uppercase tracking-wider text-fg-helper">Psychic</span>
          );
        }
        if (!pendingIds || pendingIds.includes(p.id) || departedIds.includes(p.id)) return null;
        return <span className="text-pop-lime"><Icon name="check" label="dialled" /></span>;
      }}
    />
  );
}
