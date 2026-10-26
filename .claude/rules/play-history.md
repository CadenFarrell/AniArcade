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

Moved from the root `CLAUDE.md` so it loads only when Claude works on the files above. The
cross-game architecture it builds on is still there.

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
