# AniDraft — design notes

Loaded when Claude works on files in this folder. The cross-game architecture these notes
build on (rules.js, online rooms, presence, settings, profiles, styling) is in the root
`CLAUDE.md`.

## The game

`games/anidraft/` (id `anidraft`) is a draft-a-team party game, a format popular on anime
social media. Every player is a team. A round:

1. **Deals** five roles from `roles.js`'s deck of 30 (Captain, Final Boss, Comic Relief…).
2. **Lays one shared board** of `boardSize(n)` = ⌈1.5 × n × 5⌉ characters from the table's lists.
3. **Snake-drafts it.** Seats go forward then back, five laps, and the first seat moves one
   place each round. Each pick goes into one of the picker's open role slots.
4. **Votes.** Everyone votes once per role for the best pick in it, never their own team.
   A role's most-voted team scores 1, and a tie scores every tied team.
5. **Reveals** the votes one role at a time.

Most roles won takes the game. Votes received across the game break a tie
(`standings`), and the results rows print both.

It came from Caden's ideas list (`GAME_IDEAS.md`) and was settled in a question round:
- **One shared board**, rather than three offered per pick or a search of everything.
- **A vote per role**, rather than one overall vote or a ranking.
- **Random roles from a deck**, which the host can reshuffle.
- **Secret votes locally**, by passing the phone.

Claude's defaults, which stood:
- 3 rounds.
- No pick clock locally, and an optional one online.
- 3–8 players.
- A character drafted once only.
- 5 roles a round.

Keep the snake draft into roles, and the role-by-role vote, as the core.

## Roles (`roles.js`)

**A role is a job in a story, never a fact about a character.** Nothing on a profile says who
is a healer, and the table arguing about it is the game. So no role may need data the arcade
lacks (powers, quotes), and none should have an obvious one-character answer.

**Ids are what a room stores, so never reuse one** for a different role. `roleOf` draws an
unknown id as a Wildcard, so a room on a newer deck still renders.

`dealRoles` avoids the previous deal's roles where it can, so a reshuffle (or the next round)
actually changes them. **A reshuffle is allowed only before the first pick**
(`reshuffleRoles`): a pick made into a role that then vanished would be nonsense. Online,
only the host may reshuffle, for the same reason only the host edits the lobby settings:
two phones shuffling at once overwrite each other.

## The board (`deal.js`)

`draftPool` is AniChain's `chainPool` again: main characters by default, falling back to
everyone if the lists mark nobody main. `dealBoard` draws weighted, without replacement:
- by owner count;
- ×2 for a main;
- ×0.25 with no portrait, because the board is a wall of portraits.

**Nothing dealt this game is dealt again** (`game.used`) until the lists run short. Then a
board tops up with cards dealt before but never drafted. **A drafted character is never
dealt again** (`draftedKeys`), so nobody plays for two teams in one game. That is why setup's
`cardsNeeded` is every pick of every round plus one board's spare, not boards × rounds.

**The rules never deal.** `startGame`, `nextRound` and `reshuffleRoles` take the cards from
the caller, and refuse a board too small to cover the picks. A game whose lists cannot fill a
board ends instead of dealing blanks.

## Nothing is hidden

The board, the picks and the teams are the table's to see. That is what lets one phone in the
middle run the whole draft with no handoffs, and why there is **no `secrets/` node**.

**Ballots sit in `state/game`**, as AniFake's votes do. Screens show who has voted (a lock in
the row), never what, until the vote closes. A player reading raw room data mid-vote learns
votes on teams that are already final, so there is nothing to protect.

## Locally (`useDraftRound`, `LocalRound`)

- **The draft:** the picker takes the phone, taps a card, then "Draft as <role>" in the pinned
  bar. The role buttons are in the bar because the board is a long scroll on a phone.
- **The vote:** each voter in seat order gets a `Handoff`, then their whole ballot, then hands
  the phone on. That is one pass per voter, not one per role.
- **The close:** the last ballot and `closeVote` land in one update, so the reveal follows
  without another tap.

There is no clock locally.

## Online (`useDraftRoom`)

- **Who deals:** the host deals the first board at Start. Whichever phone presses "Next round"
  deals the next board inside the transaction that opens it, from the stored game, so a second
  press aborts rather than dealing twice. `revealNext(from)` is pinned the same way: two
  phones pressing "Next role" turn over one role.
- **Auto-picks:** any device runs `autoPick` when the picker has gone (past the 20s grace) or
  their pick clock ran out. It needs one of those reasons, and `forPick` pins it to one pick.
  It takes the first card left on the board into the picker's first open slot. That is
  deterministic, so a rerunning transaction picks the same card, and the board is in random
  order anyway.
- **The vote** closes once every voter HERE has voted. A voter who left is not waited for,
  but their team stays on everyone's ballot. Below two players here the game ends
  (`enoughPlayers`).
- **One-shot keys** carry the round and the pick number (or who is here), because the view
  stays `round` all game.

`smoke/anidraft.smoke.test.js` covers:
- a three-device game: the reshuffle refused to a guest, an out-of-turn pick refused, an own-team
  ballot refused, a three-way tie, the double "Next role", the double "Next round", and a fresh
  second board;
- a picker closing their tab: auto-picked for the rest of the draft, and the vote closing
  without them.

## Screens and words

- `DraftScreen` is the draft on both layers; only `canPick` and the clock differ. The selection
  is keyed to its pick, so a clock running out cannot leave a stale card selected.
- `DraftBoard` keeps drafted cards in place, with the picture faded and the drafter named.
- `TeamSheet` is the picker's five roles above the board. `AllTeams` is one row per team under it.
- `Ballot` is a radiogroup per role, offering only the other teams.
- `RoleReveal` puts the newest role on top. The score row reads `revealedScores`, which takes
  the unrevealed roles back off, or it would give the round away.

The playtest strategy (`playtest/strategies/anidraft.js`) and `AniDraftGame.test.jsx` press
these words:
- "Shuffle roles", "Take <name>", "Draft as <role>"
- "I'm <name> — vote", the "<character> as <role>" radios, "Cast votes"
- "Next role", "Next round", "See results"

The headings are "<name>'s Pick" / "Your Pick", "<name>'s Vote" / "Your Vote", "Votes Coming
In", "Votes Are In" and "Final Scores".

The game's ink is the decorative `--color-pop-magenta` (index.css), wired into every accent
map. It was picked as the ink furthest, in CIELAB, from all twelve before it.
