# AniOut — design notes

Loaded when Claude works on files in this folder. The cross-game architecture these notes
build on (rules.js, online rooms, presence, settings, profiles, styling) is in the root
`CLAUDE.md`.

## The game

`games/aniout/` (id `aniout`) is "who doesn't belong". Each round deals a grid of characters
(`cards`, 5–7, default 6) from the seated players' lists. All but one share a hidden
connection. Everyone picks the odd one out in secret, then, with `reasons` on, picks why the
rest belong from four sentences. A right pick scores `PICK_POINTS` (2). A right reason adds
`REASON_POINTS` (1), but only beside a right pick, so a lucky tap is worth less than knowing.
There is no timer and no speed bonus, because neither is fair on one passed-around device.
This is an original design, settled in a question round (Caden named it and chose secret
picks; the connections and scoring were left to Claude). Keep the pick-then-why loop as its
core.

## Connections (`connections.js`)

**Rule kinds** are what a round can be about: same show, studio, debut year, source, genre,
tag, and Japanese voice actor. **Check-only kinds** are gender, role and format: a round is
never built on one, but every round is checked against them. Gender matters most, because
every portrait shows it. Each card carries `vals[kind]`, an array of `{ key, label }` or
`null`.

**Null means unknown, never "none".** Every check treats an unknown conservatively.
`weight` sets how often a kind is reached for. Source has few values and most anime are manga,
so it is light. The same-show round is the easy one and is capped at ⌊rounds/4⌋. A kind never
comes up twice in a row when another kind can be built.

Every reason sentence starts "All …". The bot tells reasons apart from characters by the
radio's "Reason: " name, never by "All", because a character can be called All Might.

## The deal: exactly one answer (`deal.js`)

`validRound` is the whole difficulty of the game. It runs three checks:

1. **The rule holds.** The five share the value, and the odd one is KNOWN to lack it.
2. **The odd one stands out on nothing else.** Every value the five share, the odd one shares
   too. This gives one true reason, and the odd one is never also "the only woman". A same-show
   round skips the show-level kinds here, because five Naruto characters also share Naruto's
   studio and year, and that difference IS the show.
3. **No other card stands out on anything.** If a card is unknown on a kind where the other
   five agree, the round is refused. A player who knows what we don't could rightly pick it.

**A show-level rule draws its five from five different shows** (`pickGroup`), so "same show"
can never stand in for "same studio".

**The odd one is a near miss.** Candidates are sorted by how much they share with the five,
so the odd one tends to be a stranger who almost fits. The search has fixed budgets
(`BUCKETS_PER_KIND`, `GROUPS_PER_BUCKET`, `ODD_SAMPLE`, `ODDS_PER_GROUP`). On the playtest
fixtures, a three-player deal takes about 10–20ms.

**Fresh faces come first.** If a list is too small, a face may repeat among the five, but
the same character is never the odd one twice in a game. Faces this device dealt in its last
few games come before that (`recent`, `shared/utils/recentDeals.js`), as a tier, never a filter.

**"Shared characters first" is a lean, not a gate** (the `sharedOnly` pref, 2026-11-04). A game
dealt only from characters on every list almost never fills on real lists (a non-show round
wants five of them from five shows plus a sixth one fact away), so the option refused to start
for nearly every table. `dealGame` now tries the shared pool, and when it falls short deals
from everyone's lists and marks `sharedFallback`, which the status line says out loud.

`deal.test.js` checks every dealt round against an independent `cardsOut` written from the
rules' text, so `validRound` cannot vouch for itself.

**Decoy reasons** (`decoysFor`) are "All <value>" for a value at least one of the five is KNOWN
to lack, because an unknown could make the sentence true. The most plausible decoys come
first (a value most of the five hold), with one per kind before any kind repeats.

