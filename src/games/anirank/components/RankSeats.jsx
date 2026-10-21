import PlayerRow from '../../../shared/components/PlayerRow';
import { Icon } from '../../../shared/ui';

// The table as the arcade's row of faces (PlayerRow), for both halves of a
// round — local passes one device round, online everyone places at once — so
// AniRank's round wears the same faces as its setup slots and its results,
// like every other game's round does.
//
// A seat says who is still to go: a lime ✓ once that player has placed this
// card (blind) or locked their board in (open), nothing while they are still
// on it. The opinion round's subject is marked too, because they are the one
// board the rest are scored against, and nothing else on screen says who that
// is once the hint has scrolled away.
//
// `activeId` is the local hot seat (NOW); online there is no turn, everyone
// places at once, so it is null there. `scores` only when the round keeps
// score — an unscored round has no running number to show.
export default function RankSeats({
  players, pendingIds, activeId = null, youId = null, subjectId = null, open, scores = null, departedIds = [],
}) {
  if ((players?.length ?? 0) < 2) return null;
  const done = open ? 'locked in' : 'placed';
  return (
    <PlayerRow
      players={players}
      activeId={activeId}
      youId={youId}
      dimIds={departedIds}
      score={scores ? (p) => scores[p.id] ?? 0 : undefined}
      status={(p) => {
        const finished = !pendingIds.includes(p.id) && !departedIds.includes(p.id);
        const subject = p.id === subjectId;
        if (!finished && !subject) return null;
        return (
          <span className="flex items-center gap-1">
            {/* A text ROLE for the label (axe), and the ✓ carries its own
                word for a screen reader. */}
            {subject && (
              <span className="font-display text-[10px] font-bold uppercase tracking-wider text-fg-helper">Subject</span>
            )}
            {finished && <span className="text-pop-lime"><Icon name="check" label={done} /></span>}
          </span>
        );
      }}
    />
  );
}
