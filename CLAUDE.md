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
npm run size          # the hub's startup budget, over dist/ (run npm run build first)
npm run knip          # unused files, exports and dependencies, across app, bots and scripts
```

CI (`.github/workflows/ci.yml`) runs `npm run lint`, `npm test`, `npm run build` and
`npm run size` on every push and pull request, on Linux. That makes the filesystem **case-sensitive** there, unlike
this Windows checkout, so an import whose casing is off passes here and fails in CI (the
`kanaText.js` story in `.claude/rules/styling-assets.md` is the same trap the other way round). Smoke and playtest stay
manual.

**A hook checks every file Claude edits** (`.claude/hooks/check-edit.mjs`, a PostToolUse hook
in `.claude/settings.json`): ESLint errors, an import whose casing only Windows forgives, and
the styling "nevers" below (`min-h-screen`, `text-white`, `white/N`/`black/N`, emoji, a game
imported statically). It never blocks; its findings come back to Claude to fix. `node
.claude/hooks/check-edit.mjs --all` sweeps the tree after a rule there changes. Lint also
carries `eslint-plugin-jsx-a11y` for `src/**/*.jsx`; where a rule meets deliberate code
(focus moved on purpose, the combobox's unfocused options) it is off or disabled in place with
the reason beside it. `knip.jsonc` says why each exception stands.

The `typescript` devDependency (5.x) is there for Claude Code's TypeScript LSP plugin alone:
nothing imports it and the project has no `tsconfig`, but `typescript-language-server` needs a
`tsserver.js`, which the global TypeScript 7 (the native port) does not ship. Keep it.

Two project skills cover the repeated procedures: `/new-game` (every place a new game
touches, in order) and `/ship` (green gate, own-hunks commit, push, CI, deploy only what
changed).

`npm test` is vitest (config in `vite.config.js`'s `test` block): a `.test.js` is a pure module,
a `.test.jsx` a component test that needs a `// @vitest-environment jsdom` docblock and a
`vi.mock('shared/services/firebase')` (vitest loads `.env.local`, which is production). The
traps behind both are in `.claude/rules/testing.md`.

`smoke/` is the online half (`npm run test:smoke`), kept out of `npm test` on purpose; how
its harness simulates one device per player is in `smoke/CLAUDE.md`. Never `await` an
`act()` that might not resolve: it holds every React update in the process.

Playtest bots (`npm run playtest`, or `/playtest`) play every game through the real screens and
find buttons by their words: a renamed heading or button needs a matching change in
`playtest/strategies/`, and a new game needs a strategy. Commands and internals:
`playtest/CLAUDE.md`. Read `playtest-report/summary.md`, never `index.html`.

Firebase is `npx firebase` (a devDependency; bare `firebase` works only inside npm scripts).
Deploying goes through `/ship`. The two Hosting sites, the emulator's database namespace and
`.env.local`: `.claude/rules/hosting.md`.

## Architecture

### Hub and game registration

`src/hub/registry.js` is the entire arcade menu. A game is a folder under `src/games/`
whose `index.js` default-exports a descriptor (`{ id, title, kana, blurb, accent,
available, Component, howTo }`) plus one line added to that array. `Component` receives a single
`onExit` prop and owns everything from there.

**`Component` is always `lazyGame(() => import('./<Game>Game'))`, never a static import.**
Everything else on the descriptor is the menu and stays eager; the game's code downloads on
demand, so the hub paints after ~115 KB gzipped instead of the whole arcade's ~300 KB. A new
game that imports its component statically pulls itself — and anything only it uses — back
into the hub's startup bundle: the edit hook flags it as it is written, and `npm run size`
(`.size-limit.json`, in CI) fails the build — AniDraft imported statically measured 165 KB
against the 120 KB budget. Raise the budget only as a decision. The mechanics (idle preload,
the loading screen, the reload-not-reset error) are in `src/hub/CLAUDE.md`.

