# AniGuess — design notes

Loaded when Claude works on files in this folder. The cross-game architecture these notes
build on (rules.js, online rooms, presence, settings, profiles, styling) is in the root
`CLAUDE.md`.

## The game

`games/aniguess/` (id `aniguess`) is the arcade's first game, and the one the shared
architecture was extracted from: `rules.js`'s `{ patch, next }` shape, `useRoomCore` and the
`assignments/` node all started here. Everyone is dealt a character they cannot see. On a
turn you ask the table one yes/no question about yourself, or spend the turn on a guess. A
right guess locks you in, placed by how few turns it took. A wrong guess, a question, or a
timer running out just passes the turn.

**Places count turns, not solve order.** `correctGuess` places a solver after everyone locked
with FEWER turns, so equal turns share a place. Points come from the table's
`pointsPerPosition` (default `[3, 2, 1, 0]`; the last slot is everyone who did not place, not
4th: `prefs.js`'s `POSITIONS`). A match is `DEFAULT_MATCH_ROUNDS` (2) rounds, because a round
runs ten to twenty minutes; 0 is endless.

**Final chances (`LAST_STANDING_TURNS`, `turnsLeft`).** Once one player still here is unsolved
and somebody has solved, the last player gets as many turns as the slowest solver took plus 3,
then is locked out UNSOLVED: no place, no points, character shown. It replaced the old ending,
where the last player took turn after turn alone, the longest and dullest stretch of the game.
`giveUp` is the same lock, at any point. It takes two presses on screen (`FinalChances`),
never a browser `confirm()`, which blocks every other device's updates and the playtest run.
The bots never press "Give up", so it is never the only way forward.

**A lock carries the character (`characterCard`) and the round's stats (`roundStats`).** The
solve screen shows who you were. That was the punchline the game never used to show.
Putting it in `state/` is safe because everyone except the solver already knew it. The stats
ride on the lock because `newRound` clears `questionLogs`, and a lock is the only record of a
round that reaches the final screen's awards (`matchAwards`). Locks from older builds have no
stats, and awards that need them skip those locks.

## Dealing a character

`utils/characterPool.js` is shared by local and online assignment so both deal identically:

- **`getAssignableAnimeList`**: the assignee's OWN shows. `sharedShowsOnly` narrows them to
  shows at least ONE OTHER player also has, not shows everyone has. One person who can answer
  questions about the show is all a round needs. The settings card says so.
- **`pickRandomCharacter`**: every distinct character equally likely. With `twoStepRandom`
  ("Anime-first randomizer"), it picks a show first, then a character in it. A re-roll never
  hands back what is on screen. A player is not dealt anyone they already were this match
  (`earlierCharacters`), unless that leaves nothing. `dedupeByName` collapses a character
  listed under several shows, so a spin-off does not give them an extra roll.
- Identity is `characterNameKey` (the name alone), as everywhere; see
  `shared/utils/character.js` for why neither `id` nor `series::name` works.

AniGuess does not use `recentDeals.js`: the table picks, or the dice roll per player.

**Grading (`utils/guessMatch.js`) is deliberately loose:** an exact name or nickname, or any
3+ character substring of either. The table answered the questions, so a near-miss on
spelling is still a solve. Typed guesses get suggestions (`shared/utils/guessSuggest.js`,
shared with AniWave and AniFake).

## Local play

`hooks/useGameFlow.js` owns all game state. `LocalGame.jsx` owns only `view`. The session
auto-saves, and "Resume game" restores it. Only in-progress views are saved, never a menu or a
list editor, or Resume would land on a screen with no game behind it.

Assignment is pass-and-play: the assignee looks away while the table picks
(`CharacterAssignment`, "Pick random" / "Pick manually", re-roll, "Confirm"), then
`CharacterReveal` shows everyone else the character as a full-colour character sheet. It is
the one place in the arcade a character is NOT inked grey, because this is the moment
everybody has to memorise them. "Who is who?" (`WhoIsWhoPanel`, gated per player locally)
lets the table check again later.

**Talk mode (`talkMode`, local only):** questions are asked aloud, and the device only records
what happened. `TalkTurn` puts all four outcomes on one screen (Yes / No / Got it / Wrong),
one tap, no Back, since nothing is staged. The log has no text, so `utils/answerTrail.js`
shows the answers as a trail, oldest first. The log itself is newest first, so the trail
reverses a COPY. It is a pure module so the flip is testable. The timer works in both modes;
online, each guesser's own device runs it.

## Online

`hooks/useRoom.js` configures `useRoomCore` with `playersPath: 'gameSession/players'` (every
other game uses `players`). **The secret is your own character**, in
`assignments/{playerId}`, which everyone except the owner may read and write. The rules
pattern is explained in `.claude/rules/online-rooms.md`.

- **The guesser's device never holds its own character.** It writes only raw question or guess
  text to `pendingAction`. Another device claims it in a transaction (`resolvePendingAction`)
  and resolves it: a question is answered by a human (`OnlineAnswererView`), a guess is graded
  automatically by whichever answering device wins the claim. A give-up goes the same way, so
  the lock can carry the character the guesser cannot read.
- **Assignment is a collective pick.** Every non-assignee shares ONE live proposal in the
  assignee's `assignments/` slot. Proposing overwrites the slot, which wipes every approval,
  so a changed pick must be re-approved. Once every non-assignee approves, any device locks it
  in (idempotent; a ref limits each device to one write).
- **Stamped, never cleared:** assignments carry `forRound`, so a stale pick from last round is
  unreadable rather than silently wrong.
- **`lastOutcome`** is the shared "what just happened" line. A remote guesser's turn ends the
  instant they act, so without it the answer would never reach their screen.
- **Banking a round is claimed (`claimRoundBanking`, keyed by round number).** `finishRound`
  and the below-two-players `endSession` hatch can both try to fold the locks into
  `totalScores`, and `applyRoundScores` is not idempotent. A failed claim is NOT swallowed:
  "someone else is banking" and "the write failed" need different handling.
- Starting a round and ending the session are host-only. Two devices dealing at once would
  compute different starting seats from their own view of who is here.
- Departures: `skipDepartedAssignment`, `skipDepartedTurn` and the `skipIds` on every turn
  rule step over anyone who left. Their log and turn count stay in case they come back.
  `smoke/aniguess.smoke.test.js` covers it.

Sounds are per phone: each phone sounds only for its own result, so a room of phones does not
chime at once for one player's answer.

Words the playtest strategy (`playtest/strategies/aniguess.js`) presses: "Resume game", "Pick
random", "Pick manually", "Re-roll", "Confirm", "Approve this pick", "Lock in", "Ask a
Question", "Submit Guess", the "Your question" / "Your guess" boxes with "Ask" / "Guess",
"Back", "Yes", "No", "Got it", "Wrong", "Pass the device", "Who is who?", "Peek at my anime
list", "New round", "End & see leaderboard", "Final results".
