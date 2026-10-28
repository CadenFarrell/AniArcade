---
paths:
  - "src/shared/hooks/useRecordResult.js"
  - "src/shared/utils/history.js"
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
- No provider: the readers (`RecordStrip`, `RecordScreen`) mount with the menu, which is never on
  screen while a game writes. The key is in `PRESERVED_KEYS` — it cannot be rebuilt.
- **Each line carries everyone else's result** (`others: [{ name, place, won }]`), which the
  head-to-head counts. It is ABSENT on lines written before it existed, and those count as games
  together with no winner between you — never a guess. `recordDetail`'s `compare` ranks by
  places where both have one, else a win over a loss (AniFake's old per-round lines place nobody); two unplaced
  losers are no result, not a tie. Friends group by `profileIdFromName` of the name, so one
  person met locally and online is one row. See `src/hub/CLAUDE.md` for the screens.
