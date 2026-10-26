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
