# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreement

**Ask everything in one round before building, then build the whole thing.** Any task, however
small, starts with the questions needed to pin the spec — an assumption made silently at the
start becomes work that has to be thrown away and redone. This sets *when* a round happens,
not how big it is: a one-line tweak earns one question, not a padded set of four.

Use option menus only for genuinely concrete alternatives (2–4 of them); ask open design
questions — "how should X behave?" — in plain prose, because a menu forces a pick before the
mechanics are on the table. Both can go in the same round.

After the answers land, run to completion: no approval gates, no progress check-ins. If an
ambiguity the round missed turns up mid-build, stop and ask rather than guess — but treat that
as evidence the opening round was too thin.

## Commands

```bash
npm run test:smoke    # online hooks vs the Firebase emulator (starts and stops it; ~90s)
npm run generate      # regenerate seedProfiles.js from AniList (Node script)
npm run generate:facts # regenerate the fact pack in public/facts/ (Node script)
npm run generate:casts # regenerate the cast pack in public/casts/ (Node script, a few minutes)
```

CI (`.github/workflows/ci.yml`) runs `npm run lint`, `npm test` and `npm run build` on every
push and pull request, on Linux. That makes the filesystem **case-sensitive** there, unlike
this Windows checkout, so an import whose casing is off passes here and fails in CI (the
`kanaText.js` story in `.claude/rules/styling-assets.md` is the same trap the other way round). Smoke and playtest stay
manual.

`npm test` is vitest (config in `vite.config.js`'s `test` block): a `.test.js` is a pure module,
a `.test.jsx` a component test that needs a `// @vitest-environment jsdom` docblock and a
`vi.mock('shared/services/firebase')` (vitest loads `.env.local`, which is production). The
traps behind both are in `.claude/rules/testing.md`.

`smoke/` is the online half (`npm run test:smoke`), kept out of `npm test` on purpose; how
its harness simulates one device per player is in `smoke/CLAUDE.md`. Never `await` an
`act()` that might not resolve: it holds every React update in the process.

Playtest bots (`playtest/`, also `/playtest`) play every game, start to results, through
the real screens:

```bash
npm run playtest                                   # local, jsdom, every game × 20 seeds (~4 min)
npm run playtest -- --game anitag --seed 7 --debug # replay one run exactly (--debug screens: dump each screen)
npm run playtest -- --layer online                 # devices in one room on the emulator (reuses a running one)
npm run playtest -- --layer browser                # Playwright: phone + desktop, axe, layout, drag, online
npm run playtest:all                               # all three, then the report
```

Each run writes `playtest-report/` (gitignored). The bots find screens and buttons by their
words, so a renamed heading or button needs a matching change in `playtest/strategies/`, and
a new game needs a strategy or its playtest fails on purpose. The browser layer builds to
`dist-playtest*` and serves on 4198/4199 — never `dist`, never 5173. Internals (the shared
bot brain, seeds as replays, reading "stuck" failures) are in `playtest/CLAUDE.md`.

Firebase (online rooms only):

```bash
npx firebase emulators:start --only database,auth --project demo-aniguess
npx firebase deploy --only database    # database.rules.json
npx firebase deploy --only hosting     # dist/ — run npm run build first
```

The CLI is `firebase-tools` in devDependencies, not a global install, so a bare `firebase`
in a shell is "command not found". npm scripts are the exception — they put
`node_modules/.bin` on the PATH, which is why `test:smoke` can call it bare.

MyAnimeList proxy (`workers/mal-proxy`, wrangler) commands: `.claude/rules/list-import.md`.

`.env.local` (copied from `.env.local.example`) holds the `VITE_FIREBASE_*` config. When
pointing at the emulator, `VITE_FIREBASE_DATABASE_URL` must use the `-default-rtdb`
suffixed namespace — the wrong namespace connects to a rules-less database instead of the
one your rules were deployed to.

## Architecture

### Hub and game registration

`src/hub/registry.js` is the entire arcade menu. A game is a folder under `src/games/`
whose `index.js` default-exports a descriptor (`{ id, title, kana, blurb, accent,
available, Component, howTo }`) plus one line added to that array. `Component` receives a single
`onExit` prop and owns everything from there.

**`Component` is always `lazyGame(() => import('./<Game>Game'))`, never a static import.**
Everything else on the descriptor is the menu and stays eager; the game's code downloads on
demand, so the hub paints after ~68 KB gzipped instead of the whole arcade's ~300 KB. A new
game that imports its component statically pulls itself — and anything only it uses — back
into the hub's startup bundle, and nothing fails to say so. The mechanics (idle preload,
the loading screen, the reload-not-reset error) are in `src/hub/CLAUDE.md`.

