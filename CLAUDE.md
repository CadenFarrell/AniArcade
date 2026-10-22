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

Tests:

```bash
npx vitest                                     # watch mode
npx vitest run src/games/aniguess/rules.test.js # one file
npx vitest run -t "advances the turn"           # one test by name
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

`smoke/` is the online half, and it is kept out of `npm test` on purpose: it needs an
emulator and sits out the 20s `GRACE_MS` again and again. It has its own
`smoke/vitest.config.js`, and `test:smoke` wraps it in `firebase emulators:exec`, so each
run gets a fresh database. `harness.js` mounts the game's REAL online hook once per
simulated device with `renderHook`. Before each mount it runs `vi.resetModules` and
`doMock`s the firebase service, giving every device its own named app and anonymous uid.
It also gives each device in-memory storage. So the security rules see N separate
members, and a refresh restores that one device's saved room. `crash()` is a closed tab:
`goOffline`, so the server runs the `onDisconnect` write, then an unmount that runs no
exits. Write scenarios against the hook's return value, the way `OnlineGame.jsx` drives
it. Never `await` an `act()` that might not resolve: it holds every React update in the
process.

Playtest bots (`playtest/`, also `/playtest`) play every game, start to results, through
the real screens:

```bash
npm run playtest                                   # local, jsdom, every game × 20 seeds (~4 min)
npm run playtest -- --game anitag --seed 7 --debug # replay one run exactly (--debug screens: dump each screen)
npm run playtest -- --layer online                 # devices in one room on the emulator (reuses a running one)
npm run playtest -- --layer browser                # Playwright: phone + desktop, axe, layout, drag, online
npm run playtest:all                               # all three, then the report
```

Each run writes `playtest-report/` (gitignored): `summary.md`, `index.html`, screenshots,
and a replay command per failure. Three things to know before touching it:

- **One bot brain, every layer.** `core/snapshot.js` reads a screen into
  `{ heading, text, controls }` (it must stay self-contained — Playwright ships its source
  into the page), `core/driver.js` plays one shared screen (local), `core/table.js` plays
  one screen per device (online), and `strategies/<id>.js` say what to press. Strategies
  are screen-driven, so one file serves jsdom, Chrome and online. A new game needs one, or
  its playtest fails on purpose.
- **A seed is a replay.** The bot's choices, the game's `Math.random` and (locally) a fake
  clock all come from it, and every app module is re-evaluated per run — module state
  leaking between seeds once made AniRank deal different cards in a sweep than alone.
  Online runs replay the table, not the network timing.
- **"stuck", "no-progress" and "loop" usually mean the STRATEGY no longer matches a
  screen** — a renamed button, a new step. Replay with `--debug screens` and check
  whether the game offered a way forward before calling it a game bug. Crashes, console
  errors, `NaN`/`undefined` on screen and devices disagreeing on a result are the game.

`playtest/fixtures/profiles.json` is cut from `seedProfiles.js` with pack stats filled in
(`npx vite-node playtest/fixtures/build.js` regenerates it); AniTune runs against a canned
AnimeThemes (`fakes/`). The browser layer builds to `dist-playtest*` and serves on
4198/4199 (the next free pair when those are taken; `--workers 1` if memory is short) —
never `dist`, never 5173.

Firebase (online rooms only):

```bash
npx firebase emulators:start --only database,auth --project demo-aniguess
npx firebase deploy --only database    # database.rules.json
npx firebase deploy --only hosting     # dist/ — run npm run build first
```

The CLI is `firebase-tools` in devDependencies, not a global install, so a bare `firebase`
in a shell is "command not found". npm scripts are the exception — they put
`node_modules/.bin` on the PATH, which is why `test:smoke` can call it bare.

MyAnimeList proxy (MAL imports by username only — see "List sources" below):

```bash
cd workers/mal-proxy
npx wrangler dev --port 8788            # local; needs MAL_CLIENT_ID in .dev.vars
npx wrangler secret put MAL_CLIENT_ID   # one time, from myanimelist.net/apiconfig
npx wrangler deploy                     # then set VITE_MAL_PROXY_URL and rebuild
```

`wrangler` is a devDependency for `firebase-tools`' reason. It runs on Cloudflare Workers'
free tier, which takes no card — the project stays off anything billable.

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
`src/games/aniquiz/CLAUDE.md` (AniQuiz) and `src/games/aniturf/CLAUDE.md` (AniTurf: crossing
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

| piece | is | used by |
| --- | --- | --- |
| `Handoff` | pass the device: the next player's portrait panel, name slab, the game's own button words | every local pass screen; AniGuess's look-away |
| `PlayerRow` | the table as a row of faces, NOW (purple, whose-turn) on the active one, score and a status mark under each | AniGuess `TurnTracker`, AniQuiz `Scoreboard`, AniTag `SeatStrip`, AniTune's scores, AniFake's clue order, AniRank `RankSeats` (✓ placed / locked in, the subject), AniWave `WaveSeats` (the psychic, ✓ dial in — never where; on its online waiting screens too), AniTurf `TeamStrip` (one row per team, the clue-giver crowned) |
| `RoundHeader` | the round's heading in display caps, an ink tab ("Turn 3", "Song 2/10"), a hint, the clock inside it | every round screen with a heading of its own |
| `ResultImpact` | a right/wrong landing: speed lines and a ✓/✗ block for 750ms, plus its sound | AniGuess's guesses, AniTune / AniQuiz reveals, AniTag's turn end, AniTurf's claims |
| `SpeechBubble` | a question or a name as a manga balloon | AniGuess's question, AniTag's name under judgement, AniTurf's clue |
| `PlayerFace` | one player's face at row size, beside (never instead of) their name, found by id | the rows of reveals and logs: AniQuiz's and AniTune's answer rows, AniWave's "This round", AniTag's round summary, name trails and last play, AniFake's clue log, AniRank's compare grid and publish list, AniTurf's teams card and clue log |

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
  holds the answer in the clear. `dealRoles` returns it and `startGame` destructures only
  what the check phase needs, so the secret character never reaches React state or the room.
  There are **two** exceptions, both deliberate, both bounded the same way — host device
  only, never React state, never `state/`, cleared the moment the view leaves `check`, lost
  entirely by an incoming host on migration — and both gated on `allowRedeal`, so a table
  with the card check off keeps the one-function-call ceiling:

  | ref | holds | so that |
  | --- | --- | --- |
  | `dealtRef` | the folded names dealt this round | a re-deal can't hand back the card the table just rejected |
  | `fakeRef` | **who the fake is** | a re-deal keeps them in the role (`dealRoles`' `pinFake`) |
  | `secretNamesRef` | each secret in display casing | the next deal can publish the discards (see below) |

  `secretNamesRef` is not a third concession: `dealtRef` already holds the same characters
  folded, and a folded name *is* the name. It is separate only because `dealtRef` also carries
  decoys and feeds an id comparison.

  `fakeRef` is the larger concession and should be read as one: `dealtRef` holds a character
  that in blind mode is already printed on the host's own card, while this holds a fact no
  player is ever meant to learn. It is taken because without it the re-deal answered two
  different things — a bad draw, and *a role you didn't want* — and since nobody is told who
  asked, a fake could veto their way out undetectably. Every serverless alternative was
  worse: `secrets/{playerId}` is read-gated to its owner so the host can't recover last
  deal's fake from the room; a public seed or a `state/` field publishes it to everybody;
  per-device role bits still leave the host deciding who gets a null character; and choosing
  the fake only when the check ends means the fake spent the check holding the secret.
  Moving the deal into a Cloud Function is the real fix, and it is the fix for both.

**Do not hand the reveal to one device.** The obvious design makes the host publish the
answer key at the end; it breaks when the host *is* the hidden role and breaks worse when
they leave mid-round. AniFake instead has every device publish only *its own* card once the
vote closes (`state/game/reveal/{playerId}`) and derives the answer from the published set —
so nothing about the secret exists in `state/` until it is over, no device is trusted with
more than it was dealt, and a player who left is identified by elimination rather than
wedging the room. See `anifake/rules.js`'s `publishCard` / `deriveTruth`.

**A vote nobody may be seen casting is one shared flag, not a tally.** AniFake's pre-clue
card check lets anyone ask for a fresh character, and the fake — who in blind mode holds no
character at all — must not be forced to bluff about a card they cannot see. So `state/`
records only *that* someone responded (`check/responded/{playerId}`, identical for a
confirmer and an asker) plus one owner-less `check/asked` boolean every asker writes the
same `true` to. There is no count, no array, no per-player value: the property is that the
information does not exist, not that no screen renders it. The hook then returns a phase
*string* rather than `asked`, so a component cannot leak the correlation by accident. Copy
all three parts — no per-player record, one shared latch, a derived phase at the hook
boundary — for any hidden-role decision the room has to make collectively. Two limits worth
stating out loud rather than papering over: a member watching raw RTDB can correlate the
latch flipping with whoever responded just before it, and at three players a confirmer who
sees a re-deal knows one of the other two asked. Say "nobody is *told* who asked".

And note what that anonymity costs on the other side, because it is the half that got missed
first: a control nobody can be seen using is a control nobody can be held to, so it must not
change anything the presser has a stake in. The re-deal used to pick a new fake as well as a
new secret, which made one anonymous button answer both "this card is unplayable" and "I
don't want this role" — so the fake could veto their way out, undetectably, for free. Hence
`dealRoles`' `pinFake`. Give any anonymous action the same audit: list what it changes, and
check that none of it is something a hidden role would want changed.

**The blind fake cannot ask at all, and that gate is client-side by necessity.** They hold no
character, so there is nothing for them to fail to recognise, and a fake who pressed it could
be asked afterwards to justify not knowing a card they never saw — the very thing the shared
latch exists to prevent. `state/` never records who the fake is, so `rules.js` cannot enforce
this and `respondToCheck` still accepts `asked: true` from anyone; both screens gate on
`card.isFake` instead (only ever true in blind — the decoy fake keeps the button, since a
missing control on a card they are never told differs would be the tell that mode forbids).
**`pinFake` is what makes a presentational gate sufficient**: a hacked client that asks anyway
is re-dealt and is still the fake, so defeating the check wins nothing. When a rule cannot be
enforced where the state lives, make the thing it protects worthless instead.

One consequence, recorded rather than designed around: once the fake cannot ask, "I asked for
the re-deal" becomes a claim of innocence — and an unfalsifiable one, since several players
can ask and the latch merely ORs them, so two people claiming it contradicts nothing. Expect
every fake to claim it, which is why it is worth nothing.

**A re-deal creates common knowledge the hidden role does not share — publish it or it is a
free detector.** The crew all saw the discarded character; the blind fake never did. So
"everyone name the one we threw out" catches them with certainty, costs the table nothing, and
has nothing to do with how they played — a detector the card check *invented*, absent from any
round with no re-deal, and one `pinFake` sharpened (before it, a re-deal re-rolled roles, so
the new fake had often seen the discard). The fix is to stop it being secret: `dealRoles`
stamps every card with `discarded`, the fake's included, and `SecretCard` renders it in both
branches and in `compact`, since the clue phase is when a table would ask. Giving it away costs
nothing — a character that is definitively *not* the answer, out of hundreds. Decoy mode cannot
have this: its fake discarded a *different* character, so one shared list would tell them their
card differs. That mode keeps the detector and only copy can help it. Whenever a hidden-role
game lets state be replaced mid-round, ask what the discard proves.

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
There is no provider: the one reader, the hub's `RecordStrip`, mounts with the menu, and the
menu is never on screen while a game writes. The key is in `PRESERVED_KEYS` — it is the
player's and cannot be rebuilt.

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

**A setting's note comes in two tiers, and `shared/components/SettingHelp.jsx` is the only
place either one is styled.** Every setup screen and lobby used to hand-place a `<p
className="ml-10 text-base text-white/50">` holding both halves at once; four games' worth
of that put a two-to-four line paragraph under every single-line control, so a settings card
ran roughly three times taller in prose than in controls and read as a wall rather than as
help. None of the copy was deleted — several paragraphs carry rules the table actually needs
— the *why* simply stops being the first thing on screen. The split is nearly always where
the existing paragraph already broke: its opening sentence names the behaviour and the rest
argues for it. Pass the first as `children`, the second as `more`.

The weight was the other half of the problem. Helper copy had drifted to three treatments
across the games (`text-base text-white/50`, `text-sm text-white/50`, `text-sm
text-white/30`), and with no consistent signal for "this is the secondary line" the volume
read as noise instead of hierarchy. Everything routes through here now, at two weights only.

**The options most tables never change fold under "More settings"**
(`shared/components/MoreSettings.jsx`), inside the card they belong to: AniTune's clip and
pool details, AniGuess's randomizer and points, AniFake's pool and fame, AniTag's names-per-
round and own categories, AniQuiz's extras, timer and category switches. AniRank and AniWave
fold nothing — their cards were already short. Two rules: **a warning never goes inside a
fold** (a banner about a folded-away setting is a problem with no visible cause, so banners
sit after it), and the open state is one arcade-wide key, `aniarcade_more_settings`, for
`aniarcade_setting_detail`'s reasons (it belongs to no game; not in `PRESERVED_KEYS`). Folded
controls are `hidden`, so a test or bot that changes one has to open the fold first —
`openMoreSettings(user)` in `shared/testing/arcade.jsx`, which opens only closed folds,
because the remembered state carries from one test to the next.

**`DetailToggle` goes on a card only when that card has something to reveal**, and on every
such card rather than once per screen — two of them a few hundred pixels apart is mild
redundancy, while a card full of quietly-truncated notes whose control is somewhere above
the fold is a feature nobody finds. AniTune's second card is every-note-one-line and so
carries no toggle rather than an inert one.

**Both halves fail soft, deliberately.** `useHelpDetail` returns `{ detail: false, setDetail:
null }` outside a provider instead of throwing, and `DetailToggle` renders nothing at all
there rather than a control that does nothing. This is presentation only, and its consumers
are leaf components scattered across every game's setup screen — exactly the population most
likely to end up in a future screen nobody remembered to wrap.

AniFake and AniRank keep their copy in a `help.js` beside `prefs.js`, being long enough that
inlining buried the controls in JSX; AniTune and AniGuess inline theirs. **The preference is
arcade-wide and gets its own localStorage key** (`aniarcade_setting_detail`), not a slot in
`aniarcade_game_prefs`: that map is `{ [gameId]: {...} }` and each game's `DEFAULT_PREFS`
*is* its schema, so there is nowhere in it for a value belonging to no game. Off by default,
which is the point of the split — the short line is what a returning player should meet. It
is deliberately absent from `resetKeys.js`'s `PRESERVED_KEYS`: a crash reset clearing a
cosmetic preference is the right outcome, and the default it falls back to is the quiet one.

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

Character `favourites` needs more care than the show-level stats, and AniFake's
`utils/pool.js` is the worked example. `collapseCharacters` writes `favourites ?? 0`, so
missing and genuinely-zero are the *same value* by the time anything reads it. **An
unmeasured character therefore reads as "nobody has heard of them" rather than "we don't
know", and there are three coverage cases, not two:**

| coverage | what a naive quantile does |
| --- | --- |
| none | median is 0, `fav >= 0` admits everybody — the setting does nothing |
| **partial** | ranks the measured few, so "top 15%" becomes 15% *of the imported fifth* — the round deals the same three characters forever, and nothing looks wrong |
| full | correct |

The partial case is the dangerous one because a signal technically exists, so any
`some(fav > 0)` check reports healthy. `fameFloor` handles all three in one place: it ranks
**only the entries carrying a positive count**, and returns `null` both when none do and when
fewer than `MIN_FAME_COVERAGE` of the pool do. One null, one degraded path — the fame term
zeroes out and the role ladder runs, which is why the bias must stay a *preference* (a
weighted score, never a filter). `hasFameSignal` is defined as `fameFloor(pool, 0) != null` so
the screens and the pick cannot drift about what "no data" means.

**A re-import only repairs a saved character because `addOrBackfillCharacter` makes it, and
that is recent.** Until it existed the merge early-returned on any character whose folded name
was already stored, so the fetch pulled correct data and dropped it — every field of a saved
character was frozen at its import vintage forever, and profiles imported before `favourites`
existed could never gain it no matter how many times you re-imported. The backfill follows
`backfillStats`' rule (fill absent fields, never overwrite one already there, `== null` so a
real `0` counts as an answer) and returns a NEW object, because
`mergeAnimeIntoProfile`'s `characters: [...a.characters]` is shallow — the character objects
are still the ones `ProfileProvider` holds in React state.

Repairs are counted as `updatedChars`, apart from `addedChars`: a repair run on a list you
already have adds nothing, and a screen reporting "+0 characters" reads as a failed import.
`classifyImportGroups` gains a matching `'stale'` state — every member fetched, but no saved
character carries `favourites` — so the checklist suggests exactly those shows instead of
calling them `known` and hiding them. Key it on "**none** of the cast has it", never "any lacks
it": a fetch returns only MAIN plus SUPPORTING above the favourites threshold, so a supporting
character under it can never be filled and "any" would re-suggest that show forever.

A secondary effect worth knowing when coverage still looks patchy after a repair: `preferred`
only falls through to `favourites` when portrait and genres tie, so across players a
re-imported copy can still lose to an older one.

Two things the screens must then say, because neither is inferable from the pick:
`hasAnyFameData` (ungated) separates "never fetched" from "fetched patchily" — only the second
is worth importing for — and `famousCount` reports what the level actually leaves, since a
level can be perfectly valid and still narrow a small shared list to two characters. Warn,
never gate: a small famous set is a real answer to what the user asked for, and silently
overriding a setting someone just picked is what makes one feel broken.

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

**Nothing on a list is typed in by hand any more.** ListManager used to take a free-text
show title and a character form (name, hair colour, ability, one genre). A made-up character
had no portrait, no `favourites` and no AniList id, so the hub tiles skipped it, AniFake's
fame setting ranked it unknown, the fact pack could not cover it, and nobody else at the
table could recognise it; a typed show had no cast or stats at all. Both were replaced by
`shared/components/AnimeSearch.jsx`, which searches AniList (`searchAnime`) and adds the real
show through `shared/services/importGroups.js`'s `buildImportedAnime` — the same cast fetch and
filter `ListImport` runs, so a searched show and an imported one cannot differ. A cast is not
editable either — the tracker is where a list changes, then Refresh — and the one edit left
is **deleting a whole show**, which stays because a refresh only ever adds
(`mergeAnimeIntoProfile` never removes): without it a show dropped on the tracker, a searched
show added by mistake or an old hand-made entry could never leave a profile. Hand-made
entries already saved are left in place (the `aniguess_profiles` rule) and every reader of
their shape stays, `CharacterReveal`'s hair and ability rows included; don't add a hand-entry
or cast-editing path back.

### List sources: any tracker, one profile shape

A player imports from **AniList, MyAnimeList, Kitsu, or a MAL-format export file** (which
Kitsu, Simkl and most other trackers can write), and every game works from any one of them —
including a room where each player used a different site. `shared/components/ListImport.jsx`
is the one screen; `shared/services/listSources.js` the network half; `shared/utils/listImport.js`
the pure, tested half.

**The invariant: another site only ever says WHICH shows you watched. Everything else comes
from AniList.** Each source reduces to AniList or MAL ids; `fetchMediaByIds` (`anilist.js`)
hydrates them through AniList's `id_in` / `idMal_in` in pages of 50; and every path — the
AniList list query included — builds its entries with the same `toListEntry`
(`anilistFormat.js`). From there it is the unchanged import: `groupIntoFranchises`, the
checklist, the character fetch, `mergeAnimeIntoProfile`. So a MAL player's profile is the
same shape as an AniList player's, down to the `anilist_anime_<id>` ids AniTune's exact
AnimeThemes lookup needs, and **no game or room hook knows sources exist.** That is what makes
a mixed room work, and it is worth knowing why the obvious alternative fails: every
cross-player match in the arcade is by fold (`franchiseTitleKey`, `characterNameKey`), and
MAL's own data does not fold to AniList's — different English titles, character names
written "Last, First", scores out of 10. Built from MAL's data, a MAL player and an AniList
player would share no shows at all, and nothing would look broken.

Shows a site lists that AniList has no entry for are **counted, not dropped silently**
(`unmatched`), and the screen says how many — a list that comes back shorter than the one on
the site reads as a failed import otherwise. Kitsu prefers its `anilist/anime` mapping and
falls back to `myanimelist/anime`; an entry with neither is unmatched.

**MyAnimeList's API sends no CORS headers** (measured: no `Access-Control-Allow-Origin` on
any response, a 405 on the preflight), so no page can call it. `workers/mal-proxy` is a
one-route Cloudflare Worker that does, with the client id as a secret, and answers with MAL
ids and statuses only. With `VITE_MAL_PROXY_URL` unset — a fork, or before the worker is
deployed — the MAL tab asks for the export file instead, and a proxy that cannot be reached
offers the file from the error screen. Kitsu sends `Access-Control-Allow-Origin: *` and needs
nothing.

**Where a list came from is `listSource: { site, username? }`**, read through
`listSourceOf`. Profiles from before it carry only `anilistUsername`, and that key is still
read (and still written for AniList) rather than migrated — the `aniguess_profiles` rule.
`anilistImportedIds` and `anilistImportSettings` keep their names because they are still
true whatever the source: the ids are AniList's after hydration, and the settings drive
AniList's character fetch. Every Refresh button gates on `canRefreshList`, so a file-based
profile (nothing can re-read a file the player has not chosen again) and a MAL profile with
no proxy never offer a one-tap refresh that would only open an upload box.

### Fact packs: the answers a profile cannot derive

Every game above computes its own answer key on the device — `valueFor` reads a stored
field, `trueOrder` sorts it, `scoreBoard` grades against it. "Who directed this" is not a
function of anything a profile holds (see the table above for how narrow a profile actually
is), so a quiz-style game cannot work that way: **the answer has to ship with the
question.** `generateFacts.js` (Node, `npm run generate:facts`) writes a pack, `public/facts/`
serves it as a static file, `shared/services/factPack.js` loads it, and
`shared/utils/facts.js` holds every pure part of it.

**The pack is populated — 680 shows, 2948 characters, 26017 facts per `index.json` (v5) — and
AniQuiz is its main reader** (see `src/games/aniquiz/CLAUDE.md`); AniRank, AniTune and
AniFake read its stats only through the profile backfill below. A consumer must still treat
a missing entry as normal rather than as a failed load: most of what a player imports will not
be among 680 shows, and `factsFor` falls closed on an empty key list for exactly that case.

`pack-v2` added **`popularityRank`** (1 = AniList's most popular), stamped from the discovery
list's own order — the `anilist-popular-p*.json` pages already in `.facts-cache/`, so adding it
needed no fetch. It is pricing data, not clue material. A catalog show outside the top N has
no rank, and a reader must treat that as *obscure*, never as *unknown and therefore easy*.
v1 was deleted rather than kept beside it: nothing had ever read it.

`pack-v3` pages the staff list. `MEDIA_QUERY` fetches 20 staff entries by relevance, and on
a big production those are all directors and designers — Frieren's "Music" credit is entry 26
— so v2 had no composer for one show in five, Demon Slayer and Spirited Away included.
`allStaffEdges` in `factSources/anilist.js` fetches further pages only while a credit is
missing, at the **same 20 per page** (page 2 at 25 would start at entry 26 and skip 21–25), and
roles are matched trimmed, because some arrive as `"Music "`. Composer went from 79% to 98%
of shows and director from 93% to 98%, with no v2 value changed. Series composition stayed at
79%: the rest are films, or shows that credit their writer as "Script", which is a different
credit and is deliberately not read as one. That measurement is also why no outside source
was added then — the gaps it was meant to fill were ours (v5 added one for new fields). v2 was
deleted: the loader fetches `index.json` with `no-store`, so nothing asks for an old pack by
name.

`pack-v4` fixed accuracy before adding anything, because the measured problems were ours again:

- **Franchises are grouped by AniList relations, exactly as an import groups them.**
  `collect` runs every media through `toListEntry` and `groupIntoFranchises` and keys the
  group on its canonical season's title. v3 folded titles, and titles do not fold reliably:
  a trailing hyphen split Re:Zero, a curly apostrophe split Komi, and Food Wars was six
  subjects — so a sequel could speak for a franchise and a quiz could offer the answer's own
  sequel as a wrong option. A top-level **`aliases`** map sends each member title's fold to
  the canonical key, and `resolveShowKey` (`facts.js`) is the lookup; AniQuiz's
  `buildContext` and `packStats.js` both go through it.
- **Credits match through `STAFF_CREDITS` / `pickCredit` in `facts.js`**, each an ordered
  pattern list, so the matching has tests. `/^director$/` had shipped One Piece, Naruto
  Shippuden and Dragon Ball Z with no director: long-runners credit "Director (eps 1-199)". A
  qualified credit is used only when no plain one exists, and "Animation Director", "ADR
  Director" and "Director of Photography" never match. Staff paging goes to 15 pages, since
  those same long-runners spent all 5 of v3's on per-episode credits.
- **It carries the numbers an import stores** — `popularity`, `averageScore`, `startYear`
  (plus `showFavourites`), folded by `summarizeGroupStats`, so a pack value and an imported
  one mean the same thing. That is what `shared/utils/packStats.js` repairs old profiles
  from: `usePackBackfill` runs from the setup screens and lobbies of AniRank, AniTune and
  AniFake (never the hub — players who never open them never fetch the pack), fills only
  ABSENT show stats, and fills character `favourites` when the stored value is 0 too, because
  the import writes `favourites ?? 0` and a stored 0 is ambiguous. `profileFingerprint`
  counts both, or a repair would never reach a room the profile is already in. Episodes are
  deliberately not backfilled: the pack's is the canonical season (clue material), a
  profile's is summed across seasons.
- **The best-known supporting characters** (favourites ≥ 1000, four per show) arrive under
  **`supportingIn`**, beside `appearsIn`, which **still means MAIN in** — both cast clues say
  "main character", and widening it would make them state something false. See
  `src/games/aniquiz/CLAUDE.md`.
- **The catalog is the top 1000 by popularity**, against v3's 500, and the cache files for the
  changed query and the popularity pages carry a `-v4` suffix, so neither the old fields nor
  the 2026-09-08 ranking could be silently reused.

Measured on the v4 run: 1004 media grouped into 680 shows (Dragon Ball's Z, Super and GT, and
Naruto's Shippuden and Boruto, each fold into their franchise — AniList links them as sequels,
and an import folds them the same way); director 99.9% (was 98%), series composition 82%,
composer 96.8% over a pack half again as large (the newer, less-famous shows are where it
misses), and popularity, score and year 100%. 205 aliases; 239 characters are supporting-only.
A first run over a cold cache takes hours rather than minutes, nearly all of it staff paging
on films that never credit a series composition — a warm cache makes the next one quick.

`pack-v5` is the first with facts from **outside AniList**, and only for things AniList has no
field for at all — every AniList value is byte-identical to v4's. Each outside source is a file
in `factSources/` handed `collect()`'s franchise groups (`meta.groups`: key, member AniList ids
canonical-first, source), looks them up **by AniList id** — never by title — and returns rows;
`generateFacts.js` appends them after AniList's, so first-write-wins means an outside value
only ever fills a gap and can never create a subject. What a response *means* lives in
`shared/utils/outsideFacts.js`, with tests; the adapters are just network and cache.

- **`themes`** — openings and endings from **AnimeThemes** (`factSources/animethemes.js`), the
  API AniTune already plays from, matched through the AniList id it stores as a "resource".
  `{ type: 'OP'|'ED', song, artists? }`, at most 4 openings and 2 endings per franchise,
  canonical season first; `artists` is absent when AnimeThemes has no performer linked (397
  of 2022 themes), which rules a song out of the who-sings-it clues but not the which-show
  one. AnimeThemes files alternate versions as a theme `group`, numbered from 1 again: a
  **dub** ("English Version - 4Kids", "Korean Version") is left out — read as the show's own,
  it put the 4Kids "One Piece Theme" among One Piece's openings — while a Japanese broadcast
  variant ("BD Version", "Repeat Show", "Yorinuki Gintama-san") is kept but ranked after the
  main sequence. Versions of one song ("movie ver.", "-Piano ver.-", "-TEKINA remix-",
  Evangelion's per-episode "Fly Me to the Moon -B22 (A-Type)-") count as ONE song (`songKey`)
  and keep the plain title, or a "which show" clue would offer a song beside its own remix. A
  null `sequence` reads as 1: K-ON!'s real OP1 is unnumbered beside a numbered variant.
- **`serializedIn` and `originalPublisher`** — the source work's magazine, and that magazine's
  publisher (Weekly Shōnen Jump → Shueisha), or a light novel's imprint (Dengeki Bunko), from
  **Wikidata** (CC0; Jikan was turned down as an unlicensed MAL scrape). Two measured traps,
  both in the query: a season item ("Attack on Titan, season 1") carries the AniList id but
  not "based on", so the query climbs part-of-the-series first; and a manga's own publisher
  list is every licensee in every country, so the magazine's publisher is read instead (light
  novels have no magazine, so their publishers are limited to Japanese ones, which yields the
  imprint). A work only attaches when its type matches AniList's `source`, and a value the
  source disagrees with itself about (Fullmetal Alchemist: Enix *and* Square Enix) is dropped.
- **`originalYear`** — when the source began, from the **source work's own AniList entry** (the
  anime's SOURCE relation, already in the cached response; one batched query). Wikidata has
  the date too and was measured worse: it disagreed by over a year on 14 of 434 shows and
  was the wrong one in every case checked (Mob Psycho 100's manga "began" in 2018, after its
  own anime). It survives only as a fallback, and AniQuiz additionally refuses a source year
  later than the premiere.

Measured on the v5 run: themes on 96% of shows, a magazine for 74% of manga, a publisher or
imprint for 71% of manga and light novels, a source year for all of them.

**Checked against MyAnimeList** (official API, comparison only — nothing from it ships) on
2026-10-18, which is where the dub, variant and K-ON! rules above came from. After them: of
2011 themes, 1949 titles appear in MAL's lists for the franchise and the other 62 are
romanization variants ("Tenchi Geshi" / "Tenchi Gaeshi") or film themes; of those with a
performer, the 247 that "differ" are MAL crediting "Alya (CV: Sumire Uesaka)" where AnimeThemes
credits the actor. Magazines: 239 of 256 agree and the rest are the same magazine renamed or
abbreviated (Jump SQ. / Jump Square, Gessan / Monthly Shōnen Sunday) or a series that later
moved. Source years: 506 exact, 14 a year apart, 4 where the pack is the right one. Two
magazines Wikidata had wrong (WataMote, Toilet-bound Hanako-kun), three with no single right
answer (web serials that moved) are in `facts/overrides.json`, and so are AnimeThemes' own
slips: five misspelt titles where MAL and the Japanese agree against it (Love Tyrant, 天地ガエシ
"Tenchi Geshi", 眠れる本能 "Nemureru Honoo", "Utatane Shunshine", "Konpeki no Alpine"), and two
soundtrack pieces it files as a first episode's "OP1" with no performer (Made in Abyss's
"Underground River", Zombie Land Saga's "Temptation from the Hell"), which put an instrumental
ahead of the real opening. That second kind can't be a rule: of the 24 shows whose first
opening has no credited performer, nearly all are the famous one ("R★O★C★K★S",
"Makafushigi Adventure") and simply lack the link. Override arrays are built by running
`themesFromAnimeThemes` over the cached records minus the bad entries, so caps and order match
what the generator would have made. An override replaces a counted fact, so the manifest's
`facts` moves only when one fills an empty field or a suppression finds something.

The generator prints the four coverage figures every run, because these sources are not ours
and a quiet drop looks like success. The new caches are per AniList id
(`animethemes-v2-<id>.json`, `wikidata-origin-v1-<id>.json`,
`anilist-source-<id>.json`), and a full pass over cold ones is a few minutes, not hours. Both services filter on **User-Agent**, which Node's `fetch` does
not send — the adapters set one, which is why they do not share AniTune's browser client.

It shipped empty at first, and the reason is worth knowing before the next 403. AniList
answers any request carrying **no `Referer`** with a 403 claiming the API is "temporarily
disabled due to severe stability issues" — it reads as an outage and is a bot filter. The
fix is `REFERER` in `anilistClient.js`, a no-op in the browser, where `Referer` is a
forbidden header name and `fetch()` sends the page's own.

**A franchise folds to one key, so assembly is first-write-wins, per field.** All six Attack
on Titan entries emit rows against `attack on titan`; last-write-wins left the identity block
saying WIT 2013 while the facts said MAPPA 2022 — one subject wearing two seasons. `collect`
emits each group's canonical season first, then the rest by air date, and groups best-ranked
first (so of two unrelated franchises folding to one title, the better-known holds the key);
"per field" lets a later season still backfill what it had no value for.

**A pack key is the SAME fold a saved profile keys on** — `franchiseTitleKey` for shows and
`characterNameKey` for characters, exactly what `anirank/utils/deck.js` computes when it
collapses a profile into cards. That identity is the whole targeting design: "only shows
this room imported" becomes a Set lookup at draw time and "any show at all" is skipping it,
so which game asks what is not decided in the data and nothing has to be regenerated to
change the answer. The keys are re-exported through `facts.js` rather than imported
directly by the generator, so the two sides cannot drift on what a key is. `anilistId` is
carried as **provenance only** — identity in this repo is deliberately not id-based, since
the ids ListManager minted for hand-entered entries and AniList's own share no id space, so
a lookup routed through it would miss every one of those still saved.

**The loader takes two fetches and the indirection is the point.** The manifest is small and
always revalidated; the pack file it names is immutable and can be cached hard. A data fix
is then "write `pack-v5.json`, change one line of `index.json`" — no app code change, no
rebuild, no redeploy of anything but those two files. A bundled `import()` of the JSON was
rejected for that reason plus one more: it is parsed as JavaScript on every load by every
player, including everyone who never opens the game.

Everything testable lives in `shared/utils/facts.js` rather than in the generator, for the
reason `prefs.js` and `fame.js` are separate from the screens that read them — logic in a
root-level script is logic with no test. **It carries explicit `.js` extensions**, unlike the
rest of the app, because `generateFacts.js` imports it under plain Node, which does not do
Vite's extensionless resolution; `franchise.js`'s import of `./ranking.js` carries one for
the same reason. That is the price of the generator and the app sharing one definition of a
key, and sharing it is exactly the point.

`facts/overrides.json` is applied **after** generation, so a regeneration can never clobber a
hand-made correction, and a `null` value there *suppresses* a fact the source got wrong.
`generateFacts.js` imports `anilistClient.js` directly rather than hand-rolling a throttle —
that module is plain fetch and timers and is Node-safe despite its "for the browser" header.
`generateProfiles.js` keeps its own 600ms copy only because it predates it, and a third copy
is how a rate-limit fix ends up applied to two callers out of three.

### External APIs

- `shared/services/anilistClient.js` — GraphQL. Throttles from the `X-RateLimit-*` headers
  the API actually returns (~30/min, not the widely-cited 90) and backs off on 429.
  `shared/services/anilist.js` batches ~15 media per aliased query to stay under AniList's
  500 query-complexity cap; the characters connection is hard-capped at 25/page.
- Kitsu (`kitsu.app/api/edge`, JSON:API) — public, no auth, `Access-Control-Allow-Origin: *`.
  `filter[userId]` on `library-entries` with `include=anime.mappings`, followed by
  `links.next`. Users are looked up by `filter[slug]`, then `filter[name]`: plenty of
  accounts never set a slug.
- MyAnimeList — only through `workers/mal-proxy` (no CORS on MAL's API; see "List sources").
  The worker reads `/v2/users/{name}/animelist` with `X-MAL-CLIENT-ID`, one request per status
  (MAL's filter takes one), and maps MAL's 403 (private list) and 404 to one "not found".
- `games/anitune/services/animethemesClient.js` — public, no auth. Two verified quirks
  documented in the file: the API bot-filters on `User-Agent` (fine in a browser, fatal for
  Node scripts), and the audio CDN omits CORS headers on the actual GET, so `<audio src>`
  playback and Range seeking work but `fetch`/`decodeAudioData` never will.
  `factSources/animethemes.js` is the generator's own Node copy (it must send a UA).
- Wikidata (`query.wikidata.org/sparql`) — generator only, never the app. CC0. Requires an
  identifying `User-Agent`, kills queries past 60s (hence 40 ids a batch: the season → series
  property path is the expensive part), and is POSTed to because the query outgrows a URL.

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

### Styling

Tailwind v4 with all design tokens in the `@theme` block of `src/index.css` — restyling
means editing values there, not sweeping components. Each accent has a fixed semantic job
(pink = primary/guessing/brand, purple = secondary/whose-turn, lime = yes/correct/ready,
red = no/wrong/destructive, amber = warnings/scores/timer, blue = asking); don't pick them by
vibe at the call site. The `btn-pop` / `focus-pop` utilities carry the press-down physics.
UI primitives are imported from the `src/shared/ui` barrel.

**The look is a manga page: warm paper, black ink, one red.** It replaced a neon arcade
cabinet (near-black canvas, glow halos) because the cabinet read as generated and generic;
the references were two manga landing pages. Canvas `#efebe2`, three surfaces 1.12 / 1.24:1
apart, ink `#141414` for every border and hard shadow. **Every token name survived the
swap** — roles, not values, are what call sites name — which is how ~500 call sites changed
colour without being edited. The tokens, shared primitives and shell went first; the hub,
setup screens, results and in-round screens followed, each onto a shared frame (below), and
the game sounds with them.

