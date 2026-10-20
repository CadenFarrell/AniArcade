import { createPortal } from 'react-dom';
import { useTopBar } from '../context/topBarContext';
import { playSound } from '../services/sound';

// The persistent way home. It lives at the left end of the top bar on every
// in-game screen — including each game's local/online menu — so no flow can
// dead-end and the exit never moves between views.
//
// Render it ONCE per flow, at the game root (`<Game>Game.jsx` for the menu,
// `LocalGame.jsx` for local play, RoomShell for a room) — never per screen.
// Rendering it per screen is what let AniRank wire the round's copy to its
// back-to-setup handler, so a button reading "Hub" returned to setup for a
// release; it is also why AniFake's pass-and-play screens had no exit at all,
// since each new screen had to remember to add one. A root button covers every
// screen the router can reach, including the ones nobody thought about.
//
// The hub's own list editor uses it too (HubScreen.jsx), where "Hub" is literal:
// that view is inside the hub, so leaving it lands on the menu.
//
// IT PORTALS INTO THE BAR rather than being lifted into it. The game owns the
// handler and the `confirm` (only it knows whether a round is in progress), and
// a portal lets it keep both while the button appears in the bar HubScreen
// draws. With no bar at all — a component test mounting one game on its own —
// it places itself in the corner as it always did, so nothing that renders a
// game outside the hub loses its exit.
//
// Labelled "Hub" with a house rather than "← Hub" on purpose — several screens
// have their own in-flow "← Back" (AniRank's "← Quit round", AniFake's "← Leave
// the round", "← Back to setup" on the results screens), and two arrow-prefixed
// controls stacked on top of each other read as the same button. That is the
// division to keep: **Hub leaves the flow, "← Back" steps within it.** The
// stepping half is Screen's `onBack`/`backLabel` (shared/ui/Screen.jsx), which
// renders in-flow at the top of the column so it scrolls instead of competing
// with this fixed control. The house is drawn, not 🏠, so it is ink like the
// rest of the bar; the accessible name stays exactly "Hub".
//
// Do not generalise "← Back" into a global history button. There is no router,
// most screen sequences are derived rather than stored (see LocalRound.jsx), and
// reversing one would re-reveal a secret, undo a locked-in placement, or — online,
// where `view` is shared room state — rewind the round for every other player.
// Back-nav belongs on the specific screens where going back is provably safe.

// `confirm`, when set, is the message to guard the exit with — used only while a
// round is actually in progress, since setup and results have nothing to lose.
// Same window.confirm pattern the online Leave button already uses.
export default function HubButton({ onClick, confirm = null }) {
  const bar = useTopBar();

  const handleClick = () => {
    if (confirm && !window.confirm(confirm)) return;
    playSound('back');
    onClick();
  };

  const button = (
    <button
      type="button"
      onClick={handleClick}
      className={`group focus-pop flex h-10 items-center gap-1.5 rounded-pop-sm border-2 border-ink
        bg-surface px-3 font-display text-sm font-bold uppercase tracking-wider text-fg-strong
        transition-colors hover:bg-ink hover:text-paper
        ${bar ? '' : 'fixed top-2 left-2 z-40'}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"
        className="h-4 w-4 fill-none stroke-ink transition-colors group-hover:stroke-paper">
        <path d="M3.5 11 12 4l8.5 7M6 9.5V20h4.5v-5.5h3V20H18V9.5" strokeWidth="2.2"
          strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      Hub
    </button>
  );

  if (!bar) return button;
  // A bar exists but has not attached its slot yet — one frame, on mount.
  // Nothing rather than the corner fallback, or the button flashes in the
  // wrong place.
  if (!bar.left) return null;
  return createPortal(button, bar.left);
}
