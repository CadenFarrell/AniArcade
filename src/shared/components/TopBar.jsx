import { useMemo, useState } from 'react';
import { TopBarContext } from '../context/topBarContext';
import Kana from '../ui/Kana';
import { KANA } from '../ui/kanaText';
import MuteToggle from './MuteToggle';

// The strip across the top of every screen — a game's HUD rather than a set of
// pills floating in the corners. It replaced three separately-fixed controls
// (Hub top-left, the room code and Leave top-right, the profile pill in the
// same corner on the hub), each with its own scrim and its own idea of how far
// from the edge it sat.
//
// Mounted ONCE, by HubScreen, around whatever the hub is showing; HubScreen is
// also the one place that knows which game is open, so the title comes in as a
// prop. Everything a GAME owns arrives through the slots instead (see
// topBarContext.js): HubButton portals into `left`, RoomShell's room code and
// Leave into `right`. That is why no game SCREEN had to change to get a bar.
//
// h-14 and fixed. Screen.jsx's top padding (pt-20) is what clears it, so a
// change to the height is a change there too.

export default function TopBar({ title = null, kana = null, end = null, children }) {
  // Callback refs into state, so a consumer re-renders once the node exists.
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const slots = useMemo(() => ({ left, right }), [left, right]);

  return (
    <TopBarContext.Provider value={slots}>
      <header
        className={`fixed inset-x-0 top-0 z-40 h-14 border-b-2 border-ink bg-surface/95
          backdrop-blur-sm`}
      >
        <div className="mx-auto flex h-full max-w-5xl items-center gap-2 px-2 sm:gap-3 sm:px-4">
          {/* Empty on the hub menu (there is nowhere to go "home" to), so it
              collapses to nothing and the brand sits flush left. */}
          <div ref={setLeft} className="flex items-center empty:hidden" />

          {title ? (
            // The open game. Hidden on phones, where the bar's width belongs to
            // the room code and Leave — the screen below already wears the
            // game's own wordmark.
            <div className="hidden min-w-0 items-baseline gap-2 border-l-2 border-ink pl-3 sm:flex">
              <span className="truncate font-display text-lg font-bold uppercase tracking-wide text-fg-strong">
                {title}
              </span>
              {kana && <Kana className="text-xs text-pop-pink">{kana}</Kana>}
            </div>
          ) : (
            <Brand />
          )}

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <div ref={setRight} className="flex items-center gap-2 empty:hidden" />
            {end}
            <MuteToggle />
          </div>
        </div>
      </header>
      {children}
    </TopBarContext.Provider>
  );
}

// The arcade's name as a masthead: a vermilion seal with the joystick, then the
// wordmark. Not a heading — the hub's hero carries the page's h1.
function Brand() {
  return (
    <div className="flex min-w-0 items-center gap-2" aria-hidden="true">
      <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-pop-sm border-2 border-ink bg-pop-pink">
        <svg viewBox="0 0 24 24" className="h-5 w-5">
          <ellipse className="fill-ink" cx="12" cy="19" rx="7" ry="2.2" />
          <rect className="fill-ink" x="10.6" y="9" width="2.8" height="10" />
          <circle className="fill-paper stroke-ink" cx="12" cy="8" r="3.6" strokeWidth="1.8" />
        </svg>
      </span>
      <span className="font-display text-xl font-bold uppercase tracking-wide text-fg-strong">
        Ani<span className="text-pop-pink">Arcade</span>
      </span>
      <Kana className="hidden text-[10px] text-fg-subtle md:inline">{KANA.arcade}</Kana>
    </div>
  );
}
