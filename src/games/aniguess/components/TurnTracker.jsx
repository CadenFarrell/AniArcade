import PlayerRow from '../../../shared/components/PlayerRow';
import { Icon, PlaceMark } from '../../../shared/ui';

// Whose turn it is, as the arcade's row of faces (PlayerRow): the guesser framed
// under NOW, everyone who has solved it carrying their place, everyone still
// going an hourglass. The place is what a solved player's chip used to say; the
// row is in seat order, so it is also the order the turns go round.
export default function TurnTracker({ players, currentPlayerId, lockedPositions }) {
  const lockFor = (id) => lockedPositions.find((lp) => lp.playerId === id);
  return (
    <PlayerRow
      players={players}
      activeId={currentPlayerId}
      label="Turn order"
      status={(player) => {
        const locked = lockFor(player.id);
        if (locked) {
          const tied = lockedPositions.filter((lp) => lp.turnsUsed === locked.turnsUsed).length > 1;
          return (
            <span className="inline-flex items-center gap-1 text-sm">
              <PlaceMark place={locked.position} />
              {tied && <span className="font-display text-[10px] font-bold uppercase tracking-wider text-pop-amber">Tie</span>}
            </span>
          );
        }
        if (player.id === currentPlayerId) return null;
        return <span className="text-sm text-fg-helper"><Icon name="hourglass" label="Waiting" /></span>;
      }}
    />
  );
}
