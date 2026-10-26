import { createContext, useContext } from 'react';

// The backup code, provided by CloudSaveProvider (main.jsx, inside
// ProfileProvider):
//
//   available      this build has Firebase to keep a backup in
//   code           this device's backup code, or null when backup is off
//   status         'off' | 'syncing' | 'ok' | 'offline' | 'error'
//   lastSyncedAt   this device's clock at the last good sync, or null
//   version        bumps whenever a sync rewrote local storage, for readers
//                  that read storage once per mount (the hub's record strip)
//   enable()       turn backup on: a new code, everything here pushed under it
//   restore(code)  link this device to an existing backup and merge it in;
//                  resolves { status, restored }
//   disconnect()   stop syncing here (the backup and the local data both stay)
//
// Fails soft outside a provider, the way useHelpDetail does: the consumers are
// leaf components on screens a component test may well mount alone, and
// "backup is unavailable" is exactly what a bare screen should show.
export const CloudSaveContext = createContext(null);

const UNAVAILABLE = { available: false, code: null, status: 'off', lastSyncedAt: null, version: 0 };

export const useCloudSave = () => useContext(CloudSaveContext) ?? UNAVAILABLE;