**The accent contract INVERTED with the canvas, and it is the one non-obvious rule here.**
On paper no colour can be both readable text on the page (luminance below ~0.15) and a
fill under ink text (above ~0.20). So every solid fill is a DARK print ink and carries
**`text-paper`**, and the same ink reads as text on the page — the way the references set
black ORDER NOW and white-on-red logos. Each accent's comment carries both ratios (text on
`surface-2`, the darkest surface; paper text on the fill), and both must be re-checked
together. Two consequences:

- `text-ink` now means *ink-coloured text*, which is right only on a LIGHT fill — a white
  chip, or a knocked-back tint. `anirank/utils/tierTone.js` is the worked example: solid
  rungs take `text-paper`, the /45 tints over paper are mid-tone and take `text-ink`.
- `pink` is vermilion (`#b4300f`) and `red` is crimson (`#931229`) — two reds, separated by
  hue. So a right/wrong is never colour alone: rows use `shared/ui/Mark.jsx` (a stamped ✓/✗
  with its word) and a result landing uses `ResultImpact`'s ✓/✗ block. A board or panel is
  ruled in INK, never in a game's red accent — AniQuiz's crimson is hub identity only, and
  a board ruled in it read as a board of mistakes.

`Button`'s `primary` is **ink**, not pink: a page whose every main action is red has no red
left for the one thing that should stand out. `secondary` is the outline of the same block.

