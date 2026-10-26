---
paths:
  - "src/shared/components/**"
  - "src/games/**/components/**"
  - "src/games/**/LocalGame.jsx"
  - "src/games/**/OnlineGame.jsx"
  - "src/shared/context/tablePortraitsContext.js"
  - "src/shared/utils/portrait.js"
  - "src/shared/utils/podium.js"
  - "playtest/strategies/**"
---

# Shared screens: setup, lobby, in-round and results

Moved from the root `CLAUDE.md` so it loads only when Claude works on the files above. The
cross-game architecture it builds on is still there.

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