Each game's top component (`<Game>Game.jsx`) is just a local/online mode picker: it holds
`mode` and renders `shared/components/ModePicker.jsx` with its own descriptor (imported from
`./index`) and tagline. **Build a new game's picker from that component, not from another
game's file** — the first seven were hand-copied once and differed only in colour and tagline.
ModePicker is the game's cover page: the hub tile opened — game-ink block, split ANI / WORD
title, and the same character the tile showed (`shared/context/tileCharacterContext.js`,
provided by `HubScreen` around the active game; null when a game is mounted alone, which
draws a bare panel). Its two mode cards are named "Play on this device" / "Play online"
because HubScreen.test and the playtest bots find them by those words; online is disabled
unless `firebaseEnabled`. The picker delegates to `LocalGame.jsx` or `OnlineGame.jsx`, each
of which is a thin view-router holding a `view` string and rendering dumb screens from
`components/`.

Tile sizing, the tile characters, the blurb's two homes and `ArcadeMark` are in
`src/hub/CLAUDE.md`.

**Every game ships a rules sheet: `howTo: () => import('./howTo')`**, whose `HOW_TO` is
`{ goal, players, sections: [{ title, items }] }` built from the game's own `rules.js` and
`prefs.js` constants, so a retuned number reaches the sheet by itself. `HubScreen` shows it
(`shared/components/HowToSheet.jsx`) from a "How to play" button in the top bar on every
screen of a game, and by itself the first time a game is opened on a device
(`hub/howToSeen.js`). `hub/howTo.test.js` fails a game without one, or one printing
`undefined`. Change a game's rules, check its sheet.

### rules.js — the central invariant

`src/games/<game>/rules.js` holds all game logic as pure functions: no React, no storage,
no network. Each takes a slice of round state and returns a `{ patch }` (sometimes plus
`next` view / derived values) for the caller to apply however its persistence layer works.

Every game pairs two hooks over that one `rules.js`, both in `games/<game>/hooks/`: a
local one backed by `useState`, and an online one backed by Firebase RTDB. Same rules,
two persistence layers.

This is what keeps turn order, scoring, and phase transitions from drifting between local
and online play. **Change game behaviour in `rules.js`, not in the hooks** — and the
`*.test.js` files that cover it are the reason it stays testable without a DOM or a
network.

**Per-game design notes live beside each game and load only when Claude works in that folder:**
`src/games/anirank/CLAUDE.md` (board direction, Kendall-tau scoring, the pool toggle, tier
lists), `src/games/wavelength/CLAUDE.md` (AniWave), `src/games/categories/CLAUDE.md` (AniTag),
`src/games/aniquiz/CLAUDE.md` (AniQuiz), `src/games/anifake/CLAUDE.md` (AniFake: the deal and
the card check, hidden-role patterns, fame coverage), `src/games/aniturf/CLAUDE.md` (AniTurf: crossing
goals, the winding-route footing and its detours, the two-device claim) and
`src/games/anipeek/CLAUDE.md` (AniPeek: the bid and its score, the pool's three filters, the
tile board, the skip). Read the relevant one before changing a game's
behaviour from shared code, where it will not load on its own.

### Online rooms (Firebase Realtime Database)

**The room lifecycle is `shared/hooks/useRoomCore.js`, not per-game.** AniGuess and AniTune
each grew their own copy first and the copies drifted; a game's online hook now configures
the core and adds only its own rules bindings:

```js
useRoomCore({ storageKey, playersPath, initialState, normalizeState, onExitRoom })
```

- `storageKey` — `<game>_online_room`, per-game so two games' saved rooms can't clobber
  each other.
- `playersPath` — where the roster lives under `state/`. Genuinely differs
  (`gameSession/players` in AniGuess, `players` elsewhere); the join transaction and the
  roster read both follow it.
- `normalizeState` — repairs what RTDB dropped, at the single point state enters the hook.

It owns codes, `memberUids`/`claims`/`open`, create/join/leave, the `onValue`
subscription, presence and the grace-window clock, `guard`/`bestEffort`, `patchState`, the
`once` one-shot, and host migration. What stays per-game is the
departure-reconciliation effect: noticing *that* someone left is generic, deciding what
their absence broke is not.

All games share one `rooms/{code}` namespace (codes are app-wide, 5 chars, no `0/O/1/I`):
`createdAt`, `open`, `memberUids/{uid}`, `claims/{playerId}` and `state/`, which every member
reads in full. **Anything a player must not learn goes in a sibling node, never `state/`** —
`assignments/{playerId}` (hidden from its owner) or `secrets/{playerId}` (only its owner reads),
picked by *who must not see it*, a choice whose two mistakes are both silent. RTDB drops empty
objects/arrays and the nulls in an array, so every room hook normalizes at every entry point
before `rules.js` sees state. Every readiness gate counts the *active* roster
(`usePresence`/`rosterSnapshot`, a 20s grace in server time), or one closed tab wedges the room.

