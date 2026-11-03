# AniTag — design notes

Loaded when Claude works on files in this folder. Moved here from the root `CLAUDE.md`,
which still holds the cross-game architecture these notes build on (rules.js, online rooms,
presence, settings, profiles, styling).

## AniTag: the arcade's only inductive game, and its only two-player one

`games/categories/` (id `anitag`) is AniGuess inverted. There you are dealt a character you
cannot see and ask yes/no questions about it; here a **category** is hidden and you offer
characters — "Nezuko?" — until you can state the rule. Same hidden-value seam, opposite
direction of inference.

**A go is ONE name, and the seat moves after every one of them.** `settlePending` writes the
next `seatId` alongside the trail entry, so P1 names one thing, the table answers, and it is
P2's go — which at two players is the back-and-forth the game reads as, and at six means nobody
waits through five whole hands before their first name. `cap` is therefore **names per player
per round**, not the length of an uninterrupted block. What ends a player's *round* is unchanged
and is the only thing `results` has ever meant: a correct declaration, a give-up, or spending
the cap. Everyone else plays on until they each reach one of those, and the last player standing
simply keeps the seat (`seatFrom` falls back to them, because their own missing result is what
makes the scan wrap round).

`seatFrom` sits beside `nextSeatId` rather than inside it because the two callers want different
offsets, and that is the whole of the rotation: `startRound` scans from the **round number**, so
the opening seat moves between rounds; everything mid-round scans from **the seat's own index
plus one**, so a name hands on to the person sitting next. `nextTurn` is now the rare half — it
fires only from `turnEnd`, which only a *finished* player produces.

**One game; the only choice is where each clause comes from.** You hold a category everyone
can see except you, one derived judge answers your names against it, everyone else votes on your
guesses, and the rule you are inducing is your own. `categorySource` in `prefs.js` (copied onto the round as `source`):

| | `table` (the default) | `random` |
| --- | --- | --- |
| who sets your clause | everyone else, while you look away | the deal |
| round opens on | `picking`, one target at a time | the first go |
| online | a shared proposal in `assignments/{target}`, approved by every other active player | two dealers write `assignments/` |
| local | a `Handoff` ("Look away", "<name> is looking away — Ready!"), then the picker | nothing to do |

**The table pick is AniGuess's character assignment applied to a rule**, on purpose and down to
its words, so a table that has played one knows the other. `rules.pickingFor` is the target:
the first active player with no pick, counting from the round number, derived rather than stored
so a target who closes their tab is skipped instead of wedging the table. The picker
(`CategoryPicker`) offers the built-ins, this device's written ones, anything typed, and **"Deal
one at random"**, which fills the box (skipping clauses already locked this round) rather than
committing. Pickers score nothing; only the solver does — a deliberate call, not an omission.

**This replaced "pick your own"** (`chosen`): you picked a clause only you knew, everyone answered
every name against their own, and you declared somebody else's. It was a different game sharing
the folder, with its own judges, claims, reveal rule and owner points; all of it is gone. A saved
`categoryMode` pref is dropped by `mergePrefs` as an unknown key, `normalizeGame` drops a stored
`mode`/`reveal`/`targetId`, and a room caught mid-way through a `chosen` round across the deploy
is not repaired (its clauses were in `secrets/`) — returning to the lobby starts it clean.

**Online, the proposal lives in the target's own `assignments/` slot**, under the very
`category` field the round reads, so locking a pick is only `rules.recordPick`'s flag in
`state/`: the clause is already where the seat listener looks, and the target's device never
wrote or read it (the rule refuses both). A proposal is one whole-node write carrying a fresh
`nonce` and its proposer's approval; an approval records the nonce it approved, so one landing
just after a counter-proposal counts for nothing rather than for the new clause. Any device that
can see the proposal locks it once every OTHER active player has approved (not only the host, who
may be the target), in a transaction that re-checks the target; the last lock also opens the
round, and a host-only backstop opens it when the last player still waiting for a clause leaves.

