import PlayerRow from '../../../shared/components/PlayerRow';

// Everyone's score, as the arcade's row of faces (PlayerRow), in seat order —
// seat order rather than by score, because the row doubles as the pick
// rotation and reshuffling it after every clue would hide whose turn is next.
//
// The highlighted player is framed under NOW (the palette's whose-turn
// purple); a departed player keeps their frozen score with their face dimmed,
// so the table can see where the game stood when they went. Scores can be
// negative — a lost wager — so they are printed signed.
const signed = (n) => (n < 0 ? `−${Math.abs(n).toLocaleString()}` : n.toLocaleString());

export default function Scoreboard({ players, scores, highlightId = null, departedIds = [], youId = null, marks = {} }) {
  return (
    <PlayerRow
      players={players}
      activeId={highlightId}
      youId={youId}
      dimIds={departedIds}
      label="Scores"
      score={(p) => signed(scores?.[p.id] ?? 0)}
      status={(p) => (departedIds.includes(p.id)
        ? <span className="font-display text-[10px] font-bold uppercase tracking-wider text-fg-helper">left</span>
        : marks[p.id] ?? null)}
    />
  );
}
