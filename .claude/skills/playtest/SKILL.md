---
name: playtest
description: Playtest AniArcade's games — run the bot layers (local jsdom, online on the emulator, real Chrome), read the report, replay failures by seed, review the screenshots, and write up bugs plus UX, clarity and fun notes. Use when asked to playtest, smoke-test the games, or check how a game plays or looks. Optional args, a game id (aniguess, anitune, anirank, anifake, aniwave, anitag, aniquiz, aniturf) and/or a layer (local, online, browser, all).
---

# /playtest

You are the playtester. The bots in `playtest/` do the mechanical part — they
play every game to its results screen many times and catch crashes, dead
ends, console errors, broken text, desyncs, layout and accessibility issues.
Your job is to run them, trust-but-verify what they report, and add what no
bot can: whether a screen is clear, whether a game is fun, what a new player
would trip over.

Read `playtest/core/driver.js`'s header first if you have not this session —
it says how a run works and what each failure kind means.

## 1. Run the layers

Default `--layer all`, or what the args asked for. Narrow with `--game <id>`.

```bash
npm run playtest -- --layer local [--game X] [--runs 20]   # jsdom, ~3–4 min for all games
npm run playtest -- --layer online [--game X] [--runs 3]   # emulator; minutes, grace-window waits
npm run playtest -- --layer browser [--game X] [--runs 2]  # Playwright: phone, desktop, drag, online
npm run playtest -- --layer all
```

The online layers need the Firebase emulator. `run.js` reuses one already
listening on :9000/:9099 and otherwise starts its own. Never point anything at
`.env.local`'s production Firebase.

## 2. Read the report

`playtest-report/summary.md` (text, read this) and `index.html` (the same with
screenshots). Per game and layer: pass/fail, screens reached, settings and
player counts covered, failures with a one-line replay command, findings.

## 3. Triage every failure — bot or game?

Replay it: `npm run playtest -- --layer local --game X --seed N --debug`
(`--debug screens` also prints each screen's text and controls).

- **stuck / no-progress / loop** — usually the STRATEGY no longer matches a
  screen (a renamed button, a new step). Confirm by reading the screen dump;
  if the game offered a way forward the bot missed, fix the strategy in
  `playtest/strategies/<id>.js`. If the screen really has no way on, that is a
  game bug.
- **console-error, bad-text (NaN/undefined/[object Object]), crash, desync** —
  almost always the game. Find the component and the cause.
- **blocked** — Start refused a scenario. Correct if the setup screen says why
  (too few shared shows); a bug if it gives no reason.
- Online runs replay the table and settings but not the timing — rerun twice
  before calling something flaky.

## 4. Look at the screens

Open the screenshots in `playtest-report/shots/` with Read, phone first —
every game, every distinct screen. For each, ask: what is this screen asking
me to do, and is that obvious in two seconds? Is anything cramped, cut off,
overlapping, or off the edge? Does the copy match what the game does?

Use the findings list for what the measurements caught (`overflow-x`,
`offscreen`, `target-size`, `clipped-text`, `axe:*`); use your eyes for what
they cannot.

Open Chrome only for something that needs live interaction a screenshot cannot
show (an animation, a drag, a timer's feel). One tab, on the preview build the
browser layer serves (port 4199, or the pair run.js printed), closed in the same turn — never by seeding
localhost:5173, which holds Caden's real profiles.

## 5. Judge the play

From the run records (`playtest-report/<layer>/<game>.json`): score spreads in
the end-screen text, how many steps a game took, how often each screen came up
(the `screens` counts). A round that always ends the same way, a screen players
sit on for twenty steps, a mode nobody reaches — say so, with the numbers.

## 6. Write it up

`playtest-report/review.md`, per game:

- **Bugs** — confirmed, with the replay command and the file/line at fault.
- **Bot fixes made** — strategy changes, and why each was the bot's fault.
- **UX and clarity** — screen by screen, with the screenshot path.
- **Fun and balance** — with numbers from the records.
- **Not checked** — anything the layers did not reach.

Then summarise for Caden in chat. **Ask before fixing any game code** — the
review is the deliverable; fixes are a separate decision.
