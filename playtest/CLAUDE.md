# Playtest bots — internals

Loaded when Claude works on files in this folder. Moved from the root `CLAUDE.md`, which
still holds the cross-game architecture these notes build on.

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
4198/4199 (the next free pair when those are taken; `run.js` drops to `--workers 1` by
itself under 4 GB free RAM, and `vite.config.js` and `smoke/vitest.config.js` cap Vitest at 4
workers — the defaults, one per core, ran this 16 GB machine dry) —
never `dist`, never 5173.

**The local and online layers are split across processes** (`core/shard.js`): `run.js`
starts N vitest processes with `PLAYTEST_SHARD=i/N`, and each plays its slice of the
registry, balanced by each game's mean run length in the last report. N is `--shards N`, or
picked from the free RAM at the start (`SHARD_COST`/`RESERVE` in `run.js`); a single
`--game` is always one process, so a replay is unchanged. Output lines carry an `[i/N]`
prefix, a shard never rebuilds the summary (run.js does, once), and the online layer's
shards share one emulator — run.js re-enters itself under `emulators:exec` with
`--inside-emulator`. Each layer ends with a `■` line: wall time, the lowest free RAM seen,
and the biggest `heapMB` a run left behind (recorded per run in the report JSON), which are
the numbers to retune the costs by. Online seats are torn down with `disposeDevice`
(`smoke/harness.js`, `deleteApp`) once a run ends; only `goOffline`, which leaked every
seat's Firebase app and its copy of the app, is what a crash still does mid-run. Online runs
also play every timer that is on at its shortest length (`scenarioFor`): online time is real,
and the long clocks still run locally on the fake one.

**A seed that "hangs" for tens of minutes is usually the laptop asleep**, not the game: on
2026-11-04 every such stall matched a Modern Standby span in the System event log
(Kernel-Power 506/507), and standby also fails online seeds by dropping the emulator's
sockets. `run.js` now holds a keep-awake request (system + display, so the screen stays on)
for the length of a run, through a helper PowerShell that exits with it. `npm run
test:smoke` and bare `npx vitest` do not go through run.js and get no such request. Measured
the same day on a quiet machine: local 11m55s in one process, 6m01s in two; online ~36 min in
one, ~18½ in two.
