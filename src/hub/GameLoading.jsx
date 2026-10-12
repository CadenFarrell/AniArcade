import { useEffect, useState } from 'react';
import { Backdrop, Screen, Wordmark } from '../shared/ui';

// What a tapped tile shows while its game's code is still downloading — see
// shared/utils/lazyGame.js. Usually never seen: the hub preloads every game once
// it is idle, so this only appears for a tap that beats the preload, or under
// Data Saver, which skips it.
//
// Held back for SHOW_AFTER_MS. A load that finishes in a few frames would
// otherwise flash a whole screen for one paint, which reads as a glitch rather
// than as progress; past that, a tap with no visible answer reads as a tap that
// did not register.
const SHOW_AFTER_MS = 200;

// In the game's own accent, the colour its tile was, so the screen reads as the
// tile opening rather than as a detour.
export default function GameLoading({ title, accent }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!shown) return null;
  return (
    <>
      <Backdrop />
      <Screen center width="md" className="text-center">
        <Wordmark tone={accent} size="sm" level={2} className="mb-6">{title}</Wordmark>
        <p role="status" className="text-lg text-fg-body">Loading…</p>
      </Screen>
    </>
  );
}
