import { useEffect, useRef, useState } from 'react';
import { usePlayerPortrait } from '../context/tablePortraitsContext';
import Portrait from './Portrait';

// The table, mid-game, as a row of faces: everyone's portrait (the face their
// setup slot wore), name and score, with whoever is up framed larger under a
// NOW tab. It replaced three hand-built strips that said the same thing in
// three ways — AniGuess's turn chips, AniQuiz's score badges and AniTag's seat
// order — plus AniTune's row of score badges.
//
// Seat order, never sorted by score: the row doubles as the rotation, and
// reshuffling it after every point would hide whose turn is next.
//
// The NOW tab is purple, not the brand red: purple is the palette's whose-turn
// ink (index.css), and red on this row would read as a wrong answer.
//
// `players` items need only `id` and `name` — the face comes from the table's
// share-out (TablePortraits) by id. `score(p)` renders the number line (omit
// it for a game with no running score); `status(p)` a small mark under it — a
// place, a lock, "out". `dimIds` are players out of play (eliminated, departed):
// their FACE dims and their name drops to the quiet text role, never an
// opacity over text, which axe flags under 4.5:1.
export default function PlayerRow({
  players, activeId = null, youId = null, score, status, dimIds = [], label = 'Players', className = '',
}) {
  const [rowRef, scrolls] = useScrolls(Boolean(players?.length));
  if (!players?.length) return null;
  return (
    // While the row scrolls it is a focusable region, so a keyboard can scroll
    // it too (axe: scrollable-region-focusable, on AniWave's six-seat reveal).
    // Only while it scrolls: a row that fits would be a tab stop that does
    // nothing.
    <div
      ref={rowRef}
      {...(scrolls && { tabIndex: 0, role: 'region', 'aria-label': label })}
      className={`mb-6 overflow-x-auto pb-1 focus-pop ${className}`}
    >
      {/* Sized so five players fit a 390px phone without scrolling; from a
          sixth on, the row scrolls sideways rather than wrapping into two. */}
      <ol aria-label={label} className="mx-auto flex w-max items-end gap-2 px-1 pt-3 sm:gap-3">
        {players.map((p) => (
          <Seat
            key={p.id}
            player={p}
            active={p.id === activeId}
            you={p.id === youId}
            dim={dimIds.includes(p.id)}
            score={score?.(p)}
            status={status?.(p)}
          />
        ))}
      </ol>
    </div>
  );
}

// Whether the row is wider than its box. Both the box and the row are watched:
// the box resizes with the window, the row with who is seated and who is up (the
// active seat is drawn larger). jsdom has no ResizeObserver, so there it
// measures once — and jsdom lays nothing out, so it never scrolls. `present`
// re-runs it when an empty table (no row drawn) fills.
function useScrolls(present) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const box = ref.current;
    if (!box) return undefined;
    const measure = () => setOn(box.scrollWidth > box.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    if (box.firstElementChild) ro.observe(box.firstElementChild);
    return () => ro.disconnect();
  }, [present]);
  return [ref, on];
}

function Seat({ player, active, you, dim, score, status }) {
  const portrait = usePlayerPortrait(player);
  return (
    <li aria-current={active ? 'true' : undefined} className="flex w-14 flex-col items-center text-center sm:w-20">
      <span className="relative">
        {active && (
          <span
            className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 border-2 border-ink bg-pop-purple px-1.5
              font-display text-[10px] font-bold uppercase leading-tight tracking-[0.2em] text-paper"
          >
            Now
          </span>
        )}
        <span
          aria-hidden="true"
          className={`relative isolate block overflow-hidden bg-surface-2
            ${active ? 'h-14 w-14 border-[3px] border-ink shadow-pop-sm sm:h-20 sm:w-20' : 'h-11 w-11 border-2 border-ink sm:h-14 sm:w-14'}
            ${dim ? 'opacity-40' : ''}`}
        >
          <Portrait portrait={portrait} name={player.name} initialClass={active ? 'text-3xl' : 'text-2xl'} />
        </span>
      </span>
      <span
        className={`mt-1.5 block w-full truncate font-display text-xs font-bold uppercase tracking-wide
          ${dim ? 'text-fg-subtle' : 'text-fg-strong'}`}
      >
        {you ? 'You' : player.name}
      </span>
      {active && <span className="sr-only">(their turn)</span>}
      {score != null && (
        <span className="font-display text-sm font-bold tabular-nums leading-tight text-pop-amber">{score}</span>
      )}
      {status != null && status !== false && (
        <span className="mt-0.5 flex min-h-5 items-center justify-center text-xs">{status}</span>
      )}
    </li>
  );
}
