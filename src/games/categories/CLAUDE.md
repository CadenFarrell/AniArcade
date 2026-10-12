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

**It comes in two modes, and they are mirror images.** `categoryMode` in `prefs.js`:

| | `chosen` (the default) | `dealt` |
| --- | --- | --- |
| your clause | you **pick** it; only you know it | you are **handed** one; everyone but you knows it |
| who answers a name | **every** other player, each against their own | one derived judge, against the seat's |
| what you declare | somebody **else's** rule, at a named target | **your own** rule |
| where it lives | `secrets/{playerId}` | `assignments/{playerId}` |

**`requiredJudges` is the entire branch between them, and keeping it that way is the load-bearing
decision.** One round shape, one `pending` slot, one `trails` map, one `results` map, one
`scoreTurn`, one departure story. Every mutator asks the same single question — *who must rule on
the thing currently pending?* — and nothing else in `rules.js` learns that modes exist. That
survived the seat starting to move: `judge` and `settlePending` now take `playerIds`/`skipIds`,
but purely to answer *who sits next*, which is a question neither mode answers differently. It is the
same move `tiers.js` makes with "a ranked list is exactly one row". Adding a second branch is how
this becomes two games sharing a folder.

**It needs no AniList import, and that is the property to protect.** A profile stores no studios,
no tags and no show-level genres (see the profile table in the root `CLAUDE.md`), so "wears glasses" is unanswerable by any
code in this repo and always will be. The judge is therefore a person, so a proposal is free text,
so nothing is drawn from anybody's list. `prefs.js` deliberately has no `sharedOnly`, no card pool
and no minimum list size, and `prefs.test.js` pins that by rejecting any key matching
`/shared|list|deck|fame|import/`. AniWave's default clue mode is the only other game with this
property. Adding a pool-shaped option here is adding the requirement itself — decide it out loud
rather than discover it.

**Neither mode required a `database.rules.json` change**, because both read-gated nodes were
already deployed. Which one a clause belongs in is decided by *who must not see it*, and AniTag is
now the worked example on **both** rows of that table — see the node table in the root `CLAUDE.md`'s Online rooms section. Reaching for the
wrong one is silent: a `chosen` clause in `assignments/` is readable by everyone it is hidden
from, and a `dealt` one in `secrets/` is readable by precisely the one player the mode is built
around keeping in the dark.

**`dealt`: nobody deals their own, and two dealers is what guarantees it.** The host writes every
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

**`chosen`: there is no deal at all**, which is strictly stronger and much less machinery. Every
device writes its own clause to its own `secrets/` node and nothing else, so no device ever holds
a value it is not entitled to. The round opens in a `picking` phase and waits until every
**active** player has committed one — active, so a closed tab cannot hold the table on the opening
screen forever.

**First claim wins, and it plugs a real hole rather than adding flavour.** Verdicts are public —
the trail *is* the information channel — so the moment P1 correctly declares P2's clause the whole
table knows it, and `scoreTurn` pays a solve with **zero names spent the maximum**. Without a rule,
a later seat re-declares it for free and outscores the person who worked it out. So a player can
be correctly declared exactly once per round: `claimedTargets` records it, `declarableIds` stops
offering them, `declareCategory` refuses. Three consequences worth keeping:

- **A wrong declaration claims nobody.** Missing at somebody must not lock them away from the
  players who could have got them — and the softened miss below makes that matter more, not
  less: a missed player is still worth full marks to everybody else.
- **`revealAllowed` is the same fact read from the other side.** A clause may be shown once its
  owner is claimed (it is worth nothing now) or at `roundEnd`, and **never** after a wrong
  declaration — revealing an unclaimed clause hands the next seat exactly the free points the
  claim rule exists to deny. `publishCategory` is AniFake's `publishCard` shape: the owner is the
  only device that can publish, because they are the only one that can read.
- `declarableIds` **can legitimately come back empty** — at three or more players when everyone
  else has been claimed, and at any size once a seat has missed at everybody left. The screen has
  to say so rather than render a dead control.

**A wrong declaration costs `WRONG_DECLARATION_COST` names, not the round, and it is carried by
the trail with no new state.** It used to end the turn outright, which was right when a turn was
an uninterrupted block of ten and is a spectator sport now that the seat moves every name — a
miss on name two would mean watching the rest of the round on a device you are holding. So the
miss lands in the misser's own trail as an entry with `kind: 'declaration'`, and
`proposalsUsed` **weighs** that entry rather than counting it. One entry does three jobs: the
penalty (and `used` already flows into `scoreTurn`, so it is priced in the currency the game
had), the record `declaredTargets` reads to stop the same person being aimed at twice, and a row
the table can read. A miss that *spends* the cap does end the round, which is the floor under the
rule — without it a player one name from the cap could guess for free.

