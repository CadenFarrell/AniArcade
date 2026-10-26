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

Moved from the root `CLAUDE.md` so it loads only when Claude works on the files above. The
cross-game architecture it builds on is still there.

Everything a player owns lives in one browser's localStorage, so a second device used to mean
re-importing (minutes, and the play record and chosen faces could never follow). **A backup
code is an account with no sign-in** — no Google, nothing outside the Firebase the rooms
already use, still Spark: "Turn on backup" (the profile picker's foot, or the end of a first
import) mints 16 characters from the room-code alphabet (`utils/codeAlphabet.js`, 80 bits via
`crypto.getRandomValues`, never `Math.random`) and keeps a copy of every profile, the
main-profile pointer and the history in `saves/{code}`. Entering the code, or opening
`/?restore=<code>` (read once and stripped like an invite), merges it in, and the devices stay
in step. The pure half is `utils/cloudSave.js`, the network half `services/cloudSave.js`, the
React half `context/CloudSaveProvider.jsx` (in `main.jsx` and `renderArcade`, inside
`ProfileProvider`); the screens share `components/BackupPanel.jsx`.

- **The save is ONE JSON string, not an RTDB tree.** That dodges every RTDB trap in `.claude/rules/online-rooms.md` at once —
  dropped empty arrays, gappy arrays, `undefined` — plus one only this would hit: a profile id
  is a folded NAME, so `.`, `/` and `#` are legal in it and illegal in an RTDB key.
- **The merge (`mergeSaves`)**: profiles union by id, the newer `savedAt` wins WHOLE (never
  field by field — a list, its import ids and its settings only mean anything together);
  `useProfile.saveProfile` stamps `savedAt` on every write, so no caller can forget. Deletes are
  markers (`{ id: at }`) that beat every copy saved before them, or a profile deleted on the
  phone comes back from the laptop. History is a union of lines, once each. The main profile
  is the DEVICE's and is adopted from the save only by a device with none.
- **A sync reads `updatedAt` first** and fetches `data` only when it moved since this device's
  `syncedAt`, so an ordinary load costs bytes, not every list in the save — Spark's download
  allowance is 10 GB a month for the whole arcade. "Have I changed" is a hash of the last
  synced string, not a second copy of it. No transaction: every push merges first, so a lost
  race repairs itself on the loser's next sync.
- **Nothing may list `saves/`** — the code is the whole key. The rules accept only the
  alphabet at 16 characters, exactly `data` (a string) and `updatedAt` (server time).
- **Firebase loads only for a device with a code.** `services/cloudSave.js` imports it
  lazily and reads `firebaseEnabled` from `services/firebaseConfig.js`, which `firebase.js`
  now re-exports from, so the hub can ask without pulling the SDK into its startup bundle.
  Local play without backup is still free of third-party requests.
- **The sync writes storage underneath `ProfileProvider`** — the one write that does not go
  through it, because the merge must read and write in one tick or an edit made mid-download
  is lost — and then calls the store's `reloadFromStorage`. `version` bumps re-key the
  hub's record strip, which reads history once per mount.
- `aniarcade_cloud_save` (`{ code, syncedAt, syncedHash, lastSyncedAt, deleted }`) is in
  `PRESERVED_KEYS`: the backup survives a reset, the way back to it would not.

`requestPersistentStorage` (`services/storage.js`) is the same-device half: it asks the browser
to keep the site's data — Safari otherwise wipes it after seven days without a visit — from
inside the Done of an import and the press that turns backup on, because Firefox asks the
player and only from a gesture.
