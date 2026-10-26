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
---

# Profiles and identity

Moved from the root `CLAUDE.md` so it loads only when Claude works on the files above. The
cross-game architecture it builds on is still there.

Player profiles (name + anime list + characters) live in localStorage under
`aniguess_profiles` and are shared by every game. The key name is
historical — it predates the hub and is **not** AniGuess-specific. Leave it alone:
renaming it to something tidier would orphan every profile players have already saved.
Every read runs `normalizeProfile`, so older saved shapes are repaired without a
migration flag — and it guards missing `animeList`/`characters`, because the picker
renders *every* saved profile, so a half-shaped one now takes the hub down on mount
rather than merely being invisible.

**What a profile actually stores is narrower than what the import fetches, and
conflating the two ships a broken game.** `fetchUserAnimeList` returns far more per
show than `mergeAnimeIntoProfile` persists; anything not in the list below is dropped
at `ListImport.runImport` and is simply not there at read time.

| entry | stored fields |
| --- | --- |
| anime | `id`, `title`, `characters`, plus the `STAT_KEYS` in `profileMerge.js` (`coverImageUrl`, `startDate`, `episodes`, `averageScore`, `popularity`) |
| character | `id`, `name`, `role`, `gender`, `imageUrl`, `description`, `favourites`, `genres` |

The stats arrived after the first games did, so **they are absent, not null, on any
profile imported before them** — a re-import backfills (`backfillStats`, which never
overwrites a value already there). A feature that ranks or filters by one must treat
missing as "not eligible" and say so on screen, the way `anirank/axes.js` returns
`null` from `valueFor` and the setup screen offers a re-import. AniRank's release-year
mode shipped dealing zero cards for exactly this reason: its comment described the
fetch shape and the code read the stored one.

Character `favourites` is written `?? 0`, so missing and genuinely-zero are the same value and
an unmeasured character reads as "nobody has heard of them". Anything that ranks by it must
handle none / partial / full coverage, and the partial case looks healthy — `fameFloor` in
`anifake/utils/pool.js` is the worked example, argued in `src/games/anifake/CLAUDE.md`. A
re-import repairs a saved character only through `addOrBackfillCharacter` (fill absent
fields, never overwrite) — see `.claude/rules/list-import.md`.

Two layers, and components must use the outer one:

- `shared/hooks/useProfile.js` is **storage only** — stateless, every call re-reads
  localStorage. It also owns `aniarcade_active_profile`, the pointer to your main
  profile (a current-name key, unlike `PROFILES_KEY` above, because it is new).
- `shared/context/ProfileProvider.jsx` holds the one copy of the profile map for the
  whole app; consumers import `useProfileStore` from `context/profileContext.js`.
  **Call `useProfile()` directly and your write reaches localStorage but re-renders
  nothing else** — no other screen holding that profile, and not the hub's profile
  pill. That was harmless when each screen asked for a name and used only its own
  answer; it is a silent data-loss bug now that one profile is shared everywhere. The
  `profilesRef` inside the provider is load-bearing for the same reason: two writes in
  one event handler both close over the same render's map, so without it the second
  persists over the first.

Online adds a third step, and it is easy to miss: the room stores a *copy* of the whole
profile (the player record in `state/` **is** the profile, lists and all), written at
exactly three moments — `createRoom`, `joinRoom`, and `updateMyProfile`. `saveProfile`
reaches localStorage and the provider and stops there. So the store is the source of truth
and the room copy is derived, and every lobby that reads a list calls
`shared/hooks/useRepublishProfile.js`, which republishes via `updateMyProfile` when
`profileFingerprint` (`shared/utils/profileStats.js`) says the two have diverged. AniTag's
lobby deliberately does not: it reads nobody's list. Import into `activeProfile`, never into the room copy: that copy is a
join-time snapshot that has been through RTDB, so merging out of it rolls back later edits
and drops the empty-array fields the import checklist reads.

The user picks their profile once, in the hub (`ProfileButton` → `ProfilePicker`), and
every game inherits it: seated automatically in local setup, and *the* identity online.
`ProfilePicker` has two modes over one list — `'main'` writes the active id, `'add'`
hands a profile to a local roster and must never touch it (hence `createProfile` vs
`ensureProfile`). Do not add a "type your name" box back to a screen: profile ids are
folded names (`profileIdFromName` in `shared/utils/profileStats.js`), so a typo mints a
new empty profile indistinguishable from a lost AniList import. That bug is the reason
the picker exists.

**The games that need a crowd seat the couch too** (`shared/hooks/useAutoSeat.js` over the
pure `utils/autoSeat.js`): AniGuess, AniTag, AniFake, AniWave and AniTurf open with the
table this device last *started* that game with (`aniarcade_last_tables`, `{ [gameId]:
profileId[] }`, written on local Start only), and failing that, enough profiles to reach
the game's `MIN_PLAYERS` — whoever the main profile most recently played with (history
lines name people, and a folded name *is* a profile id), then the picker's order. AniRank,
AniTune and AniQuiz play solo and still seat only the main profile, because there a seated
friend is a guess that costs a Remove tap every visit. The key rebuilds on the next Start,
so it is not in `PRESERVED_KEYS`. The playtest bots read the seat count off the screen for
this reason (`generic.js`), not from how many players they picked.

Identity is deliberately not id-based, and the reasons are non-obvious:

- `characterNameKey` (`shared/utils/character.js`) identifies a character by name with
  diacritics folded — AniList ids and the `Date.now()` ids on ListManager's old hand-made
  entries share no id space, and the same person appears under several season titles.
- Shows are grouped by `shared/utils/franchise.js` (AniList relation data during an import,
  title heuristic offline) and merged by `shared/utils/profileMerge.js`, which falls back to
  a shared-cast heuristic because neither ids nor titles line up across sources
  (`anilist_anime_<id>` + AniList's long titles vs. `<player>_anime_<n>` + hand-shortened
  ones).
- Characters come in two shapes (`genres` array from AniList, singular `genre` string from
  ListManager's old hand-made form); `normalizeCharacter` collapses them so consumers never
  branch.

Nothing on a list is typed in by hand: shows come from AniList search (`AnimeSearch.jsx`) or
an import, and the one edit left is deleting a whole show. Don't add a hand-entry or
cast-editing path back (why: `.claude/rules/list-import.md`).

**"New profile" is the import.** `ListImport` with `profile={null}` makes the profile, named
after the account (editable; required for a file), merging into a saved profile the name folds
onto instead of minting a second one, and creates nothing until Done. "Just a name, no list"
is the old box, for a guest with no tracker.
