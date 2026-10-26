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
```

CI (`.github/workflows/ci.yml`) runs `npm run lint`, `npm test` and `npm run build` on every
push and pull request, on Linux. That makes the filesystem **case-sensitive** there, unlike
this Windows checkout, so an import whose casing is off passes here and fails in CI (the
`kanaText.js` story below is the same trap the other way round). Smoke and playtest stay
manual.

The vitest config lives in the `test` block of `vite.config.js`. Its `include` is
`src/**/*.test.{js,jsx}` under a default `environment: 'node'`: a `.test.js` is a pure
module, and a `.test.jsx` is a component test that must open with a
`// @vitest-environment jsdom` docblock (forget it and the file fails on `document is not
defined`, rather than silently never running as `.test.jsx` files used to).
`src/shared/testing/arcade.jsx` mounts the same providers `main.jsx` does and seeds
profiles in the stored shape; `hub/HubScreen.test.jsx` drives every registered game from
its hub tile into local setup and back. Two traps it already hit: vitest 3 runs on its
own bundled Vite 7, so the `mode === 'test'` esbuild JSX line in `vite.config.js` is what
makes JSX compile at all, and vitest loads `.env.local` (production Firebase), so a
component test must `vi.mock('shared/services/firebase')` before anything mounts.

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
available, Component }`) plus one line added to that array. `Component` receives a single
`onExit` prop and owns everything from there.

**`Component` is always `lazyGame(() => import('./<Game>Game'))`, never a static import.**
Everything else on the descriptor is the menu and stays eager; the game's code downloads on
demand, so the hub paints after ~66 KB gzipped instead of the whole arcade's ~300 KB. A new
game that imports its component statically pulls itself — and anything only it uses — back
into the hub's startup bundle, and nothing fails to say so. The mechanics (idle preload,
the loading screen, the reload-not-reset error) are in `src/hub/CLAUDE.md`.

Each game's top component (`<Game>Game.jsx`) is just a local/online mode picker: it holds
`mode` and renders `shared/components/ModePicker.jsx` with its own descriptor (imported from
`./index`) and tagline. **Build a new game's picker from that component, not from another
game's file** — the seven were hand-copied once and differed only in colour and tagline.
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
the card check, hidden-role patterns, fame coverage) and `src/games/aniturf/CLAUDE.md` (AniTurf: crossing
goals, the winding-route footing and its detours, the two-device claim). Read the relevant one before changing a game's
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

**The lobby screen follows the same split.** `shared/components/Lobby.jsx` draws what every
`OnlineLobby` drew identically — `RoomCode`, `PlayerRoster` (with the game's own badge as
`badgeFor`, omitted where nothing reads a list), `LobbyImport` and the guest's `HostWaitCard`
— and each lobby keeps its settings, Start gates and Start. The six hand-copied rosters had
already split two ways on how a departed player looks; build a new lobby from these pieces
rather than from another game's file.

