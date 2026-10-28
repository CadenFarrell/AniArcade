# AniRank — design notes

Loaded when Claude works on files in this folder. Moved here from the root `CLAUDE.md`,
which still holds the cross-game architecture these notes build on (rules.js, online rooms,
presence, settings, profiles, styling).

## Board direction, scoring and the pool toggle

**AniRank's board runs top-down: slot 1 is the top of the ranking — the MOST of whatever
the axis measures.** `trueOrder` sorts *descending* to match, and every axis names its ends
`topLabel`/`bottomLabel` rather than low/high. That naming is the fix for a real bug, not
tidiness: `lowLabel`/`highLabel` said nothing about which way a vertical list runs, so the
board spent a release rendering `← OLDEST` beside the slot that held the newest show. Only
the comparator knows the direction — `rankMap` ranks by *position in the list it is handed*
and `scoreBoard` compares ranks with `<=`, so both are direction-agnostic and a future flip
means editing one line. `axes.test.js` pins labels to that line by running each fact axis's
`valueFor` through `trueOrder`; without it a flipped label pair passes the entire suite,
which is how the two drifted apart in the first place.

**Scoring is Kendall tau: every pair of cards, not the neighbouring ones.** `scoreBoard`
returns `concordant` out of `comparisons` — 45 on a full ten-card board — and that `<=`
(not `<`) is what makes a tie free, since cards sharing a value share a rank. It counted
only the nine *adjacent* pairs until a randomly-dealt board scored 6/9, which is the
measurement failing rather than the player succeeding: nine of forty-five relationships
cannot describe a ranking, and a card could sit nine slots from home and cost two points
because only its neighbours ever looked. Counting every pair is proportional, still
forgiving of one bad card (9 of 45, against 2 of 9 before), and never cascades.

That choice is also why the reveal is a slopegraph. Two lines between the player's column
and the real column cross **iff** those cards are inverted, so the crossings *are* the
points lost — the picture and the arithmetic are the same object, and nothing has to be
encoded as a number inside a cell. Every earlier attempt failed by printing a card's true
rank inside the slot it was placed in: two coordinate systems in one square, so "1 next to
6" read as a claim that ranks 1 and 6 are neighbours. `explainBoard` feeds the drawing
per-card `conflicts` (how many cards this one is inverted against, summing to twice
`inversions`) — never slot distance, which calls an unpenalised tie a mistake.

**Which pool you are ranking is a control, not a property of the mode you happened to pick.**
`AxisPicker` puts a Shows/Characters toggle above both mode boxes and filters everything —
both boxes and your own prompts — to that pool. Before it, `items` was discoverable only from
a grey line under each mode name, so half of every list was irrelevant: someone tiering their
shows was offered "Would win → Would lose".

**The tab is derived from the selection, never held in `useState`** — it is just
`getAxis(value).items`. There is no second copy to fall out of step, and three things come
free: opening the picker with `fight` saved shows the Characters tab; saving a character
prompt while looking at Shows switches the tab, because the save path already calls
`onChange`; and nothing new is remembered in `prefs.js`, since `axisId` already implies the
pool. Flipping the tab goes through `axes.js`'s **`axisForPool`, which preserves `kind`** —
somebody on "Release date" who flips to Characters is still asking a factual question. Every
other fallback that lands on `DEFAULT_AXIS_ID` (deleting the selected prompt; switching into a
tier format off a fact axis) has to route through it too, because that constant is a *shows*
mode and would otherwise flip the tab as a side effect.

**The line under a mode name renders only when `needsEndLabels(axis)`** — `kind === 'fact' ||
custom`. That rule lives in `axes.js` rather than sniffing the label for an arrow, because it
is a fact about those two groups: a built-in opinion `label` is *required* to read
top-to-bottom (see the AXES header), so "BEST → WORST" under "Best → Worst" is noise, while a
fact axis names a dimension and a custom prompt names a clause and neither says which end is
#1. `axes.test.js` pins both halves, including that every opinion label actually contains the
arrow it is trusted to have. `minCount` is a prop for the same class of reason: the count
badge reddens below what *this screen* needs, which is ten for a round and two for a tier list.

## The match, seat pace and the reader bonus