**The glow is gone, and `--glow` with it.** Light needs a dark room; on paper a coloured blur
reads as a printing fault. `btn-pop` kept its physics exactly — the ink shadow is what the
press travels into. Where glow carried meaning it was replaced, not dropped: `TimerBar`'s last
five seconds take a paper `hatch` (a texture change, which also survives colour-blindness),
and the "lit" leader / perfect-board numerals are inked in amber, the score colour.

**Print textures are static, gradient-or-inline-SVG utilities** — `paper-grain`,
`plus-grid`, `halftone` (`--tone`, `--tone-size`), `speed-lines` (`--lines`), `hatch`
(`--hatch`), `slash` (`--slash`). No requests, nothing to 404, nothing that moves, so nothing
for reduced motion to stop. Colour comes from the custom property with an ink default.

**Motion is three things, all FROM-state animations so reduced motion leaves the finished
picture:** `screen-in` on `Screen`'s root (every view renders its own Screen, so every view
change in every game page-turns with no router involved — clip-path and opacity only, NEVER
transform, because a transformed ancestor becomes the containing block for `fixed`
descendants and a modal mounted mid-animation would jump); the hub's `PanelWipe` between
title → hub → game (timers in `hub/useWipe.js`, not `animationend`, which jsdom never fires
and a backgrounded tab can freeze; a press during a wipe is ignored, so tests must wait for
`[data-wipe]` to clear); and `attract-blink` on PRESS START.

