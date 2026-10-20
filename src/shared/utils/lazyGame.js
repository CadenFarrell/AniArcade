import { lazy } from 'react';

// A game's top component, loaded on demand rather than bundled into the hub.
//
// Every game used to be imported eagerly by hub/registry.js, so the menu could
// not paint until all seven games — and Firebase, dnd-kit and every screen they
// own — had downloaded and parsed: one ~1 MB file before the first tile. A
// game's descriptor still carries its title, blurb, kana and accent eagerly,
// because that is the menu; only `Component` defers.
//
// `preload()` is the other half. HubScreen calls it for every game once the
// menu is up and the browser is idle, so by the time a tile is tapped its code
// is almost always already here and the tap is instant — the menu got faster
// without opening a game getting slower. It is memoized, so the background
// preload and a tap racing it share one request rather than fetching twice.
//
// A failed load is FORGOTTEN rather than memoized, so leaving to the hub and
// tapping again really retries. And it is tagged `gameLoad`, so ErrorBoundary
// can tell "the code never arrived" from "the game crashed": the first is a
// connection problem or a tab left open across a deploy (the old chunk's hashed
// filename no longer exists), and its fix is a plain reload — never the Reset
// button a crash offers, which would throw away saved rooms for nothing.
export function lazyGame(load) {
  let pending = null;
  const preload = () => {
    pending ??= load().catch((cause) => {
      pending = null;
      throw Object.assign(new Error(`Could not load the game: ${cause?.message ?? cause}`), {
        gameLoad: true,
        cause,
      });
    });
    return pending;
  };
  const Component = lazy(preload);
  Component.preload = preload;
  return Component;
}

/**
 * Starts downloading every game once the browser has nothing better to do.
 *
 * Skipped under Data Saver: someone who asked their phone to save data should
 * not pay for six games they did not open. They get the on-tap load instead,
 * which the loading screen covers.
 *
 * Returns a cancel function, for the effect that schedules it.
 */
export function preloadGames(games, { idle = globalThis.requestIdleCallback } = {}) {
  if (globalThis.navigator?.connection?.saveData) return () => {};
  const run = () => {
    for (const game of games) {
      // A failed preload is not an error anyone needs to see: the tap retries,
      // and the loading screen says so if it fails again.
      if (game.available) game.Component?.preload?.()?.catch(() => {});
    }
  };
  if (typeof idle === 'function') {
    const handle = idle(run, { timeout: 3000 });
    return () => globalThis.cancelIdleCallback?.(handle);
  }
  // Safari has no requestIdleCallback; a short delay still lets the menu paint
  // before six downloads compete with it.
  const timer = setTimeout(run, 1000);
  return () => clearTimeout(timer);
}
