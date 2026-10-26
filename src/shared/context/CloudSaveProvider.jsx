import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cloudSaveAvailable, disconnectBackup, enableBackup, onLocalChange, readCloudState, restoreBackup, syncNow,
} from '../services/cloudSave';
import { requestPersistentStorage } from '../services/storage';
import { CloudSaveContext } from './cloudSaveContext';
import { useProfileStore } from './profileContext';

// How long after a change to wait before pushing. Long enough that an import's
// save-then-select, or a results screen's record, goes out as one write; short
// enough that a player who switches phones straight after a game finds it there.
const PUSH_DELAY_MS = 2000;

// When a device with a backup code syncs (services/cloudSave.js does the work):
//
// - on page load, and whenever the tab comes back into view — which is when a
//   phone that was in a pocket while the laptop played catches up;
// - PUSH_DELAY_MS after anything the backup holds changes;
// - at once when the tab is hidden, the last moment a page reliably gets
//   before a phone kills it;
// - when the connection comes back.
//
// A device with no code does none of this, and never loads Firebase.
export default function CloudSaveProvider({ children }) {
  const { reloadFromStorage } = useProfileStore();
  const [link, setLink] = useState(() => readCloudState());
  const [status, setStatus] = useState(() => (link.code ? 'syncing' : 'off'));
  const [version, setVersion] = useState(0);
  const timerRef = useRef(null);

  const apply = useCallback((result) => {
    if (result.localChanged) {
      reloadFromStorage();
      setVersion((v) => v + 1);
    }
    setLink(readCloudState());
    setStatus(result.status);
    return result;
  }, [reloadFromStorage]);

  const run = useCallback(async () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    if (!readCloudState().code) return;
    setStatus('syncing');
    apply(await syncNow());
  }, [apply]);

  useEffect(() => {
    if (!cloudSaveAvailable) return undefined;
    // The load-time sync, without run()'s setStatus: the initial status is
    // already 'syncing' when there is a code to sync.
    if (readCloudState().code) syncNow().then(apply);
    const stopListening = onLocalChange(() => {
      if (!readCloudState().code) return;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(run, PUSH_DELAY_MS);
    });
    const onVisibility = () => {
      if (document.visibilityState === 'visible' || timerRef.current) run();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', run);
    return () => {
      stopListening();
      clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', run);
    };
  }, [run, apply]);

  const enable = useCallback(async () => {
    // Inside the click, before the first await: Firefox only shows its
    // keep-my-data prompt from a user gesture.
    requestPersistentStorage();
    setStatus('syncing');
    return apply(await enableBackup());
  }, [apply]);

  const restore = useCallback(async (input) => {
    requestPersistentStorage();
    const result = await restoreBackup(input);
    // A failed restore put the previous link back; the status line keeps
    // describing that one.
    if (result.status === 'ok') apply(result);
    else setLink(readCloudState());
    return result;
  }, [apply]);

  const disconnect = useCallback(() => {
    disconnectBackup();
    setLink(readCloudState());
    setStatus('off');
  }, []);

  const value = useMemo(() => ({
    available: cloudSaveAvailable,
    code: link.code,
    lastSyncedAt: link.lastSyncedAt,
    status,
    version,
    enable,
    restore,
    disconnect,
  }), [link, status, version, enable, restore, disconnect]);

  return <CloudSaveContext.Provider value={value}>{children}</CloudSaveContext.Provider>;
}