**Type:** Oswald (display, condensed caps), Archivo (body), and Dela Gothic One as
`--font-kana` — **decoration only**, always through `<Kana>` (aria-hidden, `lang="ja"`), and
the file is a cut holding only the katakana block + べ を 中 選. Every string comes from
`shared/ui/kanaText.js` or a game descriptor's `kana`, and
`kanaText.test.js` pins them against the cut, because a missing glyph silently falls back mid-word. **The module is
`kanaText.js`, not `kana.js`:** beside `Kana.jsx` on a case-insensitive filesystem, Vite
resolved `./Kana` to the `.js` and every `<Kana>` crashed. `font-synthesis-weight: none` on
`body` stops kana inheriting a faux bold.

**Art is public-domain ukiyo-e, never generated — except the hub tiles, which are the
player's own characters.** The title, hero and credits use three Met Open Access prints
(Hokusai, Kuniyoshi, Hiroshige), grayscale WebP in `public/art/`, each processed once — the
record of source, licence and processing is `shared/ui/credits.js`, which also feeds the
hub's Credits dialog and the title screen's credit line, and `credits.test.js` checks each
file exists and is CC0. The tiles draw fresh greyscale portraits from the main profile's
imported list every visit (`hub/tileCharacters.js`; see `src/hub/CLAUDE.md`), so every
player's board is theirs — they are the player's data, not shipped assets. **The red is never
in a file:** a CSS sun disc sits behind the print and the print is `mix-blend-multiply`'d over
it, so ink lines stay black and only the paper turns red. Keep every shipped asset CC0 or OFL;
a new one under any other licence needs a decision, not just an entry.