A round is now one stop in a match (`rounds`, `DEFAULT_MATCH_ROUNDS`; 0 is the old endless
"New ten"). `AniRankFinal` is the one screen that records history — `AniRankResults` used to
record every round as its own game. Online the host's "Next round" is `startGame(settings,
{ next: true })`, keeping totals and `matchLog/{roundIndex}` (written in the same claimed
write as the totals); a start from the lobby is a new match and clears both.

**Seat pace** (`pace: 'seat'`, local blind only) has each player place a whole board, then
pass the device — N handoffs instead of 10×N. `isSeatPace` is the one branch: `currentItem`
takes the player (their own placed count is their cursor), `pendingPlacers` waits on boards
that are not full, and `roundFinished` asks `everyonePlaced` as an open round does. The
shared cursor means nothing mid-round there, so nothing reads it.

**`READER_BONUS`** goes to the best guesser(s) of an opinion round, added AFTER the subject's
average is taken (`bestReaders`), so being read well never inflates the subject's own number.

## AniRank's other half: tier lists

`anirank/tiers.js` is a second pure module beside `rules.js`, not an extension of it. A
round deals ten cards and scores one board against an answer key; a tier list takes *every*
eligible show or character, has no answer key at all, and is kept afterwards. **Building one
is local and solo; comparing them is the only part that goes online.** Locally, `format` in
`prefs.js` routes `LocalGame` to `TierMode.jsx`. Online, the host's `startCompare` moves the
room to a `tiers` view that `RoomTiers.jsx` routes (publish → compare), where each player
sends one saved list to `state/tierLists/{playerId}` and `RoomCompare` draws everyone's
`compareLists` as a matrix. Nothing in a room edits a list — a list is every show on a
profile, sorted over an hour, and a room is not where that happens — so `TierPublish` reads
lists from localStorage and only chooses one. `startCompare` writes `tierLists: null`, so a
list published two sessions ago can never be compared as if it were sent just now, and the
room stays open, because publishing is not a turn and a late arrival can still join in.

**One shape covers both formats, and that is the load-bearing decision.** A list is rows,
each holding an ordered array of card ids; `format: 'ranked'` is *exactly one row* whose
array is the whole 1..N ordering, and `format: 'tiers'` is N labelled rows. So a "numbered
list" is not a second data structure, and every mutator, every test and the whole compare
path is written once — only the renderer branches. Same trick `pendingPlacers` plays: branch
at the single point the modes differ and nowhere else. The tray is derived (`trayCards`),
never stored, for the reason `unplacedCards` is.

**Cards are stored by folded key, never by AniList id, and never as objects.**
`normalizeProfile` runs `dedupeProfileAnimeList` on *every* read, rewriting an entry's `id`
and `title` to the best member of its franchise — so a list keyed on `anime.id` loses
entries between two sessions with no import in between. The ids are the ones `utils/deck.js`
already stamps (`franchiseTitleKey` / `characterNameKey`), which is also why a list and a
round can never disagree about what one card is. Storing objects instead of ids is the other
trap: `aniguess_profiles` is already several hundred KB on the same origin and
`storage.setItem` swallows a quota failure, so `useTierLists` reads back after every write
and surfaces a banner rather than letting an hour of sorting vanish quietly.

**`compareLists` deliberately does NOT reuse `scoreBoard`,** and reusing it looks free.
`scoreBoard` measures a board against an answer *key*: `rankMap` collapses the key's ties and
`ra <= rb` forgives them, so only one side's ties cost nothing. That is right when one side
is the truth. Two people's tier lists are equals, and a measure that changes when you swap
the arguments is not a measure of agreement — so both sides' ties are forgiven, which is the
same generosity stated symmetrically. `tiers.test.js` pins that with an explicit
swap-the-arguments test. What it *does* inherit is per-card `conflicts` as the blame metric,
for `explainBoard`'s reason plus one more: it is the only measure that survives comparing a
tier list against a ranked one, where "tier 2" and "position 2" are not the same claim.
A consequence the compare screen has to say out loud: a card can carry conflicts while
sitting in the *same* row on both lists, because everything that moved past it is an
inversion and conflicts blames both ends of one.

**Tap-to-assign is the primary gesture and the only keyboard path; drag is pointer-only.**
dnd-kit's `KeyboardSensor` activates on Space/Enter, the same keypress that fires a button's
click, so wiring it to a tile that is also tap-to-hold makes one key mean two things. Every
tile and every row target is a real `<button>` instead, which is a complete keyboard story;
`@dnd-kit` adds `useDroppable` per row and a `DragOverlay` on top of it for pointers only.
`PointerSensor` needs `activationConstraint: { distance: 8 }` or it swallows the click and
the primary gesture stops working.

**`utils/tierTone.js` is the one place red-at-the-bottom is semantic rather than vibe.**
`index.css` assigns lime = yes/correct and red = no/wrong; a tier list's top row *is* the
shows you say yes to. Every other ordered list in the app has no good/bad axis, which is why
`rail.js` steps one accent instead. Its ladder is five rungs *because* the default board is
S/A/B/C/D — a six-rung ladder made the middle row skip solid amber and come out olive — and
each rung carries its own text colour, because a solid ink rung takes `text-paper` while a
knocked-back /45 tint over paper is mid-tone and takes `text-ink`.
