import { Badge } from '../../../shared/ui';

// Everyone's score in one strip, in seat order — seat order rather than by
// score, because the strip doubles as the pick rotation and reshuffling it
// after every clue would hide whose turn is next.
//
// Purple marks whose turn it is (the palette's whose-turn job); a departed
// player keeps their frozen score, dimmed, so the table can see where the game
// stood when they went.
export default function Scoreboard({ players, scores, highlightId = null, departedIds = [], youId = null, marks = {} }) {
  return (
    <div className="mb-6 flex flex-wrap justify-center gap-2">
      {players.map((p) => {
        const gone = departedIds.includes(p.id);
        return (
          <Badge key={p.id} tone={p.id === highlightId ? 'purple' : 'neutral'} className={gone ? 'opacity-40' : ''}>
            {marks[p.id] ? `${marks[p.id]} ` : ''}
            {p.name}{p.id === youId ? ' (you)' : ''} · {(scores?.[p.id] ?? 0).toLocaleString()}
            {gone && ' · left'}
          </Badge>
        );
      })}
    </div>
  );
}