**Read `.claude/rules/online-rooms.md` before touching any room data.** It loads with the room
hooks, `rules.js`, `database.rules.json` and `smoke/`, and holds the node table, the
hidden-role lessons, one-shot keys, the RTDB traps, presence, room deletion and invite links.

The shared screens every game is built from — `SetupLayout`/`StartBar`, `Lobby`,
`PlayerSlots` and `portraitsFor`, `Results`, and the in-round pieces (`Handoff`, `PlayerRow`,
`RoundHeader`, `ResultImpact`, `SpeechBubble`, `PlayerFace`) — are in
`.claude/rules/shared-screens.md`. Build a new screen from them, never from another game's
file, and keep their headings and button words: the playtest bots read them.

### Play history

Every finished game is a line in `aniarcade_history`. Each game's FINAL results screen calls
`useRecordResult(gameId, players, winnerIds, { places, scores })` once — never a between-rounds
`RoundEnd`, which would count a game several times. Ties, solo tables, team wins, the online
scope and the head-to-head: `.claude/rules/play-history.md`.

### Crash reports and feedback

`shared/services/reports.js` is the one write-only channel home: `reports/crashes/{uid}` and
`reports/feedback/{uid}` in the same RTDB, which no client can read (read them in the Firebase
console), each write rate-limited by a `reportGate/{uid}/{kind}` stamp the rules check.
Firebase is imported **dynamically** there, so the hub's bundle carries no SDK and local play
contacts Firebase only when something is actually sent. Crashes come from `ErrorBoundary`
and `main.jsx`'s window listeners (`crashReport.js`: never from a dev server, offline, or for a
failed game download, and never a profile or an invite's query); feedback from
`FeedbackModal.jsx` (hub footer, and each rules sheet). Rules and smoke test:
`.claude/rules/online-rooms.md`, `smoke/reports.smoke.test.js`.

### The screen stays on

`shared/hooks/useWakeLock.js` keeps the screen on while any game is open (one call in
`HubScreen`), since a locked phone drops a room connection exactly as a closed tab does.
Presence itself is in `.claude/rules/online-rooms.md`.

### Game settings

Every game's options are one `DEFAULT_PREFS` literal in `games/<game>/prefs.js` — it **is**
the schema — stored in the one arcade-wide key `aniarcade_game_prefs`, and each game has one
settings card rendered by both its setup screen and its lobby. Adding an option touches four
places, listed with the rest in `.claude/rules/settings-cards.md` (loads with `prefs.js` and
the settings, setup and lobby files).

### Profiles and identity

Player profiles (name + anime list + characters) live in localStorage under
`aniguess_profiles`, shared by every game — a historical name: **never rename it**, or every
saved profile is orphaned. **Components use `useProfileStore` (`context/profileContext.js`),
never `useProfile()` directly**, which writes storage and re-renders nothing else.

**What a profile stores is narrower than what the import fetches**, and anything not listed
here is simply not there at read time:

| entry | stored fields |
| --- | --- |
| anime | `id`, `title`, `characters`, plus the `STAT_KEYS` in `profileMerge.js` (`coverImageUrl`, `startDate`, `episodes`, `averageScore`, `popularity`, `format`, `studio`, `source`, `season`, `seasonYear`, `duration`) |
| character | `id`, `name`, `role`, `gender`, `imageUrl`, `description`, `favourites`, `genres` |

The stats are **absent, not null,** on profiles imported before them, and a character's
`favourites` is written `?? 0`: anything that ranks or filters by them must treat missing as
"not eligible" and say so on screen. Online, the room holds a *copy* of each profile, and a
lobby that reads a list calls `useRepublishProfile`. Identity is by folded name, never id
(`characterNameKey`, `profileIdFromName`), so no screen gets a "type your name" box and
nothing on a list is typed in by hand. The two layers, the room copy, auto-seating and why
ids do not line up: `.claude/rules/profiles.md`.

### List sources: any tracker, one profile shape

AniList, MyAnimeList, Kitsu or a MAL-format file all produce the same profile shape: another
site only says WHICH shows; everything else is hydrated from AniList, so no game or room hook
knows sources exist. The details — and why building from MAL's own data silently breaks a
mixed room — are in `.claude/rules/list-import.md`.

### Fact packs: the answers a profile cannot derive

