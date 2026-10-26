---
paths:
  - "src/shared/utils/cloudSave.js"
  - "src/shared/services/cloudSave.js"
  - "src/shared/services/firebaseConfig.js"
  - "src/shared/services/storage.js"
  - "src/shared/context/CloudSaveProvider.jsx"
  - "src/shared/context/cloudSaveContext.js"
  - "src/shared/components/BackupPanel.jsx"
  - "src/shared/utils/codeAlphabet.js"
  - "src/shared/hooks/useProfile.js"
  - "src/shared/context/ProfileProvider.jsx"
  - "smoke/cloudSave.smoke.test.js"
  - "database.rules.json"
---

# Backup codes: the same profiles on another device

**A backup code is an account with no sign-in** — nothing outside the Firebase the rooms use,
still Spark. "Turn on backup" (the picker's foot, or the end of a first import) mints 16
characters from the room-code alphabet (`utils/codeAlphabet.js`, 80 bits from
`crypto.getRandomValues`, never `Math.random`) and keeps every profile, the main-profile pointer
and the history in `saves/{code}`. Entering the code or opening `/?restore=<code>` (read once and
stripped, like an invite) merges it in, and devices stay in step. Pure half `utils/cloudSave.js`,
network `services/cloudSave.js`, React `context/CloudSaveProvider.jsx` (inside `ProfileProvider`
in `main.jsx` and `renderArcade`); screens share `components/BackupPanel.jsx`.

- **The save is ONE JSON string, not an RTDB tree** — which dodges every RTDB trap
  (`.claude/rules/online-rooms.md`) plus one of its own: a profile id is a folded NAME, so `.`,
  `/` and `#` are legal in it and illegal in an RTDB key.
- **`mergeSaves`:** profiles union by id and the newer `savedAt` wins WHOLE, never field by
  field (a list, its import ids and its settings only mean anything together);
  `useProfile.saveProfile` stamps `savedAt` on every write. Deletes are markers (`{ id: at }`)
  that beat every copy saved before them, or a profile deleted on the phone returns from the
  laptop. History is a union of lines. The main profile is the DEVICE's, adopted from the save
  only by a device with none.
- **A sync reads `updatedAt` first** and fetches `data` only if it moved since `syncedAt` —
  Spark's 10 GB/month download covers the whole arcade. "Have I changed" is a hash of the last
  synced string. No transaction: every push merges first, so a lost race repairs on the loser's
  next sync.
- **Nothing may list `saves/`**; the rules accept only the alphabet at 16 characters, exactly
  `data` (a string) and `updatedAt` (server time).
- **Firebase loads only on a device with a code:** `services/cloudSave.js` imports it lazily and
  reads `firebaseEnabled` from `services/firebaseConfig.js` (which `firebase.js` re-exports), so
  the hub asks without the SDK in its startup bundle.
- **The sync writes storage underneath `ProfileProvider`** — the one write that bypasses it,
  because the merge must read and write in one tick or an edit made mid-download is lost — then
  calls `reloadFromStorage`. `version` bumps re-key the hub's record strip.
- `aniarcade_cloud_save` (`{ code, syncedAt, syncedHash, lastSyncedAt, deleted }`) is in
  `PRESERVED_KEYS`: the backup survives a reset, the way back to it would not.

`requestPersistentStorage` (`services/storage.js`) asks the browser to keep the site's data
(Safari otherwise wipes it after seven days unvisited), from inside an import's Done and the
press that turns backup on, because Firefox asks the player, and only from a gesture.
