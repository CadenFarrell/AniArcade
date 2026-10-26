import { useSyncExternalStore } from 'react';

// Whether the browser thinks it has a network — for the one place that
// matters: the cover page's "Play online" card, which a phone with no signal
// (the service worker opened the arcade from its cache) cannot use.
//
// Only `false` means anything. navigator.onLine is true behind a captive portal
// or on a dead Wi-Fi, so it gates nothing beyond saying "you're offline" when
// the browser knows it is; a room that cannot connect still says so itself.
const subscribe = (onChange) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine !== false, () => true);
}
