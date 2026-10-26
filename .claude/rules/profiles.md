---
paths:
  - "src/shared/hooks/useProfile.js"
  - "src/shared/hooks/useRepublishProfile.js"
  - "src/shared/hooks/useAutoSeat.js"
  - "src/shared/context/ProfileProvider.jsx"
  - "src/shared/context/profileContext.js"
  - "src/shared/components/ProfilePicker.jsx"
  - "src/shared/components/ProfileButton.jsx"
  - "src/shared/components/PortraitPicker.jsx"
  - "src/shared/components/PlayerSlots.jsx"
  - "src/shared/components/ListImport.jsx"
  - "src/shared/utils/profileStats.js"
  - "src/shared/utils/profileMerge.js"
  - "src/shared/utils/character.js"
  - "src/shared/utils/franchise.js"
  - "src/shared/utils/autoSeat.js"
  - "src/shared/services/storage.js"
---

# Profiles and identity

The key name, the stored-fields table and the `useProfileStore` rule are in the root
`CLAUDE.md`.

**Every read runs `normalizeProfile`**, which repairs older shapes without a migration flag and
guards missing `animeList`/`characters` — the picker renders EVERY saved profile, so one
half-shaped profile takes the hub down on mount.

**The import fetches far more than a profile keeps:** `fetchUserAnimeList` returns much more per
show than `mergeAnimeIntoProfile` persists, and anything outside the root table is dropped at
`ListImport.runImport` — read the stored shape, never the fetch shape.

**Missing is not zero.** Show stats are absent on profiles imported before them; a re-import
fills them through `backfillStats` (never overwrites). A feature ranking by one treats missing
as "not eligible" and says so on screen, the way `anirank/axes.js`'s `valueFor` returns `null`
and its setup offers a re-import — AniRank's release-year mode once dealt zero cards because it
read the fetch shape, not the stored one. Character `favourites` is written `?? 0`, so an
unmeasured character reads as unknown: handle none / partial / full coverage, and the partial
case looks healthy (`fameFloor` in `anifake/utils/pool.js`, argued in its CLAUDE.md). A
re-import repairs a saved character only through `addOrBackfillCharacter`
(`.claude/rules/list-import.md`).

**Two layers.** `useProfile.js` is storage only — stateless, every call re-reads localStorage,
and it owns `aniarcade_active_profile` (the main-profile pointer). `ProfileProvider.jsx` holds
the one copy of the map; a write through `useProfile()` directly reaches storage and re-renders
nothing else, which is silent data loss now that one profile is shared everywhere. The
provider's `profilesRef` is load-bearing: two writes in one handler close over the same render's
map, and without it the second persists over the first.

**Online, the room holds a COPY of each profile** (the player record in `state/` is the profile,
lists and all), written only at `createRoom`, `joinRoom` and `updateMyProfile`; `saveProfile`
stops at storage and the provider. Every lobby that reads a list calls `useRepublishProfile`,
which republishes when `profileFingerprint` says the two diverged — AniTag's too, though it
reads no list, because the fingerprint counts `portraitKey`. Import into `activeProfile`, never the room copy: that is a
join-time snapshot through RTDB, so merging from it rolls back later edits and drops the
empty-array fields the import checklist reads.

**The profile is picked once, in the hub** (`ProfileButton` → `ProfilePicker`), and every game
inherits it. The picker's `'main'` mode writes the active id; `'add'` hands a profile to a local
roster and must never touch it (`createProfile` vs `ensureProfile`). No "type your name" box on
any screen: ids are folded names (`profileIdFromName`), so a typo mints a new empty profile
indistinguishable from a lost import — the reason the picker exists. **"New profile" is the
import:** `ListImport` with `profile={null}` names it after the account (editable; required for
a file), merges into a saved profile the name folds onto, and creates nothing until Done. "Just
a name, no list" is for a guest with no tracker.

**Crowd games seat the couch** (`useAutoSeat.js` over `utils/autoSeat.js`): AniGuess, AniTag,
AniFake, AniWave, AniTurf and AniPeek open with the table this device last STARTED that game with
(`aniarcade_last_tables`, written on local Start only), else enough profiles for `MIN_PLAYERS` —
whoever the main profile last played with (history names people, and a folded name is an id),
then the picker's order. AniRank, AniTune and AniQuiz seat only the main profile, since a guessed
friend there costs a Remove tap every visit. The key rebuilds on Start, so it is not in
`PRESERVED_KEYS`; the bots read the seat count off the screen (`generic.js`).

**Identity is by name, never id:**

- `characterNameKey` (`character.js`) folds diacritics: AniList ids and ListManager's old
  `Date.now()` ids share no id space, and one person appears under several season titles.
- Shows group by `franchise.js` (AniList relations on import, title heuristic offline) and
  merge by `profileMerge.js`, falling back to a shared-cast heuristic because neither ids
  (`anilist_anime_<id>` vs `<player>_anime_<n>`) nor titles line up across sources.
- Characters come as a `genres` array (AniList) or a `genre` string (old hand-made);
  `normalizeCharacter` collapses them so consumers never branch.

Nothing on a list is typed by hand — AniList search or an import, and the one edit is deleting a
whole show (`.claude/rules/list-import.md`).

**Getting a profile onto another device is importing the same list there.** Backup codes
(`saves/{code}`, a cross-device sync with no sign-in) were built and removed: nobody keeps a
code, and a re-import already rebuilds everything a profile holds except its play history. The
effort went into making the import fast instead (`.claude/rules/list-import.md`).
`requestPersistentStorage` (`services/storage.js`) asks the browser to keep the site's data
(Safari otherwise wipes it after seven days unvisited), from inside an import's Done, because
Firefox asks the player, and only from a gesture.
