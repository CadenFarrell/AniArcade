import { useLayoutEffect } from 'react';
import { GhostButton } from './Button';

// Page shell. Replaces the `min-h-screen flex flex-col items-center px-6 py-10`
// + `w-full max-w-md` pair that was hand-written at the top of a dozen screens,
// each with slightly different padding.
//
// Every screen carries pt-20 so its first element clears the fixed top bar
// (shared/components/TopBar.jsx, h-14) with a gap to breathe — centred screens
// included, since on a short viewport a centred column grows to the top edge
// and would otherwise slide under it.
//
// `screen-in` is the page-turn every view arrives with (see index.css). It is
// here rather than in any router because each view renders its own Screen, so
// a view change unmounts one and mounts the next — which is exactly when the
// animation runs. Online, where `view` changes under every player at once,
// everyone sees the page turn together for free.
//
// The same mount is where the page goes back to the TOP. Nothing else in the
// app resets scroll, and the window is one document for every view, so a new
// screen used to open wherever the last one was left: scroll down a setup
// screen to reach a setting, press the pinned Start, and the round opened with
// its heading and row of faces above the top of a phone's screen. A layout
// effect, so the jump lands before the first paint rather than flickering.
// scrollTop rather than window.scrollTo: jsdom implements the property but
// logs every scrollTo call as "not implemented" through console.error, which
// the component tests count as a failure.

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
};

export default function Screen({
  width = 'sm',
  center = false, // vertically centre the content — for short menu screens
  onBack,
  backLabel = '← Back',
  className = '',
  children,
}) {
  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  return (
    <div
      className={`screen-in min-h-dvh flex flex-col items-center px-5 pt-20 sm:px-6
        ${center ? 'justify-center pb-8 sm:pb-10' : 'pb-8 sm:pb-10'} ${className}`}
    >
      <div className={`w-full ${WIDTHS[width]}`}>
        {onBack && (
          <div className="mb-6">
            <GhostButton onClick={onBack}>{backLabel}</GhostButton>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
