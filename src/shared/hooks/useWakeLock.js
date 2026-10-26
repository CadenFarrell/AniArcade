import { useEffect } from 'react';

// Keeps the screen on while `active` — HubScreen holds it for as long as any
// game is open, lobby and pass-the-device included, and lets go on the menu.
//
// Why it matters more than comfort: a phone that dims and locks mid-round drops
// its Firebase connection, presence runs out its 20s GRACE_MS, and the table
// sees that player as gone — a skipped turn, a host migration, an answer that
// never arrives. Locally it is the phone going dark while it is passed round.
//
// The browser releases the lock by itself whenever the page is hidden (tab
// switch, app switch, screen off), so it is asked for again each time the page
// comes back. Every failure is silence, the sound engine's rule: no Wake Lock
// API (older Safari, Firefox before 126), a refusal on low battery, a page not
// yet visible. A screen that dims is the old behaviour, never an error.
export function useWakeLock(active) {
  useEffect(() => {
    const api = globalThis.navigator?.wakeLock;
    if (!active || !api) return undefined;

    let sentinel = null;
    let stopped = false;
    // One request in flight at a time: a visibility flip during the first
    // request would otherwise get a second lock and lose the first unreleased.
    let requesting = false;
    const acquire = async () => {
      if (stopped || requesting || document.visibilityState !== 'visible') return;
      if (sentinel && !sentinel.released) return;
      requesting = true;
      try {
        const lock = await api.request('screen');
        // Released between asking and getting it: hand it straight back.
        if (stopped) lock.release().catch(() => {});
        else sentinel = lock;
      } catch {
        // Refused — battery saver, or the page lost visibility mid-request.
      } finally {
        requesting = false;
      }
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') acquire(); };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}