Each game's top component (`<Game>Game.jsx`) is a local/online mode picker built from
`shared/components/ModePicker.jsx` (**never copied from another game's file**), which delegates
to `LocalGame.jsx` or `OnlineGame.jsx`: thin view-routers that hold a `view` string and render
dumb screens from `components/`. Its cards are named "Play on this device" / "Play online"
because the tests and bots find them by those words. The cover, tiles and `ArcadeMark`:
`src/hub/CLAUDE.md`. A new game: `/new-game`.

**Every game ships a rules sheet: `howTo: () => import('./howTo')`**, whose `HOW_TO` is built
from the game's own `rules.js` and `prefs.js` constants, so a retuned number reaches the sheet
by itself. `hub/howTo.test.js` fails a game without one, or one printing `undefined`. Change a
game's rules, check its sheet.

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

**Each game's design notes are its `src/games/<game>/CLAUDE.md`** (AniWave is `wavelength/`,
AniTag `categories/`), which loads only when Claude works in that folder. Read the relevant one
before changing a game's behaviour from shared code, where it will not load on its own.

### Online rooms (Firebase Realtime Database)

**The room lifecycle is `shared/hooks/useRoomCore.js`, not per-game.** A game's online hook
configures the core and adds only its own rules bindings and its departure reconciliation
(its options and what it owns: `.claude/rules/online-rooms.md`).

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
hidden-role lessons, one-shot keys, the RTDB traps, presence, room deletion, invite links and
"Next game" (a host takes the whole table from a room's final results into another game's
room: `shared/utils/handoff.js`, one `state/next` node in the old room). A new game opts in
with `{ nextGame: true }` on its final results' `shell()` call.

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

### Crash reports, feedback, wake lock

Crash reports and feedback are write-only RTDB nodes sent through `shared/services/reports.js`.
That file imports Firebase **dynamically**, so the hub's bundle carries no SDK:
`.claude/rules/reports.md`. `shared/hooks/useWakeLock.js` (one call in `HubScreen`) keeps the
screen on while a game is open, because a locked phone drops a room connection the way a
closed tab does.

### Game settings

Every game's options are one `DEFAULT_PREFS` literal in `games/<game>/prefs.js` — it **is**
the schema — stored in the one arcade-wide key `aniarcade_game_prefs`, and each game has one
settings card rendered by both its setup screen and its lobby. Adding an option touches four
places, listed with the rest in `.claude/rules/settings-cards.md` (loads with `prefs.js` and
the settings, setup and lobby files).

### Recent deals

`shared/utils/recentDeals.js` remembers what each game dealt lately on the dealing device
(never room state). It is a **preference, never a filter** (`preferFresh`, or a rank penalty),
because a small shared list is exactly where a filter would leave nothing to deal. Repeats
WITHIN a match are each game's own state. The file's header has the rest.

### Profiles and identity

Player profiles (name + anime list + characters) live in localStorage under
`aniguess_profiles`, shared by every game — a historical name: **never rename it**, or every
saved profile is orphaned. **Components use `useProfileStore` (`context/profileContext.js`),
never `useProfile()` directly**, which writes storage and re-renders nothing else.

**What a profile stores is narrower than what the import fetches** — read the stored-fields
table in `.claude/rules/profiles.md` before relying on a field. The stats are **absent, not
null,** on profiles imported before them, and a character's
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

### Network

The external clients document their own limits and quirks in their headers: AniList
(`shared/services/anilistClient.js`, ~30 requests/min), AnimeThemes
(`games/anitune/services/animethemesClient.js`), Kitsu and MyAnimeList
(`.claude/rules/list-import.md`) and Wikidata (`.claude/rules/fact-packs.md`).

**Local play touches no third-party network** (no `.env.local` → `firebaseEnabled` false,
`ensureInitialized()` never called). Keep it that way. It requests only same-origin static files
(`/facts/`, `/casts/`, fonts, `/art/`, `/sounds/`), plus the player's OWN imported portraits
from AniList's CDN as `<img>` tags. The one exception is AniTune, whose songs come from
AnimeThemes even on one device (`src/games/anitune/CLAUDE.md`). `hub/HubScreen.test.jsx` pins this: its `fetch` stub fails
every URL except `/facts/`.

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

**Files over ~40 KB are read in parts, never whole:** Grep for the spot, then `Read` with
`offset`/`limit`. That covers `aniquiz/famousLines.js` and `clues.js` (whose own tool is
`node scripts/famous-lines.js`), the large `rules.js` files (`categories/`, `anifake/`) and
their `rules.test.js`.