**The shell:**

- `shared/components/TopBar.jsx` is the strip across every screen, mounted once by
  `HubScreen` (which knows the open game's title). Things a GAME owns arrive through two
  **slots** (`shared/context/topBarContext.js`) by portal: `HubButton` into the left,
  `RoomShell`'s room code + Leave into the right — minus the code in the lobby, whose
  banner draws the big `RoomCode` (each game's lobby branch passes `codeInPage`), so the one
  screen never shows the code twice. With no bar (a game mounted alone in a test) both fall
  back to placing themselves. `Screen`'s `pt-20` is what clears the bar's
  `h-14`.
- `shared/components/RoomShell.jsx` replaced the `shell()` hand-copied into all seven
  `OnlineGame.jsx` files (which had drifted: only AniTag showed the code on phones and capped
  the disconnect banners). A game's `shell` is now one line around it.
- `hub/TitleScreen.jsx` once per browser session (`hub/titleSeen.js`, sessionStorage, so a
  refresh mid-game skips it). PRESS START is also the user gesture the sound engine needs.
  `renderArcade` marks it seen unless passed `{ showTitle: true }`.
- Sound: `shared/services/sound.js` (Web Audio; bytes prefetched at idle, the context created
  inside the first gesture, every failure is silence) and `SoundProvider` for the mute switch
  (`aniarcade_sound_muted`, not in `PRESERVED_KEYS`). `Button` takes `sound` (`'tap'`
  default, `null` for none), `GhostButton` and `HubButton` play `back`, `Modal` plays `open`
  (its `sound` prop, `null` where the moment already made one).
  The files are Kenney CC0, converted to MP3 because Safari's Vorbis support is not worth
  betting a click on.
- **Game sounds come in two kinds, and which kind a moment is decides how it is wired.** A
  moment that IS a press — a Yes/No ruling, a buzz, a local guess — plays through the
  button (`sound="yes"`, or `sound={null}` plus `playSound` in the handler when the result
  is only known inside it). A moment that ARRIVES — a verdict over the network, a reveal, a
  turn coming round, a clock running down — goes through `shared/hooks/useSoundCue.js`:
  `useSoundCue(name, key)` plays once per new key (so re-renders and StrictMode never
  replay it) through `playCue`, which never creates the AudioContext — a context made
  outside a gesture starts suspended, so a cue on a freshly reloaded tab is silent until
  the first tap. `useCountdownCue` is the last five seconds' tick and the `timeup` buzzer,
  in `TimerBar` and AniGuess's own clock. **Online, each phone sounds its OWN result**
  (`myId`/`playerId` decides `correct` vs `wrong`; anyone else's result is the plain
  `reveal`), and shared moments — a reveal, the results stamp, a buzz — sound everywhere.
  On the one local device the table's result plays. `sound.test.js` checks every name
  has its file.

**No emoji, anywhere on screen — `shared/ui/icons.js` is the arcade's one icon set.** ~450
platform emoji were the last thing on the page drawn by somebody else: every OS paints them in
its own glossy colours, so on black ink they were the one part that looked pasted in. Most
were simply DELETED — they decorated a label that already said the same thing ("🎮 Start
Game") — and an icon survives only where it carries something the words do not: yes/no
marks, a player's status in a row (locked in, out, waiting, buzzed), lives, a host's crown,
the fake's mask, icon-only buttons. `<Icon name>` (24px ink, round strokes) sizes to the
surrounding text and is the one place `currentColor` is allowed — an inline icon is part of
the text it sits in, so it follows that text through every button variant. It is
decorative unless given a `label`. Places are `<PlaceMark place>` (a numbered medal, with
the digit as text), lives are AniTune's `Lives`, and `Banner` draws its tone's mark itself,
so no call site prefixes a "⚠️". `icons.test.js` checks every `<Icon name="…">` in `src`
exists and fails on any emoji on a rendered (non-comment) line; the playtest strategies find
buttons by label, so a label change there needs a strategy change too.

**Neutral colour is a ROLE, never an opacity, and `white/N` must not come back.** The
canvas, surfaces and accents were always tokens, but every dim text line, hairline and
translucent fill was a hardcoded `white/N` utility — ~510 of them at **fifteen** different
opacity steps, plus 16 `black/N` scrims. That the canvas could go from black to paper as a
value edit is the proof the ramp was worth it: a `white/N` literal would have been white on
paper, and so would the 229 `text-white` literals the paper pass had to sweep to
`text-fg-strong` by hand. Don't write `text-white` either.

**There are FOUR text levels and that is a ceiling, not a preference.** The ramp is ink at
graded alpha; on `surface-2` 4.5:1 puts the floor at 0.62, so there is only so much room
between it and solid ink. The ramp used to have six and the bottom two were simply illegal;
`fg-faint` was **folded into `fg-subtle`** because the alpha both needed in order to pass was
the same number — they were never two roles. Three roles sit below that floor on purpose:
`fg-icon` (glyph buttons, a UI affordance held to 3.0:1), `fg-disabled` (WCAG exempts
disabled controls) and `fg-ghost` (`aria-hidden` markers). Collapsing any of those into
`fg-subtle` silently re-couples them to an obligation they don't owe. If a shade seems
missing, the question is never "which opacity" but **which role**. Scrims stayed ink through
the canvas swap — a wash tints the page, a scrim hides what is under it, and hiding is
darkening on any ground — and text on a scrim is `text-paper`.

`public/favicon.svg` is hand-synced to `--color-pop-pink` / `--color-ink` / `--color-paper`
because a file in `public/` cannot see the theme — a palette change that skips it leaves the
tab icon on the old colours silently.

**`field-lit` is a second focus signal and must never become the only one.** Every field
already has an ink border, so focus cannot be a border alone. `field-lit` takes the primary
accent on the border plus a hard underline, and it is applied **alongside** `focus-pop`,
never instead of it: the ink ring is what a forced-colours or high-contrast user actually
gets. It fires on `:focus`, not `:focus-visible`, because a field that lights only for
keyboard users leaves every pointer user on an unlit form. `NumberInput` applies it **only
when the value is valid** — on an invalid stepper it would repaint the red error border at
exactly the moment the user is looking at it.

**Modals blur what is behind them** — an ink scrim over a busy page leaves the page's own ink
lines showing through as noise behind the panel — and the panel takes a 3px rule and a
deeper shadow, the one panel that has to look lifted off the page.

**Viewport heights are `dvh`, not `vh`.** `vh` on mobile browsers measures the viewport
*without* the retracting URL bar, so a centred screen paints a bar-height too low and then
jumps when the bar hides on first scroll. `Screen.jsx`, `ListManager.jsx` and the `body`
floor in the base layer all use `dvh`; they are all `min-height`, so it costs nothing on
desktop. Don't reintroduce `min-h-screen`.


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