`public/facts/` serves a generated pack (`npm run generate:facts`) of answers a profile cannot
derive. AniQuiz reads it, AniPeek's hint cards fall back to it, and AniRank, AniTune and
AniFake read its stats only through `usePackBackfill`. A missing entry is normal, never a failed load, and a pack key is the same
fold a profile keys on (`franchiseTitleKey`, `characterNameKey`). Versions, outside sources,
`facts/overrides.json` and AniList's no-`Referer` 403 are in `.claude/rules/fact-packs.md`.

### External APIs

- `shared/services/anilistClient.js` — GraphQL. Throttles from the `X-RateLimit-*` headers
  the API actually returns (~30/min, not the widely-cited 90) and backs off on 429.
  `shared/services/anilist.js` batches ~15 media per aliased query to stay under AniList's
  500 query-complexity cap; the characters connection is hard-capped at 25/page.
- Kitsu and MyAnimeList (proxy only): `.claude/rules/list-import.md`.
- `games/anitune/services/animethemesClient.js` — public, no auth. Two verified quirks
  documented in the file: the API bot-filters on `User-Agent` (fine in a browser, fatal for
  Node scripts), and the audio CDN omits CORS headers on the actual GET, so `<audio src>`
  playback and Range seeking work but `fetch`/`decodeAudioData` never will.
  `factSources/animethemes.js` is the generator's own Node copy (it must send a UA).
- Wikidata (generator only): `.claude/rules/fact-packs.md`.

With no `.env.local`, `firebaseEnabled` is false, `ensureInitialized()` is never called, and
local play touches no **third-party** network at all. Keep that property intact. What local
play does request is all same-origin static files, in the same class as its own JS bundle:
the fact pack under `/facts/`, the cast pack under `/casts/` (a list import's pre-fetched
characters), the fonts, the prints under `/art/`, and the UI sounds under
`/sounds/` (fetched at idle, and only where Web Audio exists — see
`shared/services/sound.js`). The one third-party load is the player's OWN data: character
portraits from an imported list, as `<img>` tags from AniList's CDN — on the hub tiles and in
every game's `Avatar`, and only for someone who imported one. `hub/HubScreen.test.jsx` pins the network half of that: its
`fetch` stub serves `/facts/` from `public/` and fails every other URL, and jsdom has no Web
Audio, so the sound engine never asks.

### Offline: the service worker

A production build ships `/sw.js`, so local play works with no signal. It answers only for
the files it precached and `/assets/` chunks, never another origin, and never caches an HTML
answer to a file request. The rest: `.claude/rules/service-worker.md`.

### Styling

Tailwind v4 with all design tokens in the `@theme` block of `src/index.css` — restyling
means editing values there, not sweeping components. Each accent has a fixed semantic job
(pink = primary/guessing/brand, purple = secondary/whose-turn, lime = yes/correct/ready,
red = no/wrong/destructive, amber = warnings/scores/timer, blue = asking); don't pick them by
vibe at the call site. The `btn-pop` / `focus-pop` utilities carry the press-down physics.
UI primitives are imported from the `src/shared/ui` barrel.

The core, which every screen edit must keep (the full design system, and why, is in
`.claude/rules/styling.md`, which loads with any `.jsx`/`.css` file; textures, type, art,
the shell and sound are in `.claude/rules/styling-assets.md`):

- On paper every solid fill is a dark ink carrying `text-paper`; `text-ink` is right only on
  a light fill. A right/wrong is never colour alone (`Mark`, `ResultImpact`).
- No emoji on screen — `shared/ui/icons.js` is the one icon set. Neutral colour is a role
  (`fg-*` tokens), never an opacity: never write `white/N` or `text-white`.
- Viewport heights are `dvh`; never `min-h-screen`. Animations are from-state, and never a
  `transform` on `Screen` (it breaks `fixed` descendants).

### Generated files — don't read these

`seedProfiles.js` (from `npm run generate`; a console seed script, not an app module),
`public/facts/pack-*.json`, `public/casts/` (from `npm run generate:casts`; shape in
`shared/utils/castPackFormat.js`), `package-lock.json`, `.anilist-cache/` and `.facts-cache/` are
generated blobs of up to 1.7 MB with no architectural information. `.claude/settings.json`
denies reading them and `.ignore` keeps them out of repo-wide Grep/Glob; to look up one key,
`grep` the file by path from the shell. Never hand-edit them. For the pack's shape read
`shared/utils/facts.js`. The hand-edited files beside them are `animeCatalog.js` (the show
list both generators read) and `facts/overrides.json`.

## Conventions

Comments here explain *why*, and heavily so — most are hard-won API, Firebase, or
accessibility findings that would be re-broken without them. Match that density rather
than stripping it. ESLint treats unused vars as errors, with `varsIgnorePattern: '^[A-Z_]'`.
