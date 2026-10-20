import PlayerRow from '../../../shared/components/PlayerRow';

/**
 * The rotation, drawn as the arcade's row of faces (PlayerRow).
 *
 * THE SEAT MOVES AFTER EVERY SINGLE NAME, and without this the only evidence of
 * that is a heading that changes — which reads as the game having jumped rather
 * than as a turn having passed. So the whole order is on screen at once, always
 * in roster order, because roster order IS seat order (see rules.turnOrder): the
 * seat walks forward through this list and wraps, so the next player is always
 * the next face that is still in.
 *
 * A SEAT SAYS ONE OF THREE THINGS, and they are three states rather than two:
 *
 *   up        framed under the purple NOW tab, the arcade's whose-turn ink
 *   still in  their names left, so the table can see who is running low
 *   finished  what they finished WITH — a solve and a give-up are both "done"
 *             and drawing them alike would throw away the only news of the round
 *
 * `left` is deliberately shown rather than `used`: the number that changes a
 * decision is how many you have got, not how many you have spent.
 */
export default function SeatStrip({ order = [], myPlayerId = null, className = '' }) {
  if (order.length < 2) return null;

  const status = (row) => {
    if (row.isSeat) return null;
    if (row.away) return { text: 'away', tone: 'text-pop-amber' };
    if (row.done) return row.solved ? { text: 'solved', tone: 'text-pop-lime' } : { text: 'out', tone: 'text-fg-subtle' };
    return { text: `${row.left} left`, tone: 'text-fg-helper' };
  };
  const byId = Object.fromEntries(order.map((row) => [row.playerId, row]));

  return (
    <PlayerRow
      className={className}
      label="Turn order"
      players={order.map((row) => ({ id: row.playerId, name: row.name }))}
      activeId={order.find((row) => row.isSeat)?.playerId ?? null}
      youId={myPlayerId}
      // A finished player's face dims (a give-up or a spent cap — a solve keeps
      // its face, it is the round's good news), and so does one who is away.
      dimIds={order.filter((row) => row.away || (row.done && !row.solved)).map((row) => row.playerId)}
      status={(p) => {
        const s = status(byId[p.id]);
        // A text ROLE, never an opacity: a dimmed status fell under 4.5:1 (axe).
        return s && (
          <span className={`font-display text-[10px] font-bold uppercase tracking-wider ${s.tone}`}>{s.text}</span>
        );
      }}
    />
  );
}