`declaredTargets` is the mirror of `claimedTargets` and deliberately **not** the same shape: a
claim is global (nobody may declare that player again), a miss is personal (only the player who
spent the names is barred). Hence one takes a `playerId` and the other does not. Both are
subtracted by `declarableIds` and refused by `declareCategory`, so a stale screen cannot spend
names on a declaration that was never going to land.

**Two named fields exist only because a miss no longer stops the round to announce itself.**
`normalizeTrail` has to carry `kind` and `targetId` — an entry that came back as a plain name
would silently refund two thirds of the penalty *and* unlock the target — and `lastPlayed` is one
overwritten slot holding what the table just watched, which is what the turn screen says out loud
now that there is no `turnEnd` screen to say it. Both are the "rebuild from NAMED fields" trap,
one level apart.

**Who opens still rotates between rounds** (`startRound` passes the round number as
`nextSeatId`'s `startAt`). With the whole table answering every name, whoever opens has seen the
fewest verdicts about clauses they may declare; rotating spreads that across the session. Passing
0 reproduces plain roster order exactly.

**The judge is derived, never stored,** and that is what makes a judge who walks out a non-event.
In `dealt` mode `judgeIdFor` returns the next active player on the next render, with no write; in
`chosen` mode a departed judge simply stops being required. Do not "fix" this by storing a
`judgeId`. What the second case *does* need is `settlePending` as a **separate** pure function
from `judge`: the required set shrinks on a departure, so a pending that could not settle a minute
ago can settle now with no new verdict at all — and the only thing that can notice is an effect,
which has no verdict to submit. An empty required list ends that player's round rather than
inventing one. Only a departed **hot seat** needs `skipDepartedSeat`, because only they hold a go
nobody else can finish — and it keeps the round in `picking` if that is where it was, or it would
open a go before the table has clauses to answer with.

**The hot seat can never publish their own answer in `dealt` mode,** which is the mirror of
AniFake's `publishCard` and lands in the same place. At the end of their round they are the one
person who still does not know what their clause was, so `attachCategory` lets *any* non-owner
write it onto the result — idempotent, refuses to overwrite, so a judge who leaves between ruling
and revealing costs nothing. `chosen` mode inverts it exactly: only the owner can, because only
the owner can read.

**A player's written categories never enter room state, in either mode.** Each device draws from —
or offers — the built-ins plus its own local list (`anitag_custom_categories`), and only the clause
actually in play is published, the same rule AniWave applies to written spectra. The visible
consequence in `dealt` mode, which is fine: the host can only ever receive a built-in or something
the second dealer wrote, never one of their own.

**One pool per session, not one per player** — and the two modes need it for different reasons. In
`dealt` the hot seat cannot see their clause, so the prompt telling them whether to name a show or
a character is the only thing that says which pool it is about, and a per-player pool would turn
that prompt into a clue. In `chosen` everybody knows their own, but they are all answering the
*same* name, so one player holding a clause about shows while the table names characters can only
ever say no.

**A trail entry carries a verdict *map*, not a boolean** (`{ text, verdicts: { [judgeId]: bool } }`
— `dealt` is simply a map of one), because in `chosen` mode *which* player said no is the entire
fact. `verdictsOf` is the one place that flattens the three stored shapes, including the
unattributed scalar a pre-`chosen` build wrote, so no screen branches.

**There is deliberately no "skip my go".** `passTurn` drops you out of the round; nothing passes
the seat on for free. Now that the seat moves every name, a free skip would be a stalling
strategy — sit out every go, watch everyone else's verdicts accumulate, then declare off their
evidence with a full cap in hand. Naming one thing is the price of staying in.

**Local play's handovers differ by mode**, which is the one place the modes really diverge on a
shared device — and the moving seat costs neither of them anything, which is worth stating
because it is not obvious. `dealt` has no pass screens: the only hidden value is the seat's
clause, so the device sits in the middle and `CategoryPeek` hides that one thing behind a toggle
(it now re-closes on every name rather than once a turn). `chosen` has **one pass screen per
player per round** and then none at all: a clause has to be on screen exactly once, while its
owner picks it, because every judge afterwards rules from memory. Between picks nothing hidden is
on the device, so a go changing hands is somebody leaning over, not a handover. Both use a
**toggle rather than a hold** for the reason AniRank's tier board gives about dragging: a
keyboard user cannot hold a button, so the tap path has to be the real one.

**The screens follow from the moving seat, and three of them exist only because of it.**
`SeatStrip` draws the whole rotation from `turnOrder` (roster order *is* seat order), because
otherwise the only evidence the seat moved is a heading that changed — which reads as the game
jumping. `TrailBoard` groups every trail by owner with yours open and the rest collapsed: one
trail was complete while a turn was a block, and now a player's own evidence would leave the
screen the instant they hand the go on. And `TurnScreen` is a header, **one** card and the trail:
`judging` and `naming` are mutually exclusive by construction, so exactly one of them is being
asked of you and it gets the only surface. `AniTagSettings` is shared by the setup screen and the
lobby for the root `CLAUDE.md`'s own near-twin reason — it was the same hundred lines in both files.
