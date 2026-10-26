---
paths:
  - "src/shared/components/SetupLayout.jsx"
  - "src/shared/components/Lobby.jsx"
  - "src/shared/components/PlayerSlots.jsx"
  - "src/shared/components/PortraitPicker.jsx"
  - "src/shared/components/Portrait.jsx"
  - "src/shared/components/Results.jsx"
  - "src/shared/components/TablePortraits.jsx"
  - "src/shared/components/Handoff.jsx"
  - "src/shared/components/PlayerRow.jsx"
  - "src/shared/components/RoundHeader.jsx"
  - "src/shared/components/ResultImpact.jsx"
  - "src/shared/components/SpeechBubble.jsx"
  - "src/shared/components/PlayerFace.jsx"
  - "src/shared/context/tablePortraitsContext.js"
  - "src/shared/utils/portrait.js"
  - "src/shared/utils/podium.js"
  - "src/games/**/components/*Setup.jsx"
  - "src/games/**/components/*Lobby.jsx"
  - "src/games/**/components/*Results.jsx"
  - "src/games/**/LocalGame.jsx"
  - "src/games/**/OnlineGame.jsx"
  - "playtest/strategies/**"
---

# Shared screens: setup, lobby, in-round and results

Build a new screen from these pieces, never from another game's file — every hand-copied set
(rosters, setup columns, shells) drifted. Their headings and button words are what the
playtest bots and tests find things by; keep them when touching any of them.

**Every setup screen and lobby is `SetupLayout.jsx`:** a `GameBanner` in the game's colour
(`aside` carries the lobby's `RoomCode` or AniGuess's leaderboard button), players left and
settings right (stacked on a phone), and a `StartBar` pinned to the viewport bottom with one
status line — what is ready, or the first thing that is not. A screen supplies `left`,
`right` and `start`; its warnings stay in its own `left`. `Lobby.jsx` draws what every lobby
shares (`RoomCode`, `PlayerRoster` with the game's `badgeFor` — omitted where nothing reads a
list — `LobbyImport`, the guest's `HostWaitCard`); each lobby keeps its settings, gates and Start.

**Players are character-select slots** (`PlayerSlots.jsx`: `LocalRoster` locally,
`PlayerRoster` in a lobby). `portraitsFor` gives each player their best-known character that
nobody seated before them already wears — friends' lists overlap, and two slots in one face
read as one person seated twice. A player can choose the face (`PortraitPicker.jsx`, from the
slot — any seat locally, only your own online — or the hub's profile list): one `portraitKey`
(a `characterNameKey`) on the PROFILE, so it is the same in every game and travels into rooms
(`profileFingerprint` counts it). A choice beats an automatic face; two players choosing one
character leaves it with whoever sat first, and the other slot says "Taken by <name>".

- A local setup screen must swap the updated profile into its seated copies (`LocalRoster`'s
  `onUpdate`): those copies are what Start hands the game.
- Clearing back to Automatic DELETES the key — RTDB rejects a write carrying `undefined`.
- The slots keep the accessible names "Add player", "Remove <name>", "Import <name>'s list".

**Every results screen is `Results.jsx`:** the screen's title ("Final Scores", "Reveal") is the
first heading with the game's name a line above it — the playtest strategies tell a results
screen by that heading — then a `Splash`, `Standings` with a face on every row, the game's
recap, and the replay in the same `StartBar`. The splash is the winner on a final screen
(`podium.js`'s `splitPodium`: a tie shares it, a table of one is "Finished", not "Winner"),
the round's best between rounds (AniGuess's `RoundEnd`, AniTag's round screen), the fake on
AniFake's reveal, the best board on AniRank's. `ResultsLayout` takes the table in SEAT order
and shares portraits with `portraitsFor`, so a winner wears their setup slot's face
(`Portrait.jsx` draws both). The stamp's `stamp-in` is from-state, so reduced motion leaves it
stamped.

**In-round, the faces are the thread.** `TablePortraits.jsx` shares portraits once (seat
order) for everything past setup — `RoomShell` provides it online, each `LocalGame` locally —
and `usePlayerPortrait(player)` looks one up by id, so a player wears one character everywhere.

| piece | is |
| --- | --- |
| `Handoff` | pass the device: the next player's portrait panel, name slab, the game's own button words |
| `PlayerRow` | the table as a row of faces, NOW (purple, whose-turn) on the active one, score and a status mark under each |
| `RoundHeader` | the round's heading in display caps, an ink tab ("Turn 3", "Song 2/10"), a hint, the clock inside it |
| `ResultImpact` | a right/wrong landing: speed lines and a ✓/✗ block for 750ms, plus its sound |
| `SpeechBubble` | a question or a name as a manga balloon |
| `PlayerFace` | one player's face at row size, beside (never instead of) their name, found by id |

- `PlayerFace` goes on rows only: never inside a sentence ("Liam got it!" — busy), never
  beside a character card (AniGuess's who-is-who), where a face — itself a character — reads
  as part of the answer.
- `ResultImpact` fires online only for THIS player's result and plays the sound itself, so
  frame and sound cannot disagree. It is aria-hidden and pointer-events-none: decoration over a
  screen that already says the result, never a layer that eats a tap.
- The bots read "<name>'s Turn", "Clues", "I'm X — show me", "Accuse <name>". A dimmed player
  dims their FACE, never the text, which axe flags under 4.5:1.
