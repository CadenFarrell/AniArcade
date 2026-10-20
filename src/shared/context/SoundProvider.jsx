import { useCallback, useEffect, useMemo, useState } from 'react';
import { storage } from '../services/storage';
import { prefetchSounds, setSoundMuted, soundSupported } from '../services/sound';
import { MUTED_KEY, SoundContext } from './soundContext';

// Whether this device plays the UI sounds. The engine is a plain module
// (services/sound.js) so a Button can call playSound without a hook; this
// provider exists only to hold the ONE piece of it the screen has to re-render
// for — the mute switch in the top bar. The storage key and its reasoning live
// beside the context in soundContext.js.
export default function SoundProvider({ children }) {
  const [muted, setMutedState] = useState(() => storage.getItem(MUTED_KEY) === true);

  // The module keeps its own copy because playSound runs outside React. Set
  // during render rather than in an effect so a press in the very first frame
  // already sees a saved mute — a muted player hearing one click on every
  // reload is exactly the bug a mute switch exists to prevent.
  setSoundMuted(muted);

  // Fetch the bytes once the page is idle, so the first press has something to
  // decode. ~20 KB, same origin. requestIdleCallback is missing on Safari, the
  // same gap lazyGame.js covers with a timer.
  useEffect(() => {
    if (!soundSupported()) return undefined;
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(prefetchSounds, { timeout: 3000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = setTimeout(prefetchSounds, 1000);
    return () => clearTimeout(id);
  }, []);

  const setMuted = useCallback((next) => {
    setSoundMuted(next);
    setMutedState(next);
    storage.setItem(MUTED_KEY, next);
  }, []);

  const value = useMemo(
    () => ({ muted, setMuted, supported: soundSupported() }),
    [muted, setMuted],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}
