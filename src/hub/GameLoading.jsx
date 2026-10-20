import { useEffect, useState } from 'react';
import { Backdrop, Kana, Screen, Wordmark } from '../shared/ui';
import { KANA } from '../shared/ui/kanaText';

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

// The game's own title under speed lines, in the game's ink, so the screen reads
// as the tile opening rather than as a detour.
export default function GameLoading({ title, kana, accent }) {
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
        <div className="relative mx-auto grid aspect-[4/3] max-w-sm place-items-center overflow-hidden border-2 border-ink bg-surface shadow-pop">
          <div aria-hidden="true" className="speed-lines absolute inset-0 opacity-25" />
          <div className="relative">
            <Wordmark tone={accent} size="sm" level={2} kana={kana}>{title}</Wordmark>
            <p role="status" className="mt-4 font-display text-lg font-bold uppercase tracking-[0.3em] text-fg-body">
              Loading <Kana className="ml-1 text-sm text-fg-subtle">{KANA.loading}</Kana>
            </p>
          </div>
        </div>
      </Screen>
    </>
  );
}