**It needs no AniList import, and that is the property to protect.** A profile stores no studios,
no tags and no show-level genres (see the profile table in the root `CLAUDE.md`), so "wears glasses" is unanswerable by any
code in this repo and always will be. The judge is therefore a person, so a proposal is free text,
so nothing is drawn from anybody's list. `prefs.js` deliberately has no `sharedOnly`, no card pool
and no minimum list size, and `prefs.test.js` pins that by rejecting any key matching
`/shared|list|deck|fame|import/`. AniWave's default clue mode is the only other game with this
property. Adding a pool-shaped option here is adding the requirement itself — decide it out loud
rather than discover it.

**No `database.rules.json` change was needed**: `assignments/` (hidden from its owner, readable
and writable by everyone else) was already deployed for AniGuess. Putting a clause in `secrets/`
instead would show it to precisely the one player it is hidden from — see the node table in
`.claude/rules/online-rooms.md`.

**`random`: nobody deals their own, and two dealers is what guarantees it.** The host writes every
slot but its own; the first other seated player writes the host's. Both writes are legal under the
deployed rule and the forbidden one is refused by Firebase rather than by a client-side check, so
a bug there is a `PERMISSION_DENIED` instead of a silent leak. This is where the arcade escapes
AniFake's "whoever computes the deal learns it" concession rather than inheriting it: AniFake's
host holds a value *nobody* may know, while here every player is meant to know everyone else's, so
the only forbidden computation is a device's own — and two dealers arranges that. **One residual
limit, recorded rather than designed around:** the second dealer cannot read its own category, so
when drawing the host's it cannot exclude the one clause it holds. It excludes every clause it
*can* see, leaving a roughly one-in-a-dozen chance those two share. It is unfixable without a
server — any device able to exclude every dealt category would by construction know its own.

**A wrong declaration costs `WRONG_DECLARATION_COST` names, not the round, and it is carried by
the trail with no new state.** It used to end the turn outright, which was right when a turn was
an uninterrupted block of ten and is a spectator sport now that the seat moves every name — a
miss on name two would mean watching the rest of the round on a device you are holding. So the
miss lands in the misser's own trail as an entry with `kind: 'declaration'`, and
`proposalsUsed` **weighs** that entry rather than counting it. One entry does two jobs: the
penalty (and `used` already flows into `scoreTurn`, so it is priced in the currency the game
had), and a row the table can read. A miss that *spends* the cap does end the round, which is
the floor under the rule — without it a player one name from the cap could guess for free.

**Running out of names is not the end of your round: the go stays with you for one final
guess.** `settlePending` keeps the seat after a NAME that spends the cap, so the player hears the
answer to their last name and then declares or gives up (`proposeName` refuses at zero left, and
`TurnScreen` opens straight on the guess box with no way back to naming). It used to end the
round there and show the category, which spent the player's last piece of evidence for nothing.
A MISS that spends the cap still ends the round.

**A guess is voted on by the whole table, against the real category, on screen.** A name has
one judge; a declaration has everyone else still here (`requiredJudges`), and it counts when
MORE THAN HALF say yes — a tie is a no (`declarationPasses`). It settles only once every voter
still here has voted; a voter who leaves stops counting, and the online settler effect commits
the vote on who is left. Locally each player taps in turn ("<name>, your answer"); online every
phone votes, and the trail keeps each vote by name. The card shows the seat's clause under the
guess (behind a `CategoryPeek` on a shared device, where the guesser is sitting there) and its
buttons say "Yes — same category" / "No — not it", with a line that close is a no. One judge
answering a bare Yes from memory let near-misses through, and a yes pays full marks.

