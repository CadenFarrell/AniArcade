---
name: new-game
description: Add a new game to AniArcade end to end — the folder, the menu entry, rules.js and its two hooks, settings, the rules sheet, results and history, the playtest strategy, the smoke test and the docs. Use when asked to build, add or scaffold a new game. Args, the game's id and title (e.g. "anidraft AniDraft") and, if decided, its pitch.
---

# Add a new game

A game touches about a dozen places, and the rules for each live in different docs. This
skill is the ORDER and the checklist; the docs it names hold the rules. Read each named doc
when you reach its step — do not work from memory of another game's file, which is how the
first seven games drifted apart.

The reference game is the most recent one in `src/hub/registry.js` (AniDraft as of writing):
`git log --stat --grep='Add <Title>'` on it lists every file a new game touched, shared ones
included. Copy its SHAPE, never its code.

## 0. Pin the spec first

CLAUDE.md's working agreement applies: one round of questions before building. Settle how a
round plays, who sees what (that decides `state/` vs `secrets/` vs `assignments/`), player
counts, what ends a match, what is scored, the settings, and what the game reads from a
profile (and what it does when a stat is missing — `CLAUDE.md` "Profiles and identity").
Check `GAME_IDEAS.md` for an existing write-up of the idea.

## 1. Menu entry and identity

- `src/games/<id>/index.js`: the descriptor `{ id, title, kana, blurb, accent, available,
  Component, howTo }`. **`Component: lazyGame(() => import('./<Title>Game'))`**, never a
  static import (root `CLAUDE.md` "Hub and game registration"; mechanics in
  `src/hub/CLAUDE.md`). `kana` is katakana only — the font is cut to that block
  (`.claude/rules/styling-assets.md`; `kanaText.test.js` fails anything else).
- One line in `src/hub/registry.js`'s import list and `games` array.
- **Accent:** every accent is spoken for. A new game gets a new DECORATIVE ink in
  `src/index.css`'s `@theme` (comment: why this hue, its nearest existing ink, both contrast
  ratios — text on `surface-2` and `text-paper` on the fill, both ≥ 4.5:1), then one entry in
  each accent map: `shared/ui/accents.js` (both maps), `shared/ui/Badge.jsx`,
  `shared/ui/Wordmark.jsx`, `shared/components/Lobby.jsx`,
  `shared/components/OnlineIdentityCard.jsx`. `git grep -n "magenta:"` finds them all.
- The title's big word (after "Ani") must differ from every other game's
  (`shared/utils/splitTitle.test.js`), and the roster must not leave a lone tile on a tablet
  or wider (`src/hub/boardLayout.test.js` — if it fails, that is a decision for the user).

## 2. The cover and the two modes

- `<Title>Game.jsx` is a mode picker built from `shared/components/ModePicker.jsx`, with the
  tagline in `copy.js`. Never copy another game's picker.
- `LocalGame.jsx` and `OnlineGame.jsx` are thin view-routers holding a `view` string and
  rendering dumb screens from `components/`. `OnlineGame.jsx` wraps every screen in
  `RoomShell`'s `shell()`.
- Screens are built from the shared pieces in `.claude/rules/shared-screens.md` — keep
  their headings and button words, which the playtest bots read.

## 3. rules.js — all game logic

`src/games/<id>/rules.js`: pure functions, no React, storage or network, each taking a slice
of state and returning `{ patch }` (plus `next` / derived values). Turn order, scoring and
phase changes live here and nowhere else. Cover it with `rules.test.js` (pure, node). A
deal or other big pure piece gets its own module and test (`deal.js` in the reference game).

## 4. The two hooks over the same rules

- `hooks/use<Thing>Round.js` — local, `useState`.
- `hooks/use<Thing>Room.js` — online, configuring `shared/hooks/useRoomCore.js` with
  `storageKey: '<id>_online_room'`, `playersPath`, `initialState`, `normalizeState`.
  **Read `.claude/rules/online-rooms.md` first.** It decides what goes in `state/` and
  what in `secrets/` / `assignments/` (picked by WHO must not see it), the normalize-at-
  every-entry rule, readiness gates over the active roster, one-shot keys, and the
  departure-reconciliation effect that stays per-game. A hook that lists fields instead of
  spreading `core` must pass `handoff: core.handoff`.
- A lobby that reads a profile's list calls `useRepublishProfile`
  (`.claude/rules/profiles.md`).

## 5. Settings

`prefs.js` with one `DEFAULT_PREFS` literal (it IS the schema) + `prefs.test.js`, and ONE
settings card rendered by both setup and the lobby. Adding an option touches four places:
`.claude/rules/settings-cards.md`.

## 6. The rules sheet

`howTo.js` exporting `HOW_TO = { goal, players, sections: [{ title, items }] }`, built from
`rules.js` and `prefs.js` constants so a retuned number reaches it (reference: the newest
game's `howTo.js`). `src/hub/howTo.test.js` fails a game without one or one printing
`undefined`.

## 7. The final results

- The FINAL results screen calls `useRecordResult(descriptor.id, players, winnerIds,
  { places, scores })` once — never a between-rounds screen (`.claude/rules/play-history.md`).
- Online, the final results' `shell()` call passes `{ nextGame: true }`
  (`.claude/rules/online-rooms.md`, "Next game").
- The final results carry `Awards`: a `<thing>Awards` function in `rules.js` (the reference game's is `draftAwards`), five good and five roasts,
  built on `shared/utils/awards.js` (`.claude/rules/shared-screens.md`, the awards section;
  `hub/awards.test.js` checks every game from its source).

## 8. Tests outside the game folder

- `<Title>Game.test.jsx`: a component test — `// @vitest-environment jsdom` docblock and
  `vi.mock('shared/services/firebase')` (`.claude/rules/testing.md`).
- `playtest/strategies/<id>.js` + its line in `playtest/strategies/index.js`. Without one
  the playtest fails on purpose. Internals: `playtest/CLAUDE.md`.
- `smoke/<id>.smoke.test.js` driving the real online hook per simulated device
  (`smoke/CLAUDE.md`).
- The registry-wide tests pick the game up by themselves (`HubScreen.test.jsx`,
  `howTo.test.js`, `boardLayout.test.js`, `splitTitle.test.js`, `kanaText.test.js`,
  `howToPages.test.js`, `playHistory.test.jsx`, `RecordScreen.test.jsx`).

## 9. Docs

- `src/games/<id>/CLAUDE.md`: the design notes — what a round is, why the rules are what
  they are, the room's node choices, anything a later change could re-break.
- Root `CLAUDE.md`: add the game to the "Per-game design notes" sentence, in the same
  `path` (Game: topics) form as the others.
- `README.md`: one row in the games table.
- `GAME_IDEAS.md`: remove or mark the idea as built.

## 10. Verify, in this order

1. `npm run lint`, `npm test`, `npm run build`, `npm run size` (the hub budget: a game
   that leaks into the startup bundle fails here).
2. `npm run playtest -- --game <id>` (local layer), then
   `npm run playtest -- --game <id> --layer online`.
3. `npm run test:smoke`. AniRank and AniName are known to flake in a full run on this
   machine and pass alone; a failure in the NEW game's file is real.
4. Commit and ship with `/ship`.
