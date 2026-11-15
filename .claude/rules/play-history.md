---
paths:
  - "src/shared/hooks/useRecordResult.js"
  - "src/shared/utils/history.js"
  - "src/shared/utils/achievements.js"
  - "src/shared/hooks/useAchievements.js"
  - "src/shared/context/historyScopeContext.js"
  - "src/hub/Record*.jsx"
  - "src/games/**/components/*Results.jsx"
  - "src/games/aniguess/components/Leaderboard.jsx"
---

# Play history

`aniarcade_history` is `{ [profileId]: Entry[] }`, newest last, capped at 200 per profile;
`shared/utils/history.js` is the pure, tested half. The FINAL results screen calls
`useRecordResult` once (root `CLAUDE.md`).

- A tie at the top is a win for each; a table of one is never a win; `winnerIds = []` is a game
  nobody won (an unscored AniRank round) and `null` records nothing. AniTurf records a side's
  win (the whole team). AniFake records once per MATCH on `AniFakeFinal`, with places by total;
  lines written before that are one round each, a side's win (the fake against everyone).
- **Whose line it is comes from `HistoryScopeContext`:** `RoomShell` provides
  `{ onlyId: myPlayerId }`, so online each device records only its own player; locally every
  seated profile is recorded.
- **A results screen can mount twice for one game** (a refresh, AniGuess's leaderboard → list →
  back), so the same fingerprint (game, table, winners, places, running totals) within 30
  minutes is dropped.
- No provider: the reader (`RecordScreen`) mounts from the menu, which is never on
  screen while a game writes. The key is in `PRESERVED_KEYS` — it cannot be rebuilt.
- **Each line carries everyone else's result** (`others: [{ name, place, won }]`), which the
  head-to-head counts. It is ABSENT on lines written before it existed, and those count as games
  together with no winner between you — never a guess. `recordDetail`'s `compare` ranks by
  places where both have one, else a win over a loss (AniFake's old per-round lines place nobody); two unplaced
  losers are no result, not a tie. Friends group by `profileIdFromName` of the name, so one
  person met locally and online is one row. See `src/hub/CLAUDE.md` for the screens.

## Achievements

`aniarcade_achievements` (`shared/utils/achievements.js`, pure; `hooks/useAchievements.js`,
storage) is `{ [profileId]: { name, stats, awards, roasts, unlocked } }`, keyed and scoped
exactly like history, and in `PRESERVED_KEYS`. Settled with Caden (2026-11-15): lifetime
milestones plus a tally of every award a profile was named for.

- **Its own key, never re-derived from history,** which is capped at 200 lines: a count rebuilt
  from it would stop at 200, and an unlock resting on old lines would lock again. `stats` are
  counters folded in one game at a time; an unlock is never taken back.
- **Two writers.** `useRecordResult`'s `recordGame` folds in each line `addEntries` actually
  added (a duplicate it dropped is no game here either). `Awards` (`Results.jsx`) tallies the
  awards it SHOWED — `pickAwards`' up-to-four, never the ones earned and left off the card —
  once per mount, with its own 30-minute fingerprint check against a remount.
- **The backfill is silent.** A profile with no record is seeded by replaying its history
  BEFORE the current game, each unlock dated by the old game that earned it; the results
  screen's "Unlocked" card (under `Awards`, so every final screen and no stop between rounds)
  shows only unlocks stamped since it mounted, so the first game after shipping announced
  nothing old. Award tallies have no history to replay: they count from 2026-11-15.
- The card listens (`useSyncExternalStore` over a write counter) rather than reading once:
  a parent's effect (`useRecordResult`) runs after the card's own, so a read on mount is
  always too early.
- **Each game's descriptor lists its ten titles** (`awards: { good, roasts }`) for the trophy
  page's collection, which shows every title, locked ones included; `hub/awards.test.js`
  fails a descriptor whose list differs from the `award('…')` calls in its `rules.js`. A
  retitled award orphans its old tally (keyed by title): rename deliberately.
- Tour and Grand slam mean every game there is NOW: a new game widens them for anyone who
  has not unlocked them yet.