**Every setup screen and lobby is the same frame: `shared/components/SetupLayout.jsx`.** A
slim banner in the game's colour (`GameBanner`; `aside` carries the lobby's `RoomCode` or
AniGuess's leaderboard button), players on the left and settings on the right (stacked on a
phone), and a `StartBar` pinned to the bottom of the viewport with one status line — what is
ready, or the first thing that is not. It replaced fourteen single columns with Start at the
very bottom, below the fold on every phone, its reason for being disabled somewhere above
it. A screen supplies `left`, `right` and `start`; the warnings stay in its own `left`.
Players are character-select slots (`shared/components/PlayerSlots.jsx`): `LocalRoster` for
local setup, `PlayerRoster` for a lobby, each wearing a portrait from that player's own list.
**`portraitsFor` shares portraits out across the table** — each player gets their
best-known character nobody seated before them is already wearing — because friends' lists
overlap and two slots in one face read as one person seated twice. **A player can choose the
face instead** (`PortraitPicker.jsx`, from the slot's portrait — any seat locally, only your
own in a lobby — or a row of the hub's profile list): one `portraitKey` (a `characterNameKey`)
on the PROFILE, so it is the same in every game and travels into a room with the profile
(`profileFingerprint` counts it, which is why AniTag's lobby now republishes too). A choice
beats an automatic face; two players choosing one character leaves it with whoever sat first,
and the other's slot says "Taken by <name>". A local setup screen must swap the updated
profile into its seated copies (`LocalRoster`'s `onUpdate`), because those copies are what
Start hands the game. Clearing it back to Automatic deletes the key — RTDB rejects a write
carrying `undefined`. The slots keep the old
controls' accessible names ("Add player", "Remove <name>", "Import <name>'s list"), which the
playtest bots and the tests find them by; keep them when touching the slots.

**Every results screen is the other end of that frame: `shared/components/Results.jsx`.** The
banner turned round (the screen's title — "Final Scores", "Reveal" — is the page's first
heading and the game's name shrinks to a line above it; the playtest strategies tell a results
screen by that heading, so keep each game's), a **`Splash`** panel for whoever the screen is
about, **`Standings`** with a face on every row, the game's own recap below, and the replay
pinned in the same `StartBar`. The splash is the winner on a final screen (`utils/podium.js`'s
`splitPodium`: a tie shares the panel, a table of one is "Finished", not "Winner"), the round's
best on a stop between rounds (AniGuess's `RoundEnd`, AniTag's — which is now a whole screen,
not a card inside the session's), the fake on AniFake's reveal, and the best board on AniRank's.
`ResultsLayout` takes the table in **seat order** and shares portraits with `portraitsFor`, so
a winner wears the face their setup slot did; `shared/components/Portrait.jsx` draws it in both.
The stamp's `stamp-in` is a from-state animation, so reduced motion leaves it simply stamped.

**The in-round screens are built from a handful of shared pieces too, and the faces are the
thread through all of them.** `shared/components/TablePortraits.jsx` shares the table's
portraits out once (`portraitsFor`, seat order) for everything past setup — `RoomShell`
provides it online and each `LocalGame` locally — and `usePlayerPortrait(player)`
(`context/tablePortraitsContext.js`) looks a face up by id, so a player wears the same
character in the turn strip, on the handoff, on the results screen and in their setup slot.
On top of it:

| piece | is |
| --- | --- |
| `Handoff` | pass the device: the next player's portrait panel, name slab, the game's own button words |
| `PlayerRow` | the table as a row of faces, NOW (purple, whose-turn) on the active one, score and a status mark under each |
| `RoundHeader` | the round's heading in display caps, an ink tab ("Turn 3", "Song 2/10"), a hint, the clock inside it |
| `ResultImpact` | a right/wrong landing: speed lines and a ✓/✗ block for 750ms, plus its sound |
| `SpeechBubble` | a question or a name as a manga balloon |
| `PlayerFace` | one player's face at row size, beside (never instead of) their name, found by id |

`PlayerFace` goes on **rows only**, by decision: not inside a running sentence ("Liam got
it!" — busy), and never beside a character card (AniGuess's who-is-who), where a player's
face — itself a character — reads as part of the answer.

`ResultImpact` follows the sound rule exactly — online it fires only for THIS player's result
and plays the sound itself, so the frame and the sound cannot disagree — and it is
aria-hidden and pointer-events-none: decoration over a screen that already says the result,
never a layer that eats a tap. Two things to keep when touching any of them: the headings
and button words are what the playtest bots read ("<name>'s Turn", "Clues", "I'm X — show
me", "Accuse <name>"), and a dimmed player dims their FACE, never the text, which axe flags
under 4.5:1.

All games share one `rooms/{code}` namespace — codes are unique across the whole app, not
per game, so a new game cannot assume it has the code space to itself. A code is claimed by
a `runTransaction` on `rooms/{code}/createdAt`. Codes are 5 chars from an alphabet with
ambiguous `0/O/1/I` removed.

```
rooms/{code}/
  createdAt              claim marker
  open                   accepting joins
  memberUids/{uid}       → playerId   (the membership check every other rule reads)
  claims/{playerId}      → uid        (stops two devices claiming one seat)
  state/                 the subtree the whole room subscribes to (players, turn + score
                         state, presence/{playerId}, view/game phase)
  …                      a game may add its own sub-nodes alongside these
```

That last line is an extension point worth understanding before using it. AniGuess adds
`assignments/{playerId}`, whose security rules **deny** read and write to the assignee's
own device — that rule, not any client-side check, is the mechanism by which a player
cannot see their own character. Anything a player must not learn belongs in a sibling node
gated the same way, never inside `state/`, which every member reads in full.

There are two such nodes, and they are mirror images — pick by who must not see the value:

| node | read | write | for |
| --- | --- | --- | --- |
| `assignments/{playerId}` | everyone **except** the owner | everyone except the owner | a value about you that you alone must not learn |
| `secrets/{playerId}` | the owner **only** | any member | a value only you may learn |

`secrets/` is read by AniFake (the dealt card), AniWave (the hidden target, plus
`readroom`'s dealt card — see `src/games/wavelength/CLAUDE.md` for why the freshness check
is on the stamp rather than on the target), AniTag in `chosen` mode (the clause you picked) and
AniTurf (each team's key and traps, in its clue-giver's node). Write is any member,
not the host, because "the host" is a `state/` value the rules cannot cheaply check, and a
room's members are already trusted with everything in `state/`. AniTag and AniTurf are the
cases where the writer is the *owner* — nobody else could, since nobody else may read it.

**AniTurf goes one step further: the owner also DEALS it.** Each clue-giver's own device makes
its team's key, so no device ever holds a key it was not dealt — not even the host's, for an
instant, as AniFake's does. The price is that only that device can answer for the key, so a
claim is resolved across two devices (the claiming team's clue-giver says footing-or-not, the
other's says trapped-or-not), and a key-dealing effect must wait for the first `secrets/`
snapshot or it deals over the real key on every refresh. See `src/games/aniturf/CLAUDE.md`.

`assignments/` is read by AniGuess (the character you are guessing) and AniTag in `dealt` mode
(the category you are guessing).

**AniTag sits on BOTH rows, one mode each, which makes it the worked example** — and it earned
that by getting it wrong first: this note used to promise `secrets/` to "Categories' secret
category", and it named the wrong node. The question is never "is this a secret" but **who
must not see it**, and the two AniTag modes answer it in opposite directions:

- `dealt` — the clause is known to the whole table and hidden from exactly one person.
  `assignments/`. Written to `secrets/` it would have been visible to precisely the one player
  the mode is built around keeping in the dark.
- `chosen` — the clause is known to exactly one person and hidden from the whole table.
  `secrets/`. Written to `assignments/` it would have been readable by every single player it
  exists to be hidden from, and the round would look normal the entire time.

Ask "who is this hidden from" before reaching for either. Both mistakes are silent.

Three things AniFake learned the hard way, all of which the next `secrets/` consumer
inherits:

- **`secrets/` is a sibling of `state/`, so `useRoomCore`'s subscription never sees it.**
  The game hook needs its own `onValue` on `rooms/{code}/secrets/{myPlayerId}`.
  `useRoom.js`'s `readAssignment` is the precedent — same shape, opposite rule.
- **Stamp each card with the round, don't clear between rounds.** A clear is N writes that
  can half-fail and leave the previous answer readable; a `forRound` stamp makes a stale
  card invisible with no write at all. AniGuess's assignments do the same. A round can now
  be dealt more than once (the card check below), so cards carry `forDeal` as well and a
  device renders its card only when *both* match — the two writes that supersede a card are
  separate and arrive in either order, so one stamp would show the old character during the
  gap. Add a stamp, never a clear, for the same reason each time.
- **Whoever computes the deal learns it.** There is no server, so one device — the host's —
  holds the answer in the clear; keep it out of React state and `state/`. AniFake's bounded
  exceptions (`dealtRef`, `fakeRef`, `secretNamesRef`) are in `src/games/anifake/CLAUDE.md`.

Hidden-role patterns AniFake worked out, each argued in full in `src/games/anifake/CLAUDE.md`
— read it before building anything with a hidden role: **never hand the reveal to one
device** (each device publishes only its own card once the vote closes and the answer is
derived from the published set); **a vote nobody may be seen casting is one shared latch,
not a tally**, and an anonymous control must not change anything a hidden role has a stake
in; **when a rule cannot be enforced where the state lives, make what it protects
worthless**; and **a re-deal creates common knowledge the hidden role lacks — publish the
discard or it is a free detector**.

**A one-shot key must name whatever it is meant to happen once per.** `useRoomCore` clears
`reconciledRef` on a view *change*, so `once('runoff')` is latched for the life of the
`vote` view — which is exactly what caps the runoff at one. A phase that can repeat without
the view changing needs the repeating value in the key (`redeal:${round}:${game.deal}`), or
it fires once and leaves the room wedged. Host migration was the first exception; the card
check is the second. Ask which of the two you are writing before copying either.

Two things that bite every time:

- **Multi-location `update()` rules evaluate against the pre-update tree.** A batch that
  writes `memberUids` alongside paths whose rules depend on `memberUids` existing will
  fail. Write and `await` `memberUids` first.
- **RTDB does not store empty objects/arrays** — a `{}` or `[]` write simply doesn't exist
  on read-back. Every room hook must therefore normalize state at *every* entry point (the
  `onValue` subscription *and* inside transaction callbacks, which see raw stored values)
  before handing anything to `rules.js`, which calls `.includes`/`.every` unguarded.
- **An array with gaps comes back as one of three shapes.** RTDB drops null elements, so a
  partly-filled fixed-length array (AniRank's ten slots) reads back as a *sparse* array,
  or — once it is mostly empty — as an object keyed by index (`{ "5": … }`). Normalizing
  one shape is not enough, and `Array.map`/`forEach` silently **skip holes**, so a sparse
  array needs a plain index loop. `anirank/rules.js`'s `normalizeBoard` handles all three;
  copy it rather than rediscovering this.
- **Rebuilding a keyed collection from the *active* roster deletes departed players' data.**
  The active roster is the right input to readiness gates and the wrong input to anything
  that reconstructs stored state — a normalizer fed active ids drops the absent players'
  entries on the very next write, and their answers are gone by the reveal. Normalize
  against everyone in the room; filter to active only at the gate.

The room a device is in is remembered in localStorage under a per-game key
(`<game>_online_room` — per-game so two games' saved rooms can't clobber each other), so a
refresh rejoins instead of landing on the join screen. Firebase persists the anonymous uid,
so the membership rules still pass.

**Rooms are deleted, two ways, with no server of our own** (`useRoomCore.js`; the project
stays on the free Spark tier). Each room holds a full copy of every player's profile, so
before this they piled up in the 1 GB forever.

- **The last one out deletes it.** `leaveRoom` removes `rooms/{code}` when every *other*
  player's status is `left` (`isLastToLeave` in `utils/presence.js`). A player who is only
  `gone` or `dropping` crashed rather than left and may still refresh back in, so their room
  is kept. The delete goes after the presence write and after `exitRoom`, so the leaver's own
  subscription never reports "That room no longer exists".
- **The next create sweeps anything a day old.** Nothing may list `rooms/` (a read there
  cascades into every room's `secrets/`), so `createRoom` also writes
  `roomIndex/{createdAt}_{code} → code`, and the index's rules allow exactly one query: keys
  older than a day, `orderByKey().endAt(...)`. **The key carries the time as a 13-digit
  string because the rules cannot gate a number**: measured on the emulator, any rule
  comparing `query.endAt`/`startAt` to a number is refused (`query.endAt > 0` included), while
  string comparison works and equal-length digit strings sort like the numbers. The rules
  also check the key against `rooms/{code}/createdAt`, so a live room cannot be filed as a
  stale one to get it swept, and live codes stay unlistable. `createdAt` is stamped in
  SERVER time (`serverOffsetRef`), since the rules age it against the server's `now`.

`rooms/$code/.write` allows a DELETE only — by a member, or by anyone once the room is a day
old. Any member deleting the room is a wider permission than before, taken knowingly: any
member could already wipe `state/`. A presence `onDisconnect` that fires into a deleted room
is refused (the `state/` rule needs `memberUids`, which went with the room), so it cannot
leave a stub behind. Rooms created before the index existed have no entry and were removed
once by hand after the rules deploy. `smoke/cleanup.smoke.test.js` covers all of it.

**Invite links** (`shared/utils/inviteLink.js`): `/?game=<id>&join=<CODE>`. The game rides
along because codes are app-wide and a room does not record its game. `HubScreen` reads it
once, strips it with `replaceState` (so a refresh does not rejoin), skips the title screen and
opens that game; `shared/context/inviteContext.js` carries it in — and also carries the open
game's id, which is what the lobby's **Share invite** button (`Lobby.jsx`'s `RoomCode`;
`navigator.share`, else the clipboard) builds a link from. `ModePicker` routes straight to
online once (`routed`, so Back to the cover does not bounce forward), and `RoomSetup` joins
once there is a profile and `room.uid` is set — the point at which `useRoomCore` has already
restored any saved room, which then wins; leaving it brings the invite back. With no profile
it opens the picker first.

### Play history

Every finished game is a line in `aniarcade_history` (`{ [profileId]: Entry[] }`, newest
last, capped at 200 per profile; `shared/utils/history.js` is the pure, tested half). Each
game's FINAL results screen calls `useRecordResult(gameId, players, winnerIds, { places,
scores })` once — never a between-rounds `RoundEnd`, which would count a game several times.
A tie at the top is a win for each; a table of one is never a win; `winnerIds = []` is a game
nobody won (an unscored AniRank round) and `null` records nothing (an AniFake round with no
fake). AniTurf and AniFake record a side's win: the whole winning team, or the fake (walking
or a correct steal) against everyone else.

**Whose line it is comes from `HistoryScopeContext`.** `RoomShell` provides `{ onlyId:
myPlayerId }`, so online each device records only its own player; locally there is no scope
and every seated profile is recorded, since they are all on this device. **A results screen
can mount twice for one game** (a refresh, AniGuess's leaderboard → list → back), so the same
fingerprint (game, table, winners, places, running totals) within 30 minutes is dropped.
There is no provider: the readers, the hub's `RecordStrip` and `RecordScreen`, mount with the
menu, and the menu is never on screen while a game writes. The key is in `PRESERVED_KEYS` — it
is the player's and cannot be rebuilt.

**Each line also carries everyone else's result** (`others: [{ name, place, won }]`), which is
what the record screen's head-to-head counts. It arrived after the first lines were written,
so it is ABSENT on those: they count as games together with no winner between the two of you,
never as a guess at one. `recordDetail`'s `compare` ranks by places where both have one, else a
win over a loss (AniFake places nobody), and two unplaced losers are no result at all — not a
tie, which is something you played for. Friends group by `profileIdFromName` of the name, the
fold a profile id already is, so the same person met locally and online is one row. The
screen opens from the strip (the main profile) and from every row of the profile picker,
because every profile seated at a local game on this device has a record; see
`src/hub/CLAUDE.md`.

### Presence and the departed-player problem

`src/shared/hooks/usePresence.js` keeps one record alive at
`state/presence/{playerId}` using Firebase's `onDisconnect` (server-side, so no
`beforeunload` handler or heartbeat). `src/shared/utils/presence.js` is the pure half:
`rosterSnapshot` classifies each player as active / dropping / gone / left against a
20-second `GRACE_MS`, using *server* time (`Date.now() + serverTimeOffset`) so all devices
agree on the boundary.

This matters because every readiness gate ("everyone is ready", "everyone has answered",
"everyone is locked out") counts the roster — a closed tab would wedge the room forever.
Rules functions therefore take `skipIds` or an already-filtered *active* roster, and there
are dedicated escape hatches (`skipDepartedTurn`, `releaseBuzz`, `revealNow`,
`nextHostId` for host migration). Preserve this when adding room logic.

The commonest departure is not a closed tab but a phone that locked itself mid-round, which
drops the connection exactly as one does. `shared/hooks/useWakeLock.js` keeps the screen on
for as long as any game is open — one call in `HubScreen`, lobby and local play included — and
asks again each time the page comes back, since the browser releases it on every hide. Every
failure is silence; a browser without the API simply dims as before.

### Game settings

Every game's remembered options live in `games/<game>/prefs.js` as a single `DEFAULT_PREFS`
literal, read through `shared/hooks/useGamePrefs.js` and stored in **one** arcade-wide key
(`aniarcade_game_prefs`, a `{ [gameId]: {...} }` map) — unlike the per-game keys that hold
state one game owns (`<game>_online_room`, `anirank_custom_prompts`).

`DEFAULT_PREFS` **is the schema**, not just a fallback: `mergePrefs` drops unknown keys and
type-mismatched values against it. Two consequences that are easy to get wrong:

- **`writePrefs` merges a partial**, and that is load-bearing rather than tidy. Setup screens
  and online lobbies are near-twins but not identical (AniFake's lobby has no talk mode), and
  a lobby that replaced the slice would wipe the options only local play can reach.
- **Adding a key changes behaviour for existing players**, because `mergePrefs` fills missing
  keys from the defaults on the next read. A new option defaulted to "on" reaches everyone
  who never opens the settings card — usually what you want, but decide it rather than
  discover it.

**Every game's settings card is one component rendered by both screens** —
`AniGuessSettings`, `AniFakeSettings`, `AniRankSettings`, `AniTuneSettings`,
`AniTagSettings`, `WavelengthSettings` and AniQuiz's `QuizSettings`, each beside its game's
setup screen. They were hand-kept copies first, and every pair had drifted somewhere
(AniWave's reset link sat inside the card online and under Start locally; AniGuess's two
screens listed the same options in different orders). A local-only or online-only option is a prop on the card (`local`,
`online`), never a second copy of it. Each card reports changes as one `onChange(key, value)`
because the lobby's settings object *is* what leaves the host's device, and a setter per prop
puts the drift back one level down.

Adding an option means: the key in `prefs.js`; the control in the game's settings card; the
key in **both** screens' settings object, seeded from `prefs` (the lobby's object is what
reaches `startGame`, so a key missing there never leaves the host's device); and — only if
the *rules* act on it — a copy onto the round node in the room hook with a `!== false`-style
back-compat default in `normalizeGame`. AniRank keeps separate `useState`s, because an axis
change resets `blind` and the state has to live beside the axis it is coupled to. An option
that only decides which screen renders (`talkMode`) or how a pool is drawn (`sharedOnly`,
`fame`) stays out of round state.

Anything derived from a pref that is worth testing belongs in a `.js` module, which is why
`prefs.js` and `fame.js` are separate files from the screens that read them. A component test
*could* reach it through the screen now (see Commands), but only by mounting that whole
screen under jsdom just to check one derived value. A pure `.test.js` checks it directly.

Setting notes, the "More settings" fold and `DetailToggle` have rules of their own —
`shared/components/SettingHelp.jsx` is the only place a note is styled, and a warning never
goes inside a fold. See `.claude/rules/settings-cards.md`.

### Profiles and identity

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

### Backup codes: the same profiles on another device

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

- **The save is ONE JSON string, not an RTDB tree.** That dodges every trap above at once —
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

**"New profile" is the import.** `ListImport` with `profile={null}` makes the profile, named
after the account (editable; required for a file), merging into a saved profile the name folds
onto instead of minting a second one, and creates nothing until Done. "Just a name, no list"
is the old box, for a guest with no tracker.

### List sources: any tracker, one profile shape

AniList, MyAnimeList, Kitsu or a MAL-format file all produce the same profile shape: another
site only says WHICH shows; everything else is hydrated from AniList, so no game or room hook
knows sources exist. The details — and why building from MAL's own data silently breaks a
mixed room — are in `.claude/rules/list-import.md`.

### Fact packs: the answers a profile cannot derive

`public/facts/` serves a generated pack (`npm run generate:facts`) of answers a profile cannot
derive. AniQuiz reads it; AniRank, AniTune and AniFake read its stats only through
`usePackBackfill`. A missing entry is normal, never a failed load, and a pack key is the same
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
the fact pack under `/facts/`, the fonts, the prints under `/art/`, and the UI sounds under
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
`.claude/rules/styling.md`, which loads with any `.jsx`/`.css` file):

- On paper every solid fill is a dark ink carrying `text-paper`; `text-ink` is right only on
  a light fill. A right/wrong is never colour alone (`Mark`, `ResultImpact`).
- No emoji on screen — `shared/ui/icons.js` is the one icon set. Neutral colour is a role
  (`fg-*` tokens), never an opacity: never write `white/N` or `text-white`.
- Viewport heights are `dvh`; never `min-h-screen`. Animations are from-state, and never a
  `transform` on `Screen` (it breaks `fixed` descendants).

### Generated files — don't read these

`generateProfiles.js` (Node, `npm run generate`) queries AniList through
`.anilist-cache/` and writes `seedProfiles.js` — not an app module, but a script you paste
into the browser console to seed `aniguess_profiles`. It is generated, eslint-ignored, and
must not be hand-edited.

It also must not be *read*. `seedProfiles.js` is the trap here: a root-level `.js` file
that looks like source but is one enormous repetitive JSON blob, and a default 2000-line
`Read` of it burns roughly 22K tokens to show you 9% of it. Same for its inputs and the
lockfile:

| Path | Rough size | What it is |
| --- | --- | --- |
| `seedProfiles.js` | ~22K lines / ~950 KB | generated console seed script |
| `.anilist-cache/` | ~130 files / ~1.7 MB | raw AniList API responses (gitignored) |
| `.facts-cache/` | grows with the catalog | same, for `generateFacts.js` (gitignored) |
| `public/facts/pack-v5.json` | ~72K lines / ~1.7 MB | generated fact pack |
| `package-lock.json` | ~13K lines / ~460 KB | npm lockfile |

None of them carries architectural information. `Grep` them for a specific key when you
genuinely need one, exclude them from repo-wide searches, and never `Read` them wholesale.

Two root-level files near these are **not** generated and are meant to be edited by hand:
`animeCatalog.js`, the show list both generators read (it was lifted out of
`generateProfiles.js` so there would be one copy), and `facts/overrides.json`. Neither is
large. For the pack's shape, read `shared/utils/facts.js` rather than the pack itself.

## Conventions

Comments here explain *why*, and heavily so — most are hard-won API, Firebase, or
accessibility findings that would be re-broken without them. Match that density rather
than stripping it. ESLint treats unused vars as errors, with `varsIgnorePattern: '^[A-Z_]'`.
