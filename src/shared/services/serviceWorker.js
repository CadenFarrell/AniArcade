// Registers the offline worker (sw/serviceWorker.template.js, written into the
// build as /sw.js by sw/plugin.js).
//
// Production builds only: the dev server has no sw.js, and a worker caching
// dev modules would serve stale code across every HMR edit. And never under
// Data Saver — the worker stores ~3.5 MB up front, every game and the fact
// pack, which is exactly the download lazyGame's preload already skips for
// someone who asked their phone to save data. They play online-only, as before.
//
// After `load`, so the install's downloads never compete with the hub's first
// paint. A failed registration is silence: the arcade works as it always did.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  if (navigator.connection?.saveData) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