**Two named fields exist only because a miss no longer stops the round to announce itself.**
`normalizeTrail` has to carry `kind` — an entry that came back as a plain name would silently
refund two thirds of the penalty — and `lastPlayed` is one overwritten slot holding what the
table just watched, which is what the turn screen says out loud now that there is no `turnEnd`
screen to say it. Both are the "rebuild from NAMED fields" trap, one level apart.

**Who opens still rotates between rounds** (`startRound` passes the round number as
`nextSeatId`'s `startAt`), and so does who looks away first (`pickingFor` passes it too).
Passing 0 reproduces plain roster order exactly.

**The judge is derived, never stored,** and that is what makes a judge who walks out a non-event:
`judgeIdFor` returns the next active player on the next render, with no write, and they rule
instead. Do not "fix" this by storing a `judgeId`. `requiredJudges` returns a LIST — one judge for a
name, the whole table for a guess — and `settlePending` is a separate pure function from
`judge`, because a departure can make a pending settleable with no new verdict, and only an
effect notices that. An empty required list (nobody left to answer) ends that player's round
rather than inventing a verdict. Only a departed **hot
seat** needs `skipDepartedSeat`, because only they hold a go nobody else can finish — and it
keeps the round in `picking` if that is where it was, or it would open a go before the table has
clauses to answer with.

**The hot seat can never publish their own answer,** which is the mirror of AniFake's
`publishCard` and lands in the same place. At the end of their round they are the one person who
still does not know what their clause was, so `attachCategory` lets *any* non-owner write it onto
the result — idempotent, refuses to overwrite, so a judge who leaves between ruling and revealing
costs nothing.

**A player's written categories never enter room state.** Each device draws from — or offers —
the built-ins plus its own local list (`anitag_custom_categories`), and only the clause actually
in play is published, the same rule AniWave applies to written spectra. The visible consequence
in a random deal, which is fine: the host can only ever receive a built-in or something the second
dealer wrote, never one of their own.

**One pool per session, not one per player.** The hot seat cannot see their clause, so the prompt
telling them whether to name a show or a character is the only thing that says which pool it is
about, and a per-player pool would turn that prompt into a clue. When the table picks, the pool
also tells them what kind of clause to pick.

**A trail entry carries a verdict *map*, not a boolean** (`{ text, verdicts: { [judgeId]: bool } }`):
one entry for a name, one per voter for a missed guess, where who said no is worth seeing.
`verdictsOf` is the one place that flattens the stored shapes, including the unattributed scalar
an older build wrote, so no screen branches.

**There is deliberately no "skip my go".** `passTurn` drops you out of the round; nothing passes
the seat on for free. Now that the seat moves every name, a free skip would be a stalling
strategy — sit out every go, watch everyone else's verdicts accumulate, then declare off their
evidence with a full cap in hand. Naming one thing is the price of staying in.

**Local play has two private moments and no pass screens during the round.** When the table
picks, each target looks away once per round while the device shows everyone else the picker.
After that the device sits in the middle and `CategoryPeek` hides the seat's clause behind a
toggle (re-closing on every name), and the moving seat costs nothing: a go changing hands is
somebody leaning over, not a handover. It is a **toggle rather than a hold** for the reason
AniRank's tier board gives about dragging: a keyboard user cannot hold a button, so the tap path
has to be the real one.

**The screens follow from the moving seat, and three of them exist only because of it.**
`SeatStrip` draws the whole rotation from `turnOrder` (roster order *is* seat order), because
otherwise the only evidence the seat moved is a heading that changed — which reads as the game
jumping. `TrailBoard` groups every trail by owner with yours open and the rest collapsed: one
trail was complete while a turn was a block, and now a player's own evidence would leave the
screen the instant they hand the go on. And `TurnScreen` is a header, **one** card and the trail:
`judging` and `naming` are mutually exclusive by construction, so exactly one of them is being
asked of you and it gets the only surface. `AniTagSettings` is shared by the setup screen and the
lobby for the root `CLAUDE.md`'s own near-twin reason — it was the same hundred lines in both files.