**Short lists say so.** `dealGame` returns `{ error, found }` instead of dealing fewer rounds.
Setup and the lobby keep a trial deal of the table as it stands (`copy.js`'s `setupStatus`),
because nothing short of dealing tells you how many rounds a list holds. `ShortBanner` lists
the fixes, and the bot's `fixBlocked` applies them, opening the More settings fold first.

## "Groups of four" (`groups.js`, 2026-11-13)

A second game on the settings card (`mode: 'groups'`, a whole match one or the other; Caden
chose secret sorts and a per-match setting). A board is 16 characters in four hidden groups of
four; each player sorts it in secret, and `boards` (default 3) is the match. **Odd one out
stays the default**, so a saved table keeps the game it knows.

**What counts as a group is the rule the table is told: something those four share and NO
other card on the board has.** "Any four sharing any value" could not work: broad values
(most anime are manga, half a board is women, "Action") nearly always allow a second sort,
and almost no board would deal. From that rule, `validBoard`:

1. **Each dealt group is tight**: its four hold the value and the other twelve are KNOWN to
   lack it.
2. **The sort is unique**: every four-card set that could be a tight group on ANY kind
   (check-only gender, role and format included) is a candidate, an unknown counting as
   possibly holding the value and four cards unknown on a kind as possibly sharing an unseen
   one. An exact-cover search over them (bitmasks, stop at 2) must find exactly one
   partition. A red herring (a studio-group card from group B's year) is allowed, and is the
   puzzle, as long as only one whole sort survives.

`groups.test.js` checks dealt boards against an independent brute force written from the
rule's text, not from `candidateGroups`. **Tags and voice actors come only from the pack**,
so a board needs it: on the playtest fixtures with the pack, tables of one to three deal three
full boards every seed in 3–12ms; with no pack, none. The cards known on every rule kind are
tried first (`buildBoard`'s `sure` tier). A list that cannot hold four groups gets a board of
three (`BOARD_GROUPS`); fewer than that is `{ error, found }` and the usual banner.

**Scoring**: `GROUP_POINTS` (2) per group matching a true group as a set, `REASON_POINTS` per
right reason beside a right group (reasons on: the board's true sentences among two decoys,
`decoySentences`, false of every group). Getting all but one group right means all of them,
so a sort scores 0, …, n−2 or n groups. `correct` is the whole board and `reasonRight` every
reason too, so the reveal sound, history and awards read both modes. A board's log line
carries `sorted` (groups right per player) instead of `picks`, so the three awards that quote
a wrong card skip it, and the rest say "board 2" for "Denji". The house rule of five good
awards held, so the groups feat is "Full marks" with its own words, not a sixth title.

**Screens**: `SortBoard` (tap four characters, toggles named by name, "Make group"; the last
group makes itself; a row's "Undo group A"; each row's reasons are "Group A reason: …") and
`BoardReveal` ("The Groups": each true group's sentence and cards, then "n of 4 groups" per
player). Headings "Sort the Board" / "The Groups", "Next board". Rows are told apart by
letter, never colour. `smoke/aniout.smoke.test.js` sorts a board on three devices, passing
the host a synthetic pack.

## Where the facts come from (`utils/pool.js`)

`cardPool` builds on `characterOwners` and keeps pictured characters only (`hasPortrait`, now
in `shared/utils/characterPool.js`). Facts are read **from the player's import first, then the
fact pack**, AniPeek's `hintsFor` order. Lists imported before the show stats existed carry no
studio, source or format, and neither do the playtest fixtures, so the pack fills them. Tags
and voice actors come only from the pack, so those rounds are only dealt from shows the pack
covers.

- **Year** is the debut year: the list's `seasonYear`/`startDate.year`, then the pack's
  `startYear` (the same earliest-season fold), then its `seasonYear`.
- **`TAG_SKIP`** drops cast-census and rating tags ("Heterosexual", "Primarily Teen Cast"),
  which read badly as a reason.
- Setup holds Start while the pack loads, because the pack supplies most of what a round is
  built on.

## Screens

- **Cards show the portrait and name only.** The show and each card's value appear at the
  reveal, because knowing the shows is the game. The portraits are in colour.
- **Locally**, the device is passed round. `LocalRound` follows AniQuiz's `holding` pattern
  (`stillToPick(...)[0]`, a `Handoff` whenever the next picker is not the holder), and a table
  of one gets no handoff.
- **Online**, the deal and the picks are in `state/`. This is the stated concession AniQuiz and
  AniPeek make: everyone sees the same cards, so nothing can be hidden from some devices and
  not others. The screens hide picks until the reveal.
- **Departures.** The gate counts the active roster, and `settleIfComplete` reveals when the
  last missing player leaves (never with zero picks in). Below `ONLINE_MIN_PLAYERS` (2) the
  game ends. The one-shot key names the round and the phase.
- **Tests.** `smoke/aniout.smoke.test.js` covers a three-device game, a departure mid-pick and
  the end below two.

The playtest strategy (`playtest/strategies/aniout.js`) and `AniOutGame.test.jsx` press these
words:

- the "Characters" radiogroup (by character name)
- "Reason: …" radios
- "Lock in", "Next round", "See results"
- "I'm <name> — ready" (handoff)
- the headings "Who's Out?" / "Who Was Out"
- in "Groups of four": character toggles, "Make group", "Undo group <L>", "Group <L>
  reason: …", "Next board", the headings "Sort the Board" / "The Groups"

The game's ink is the decorative `--color-pop-moss` (index.css), wired into every accent map
beside `plum` and `slate`.
