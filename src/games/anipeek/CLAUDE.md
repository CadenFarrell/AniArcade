# AniPeek — design notes

Loaded when Claude works on files in this folder. The cross-game architecture these notes
build on (rules.js, online rooms, presence, settings, profiles, styling) is in the root
`CLAUDE.md`.

## The game

`games/anipeek/` (id `anipeek`) hides a character's portrait under a 5×7 grid of tiles (`COLS`×`ROWS`, 35). The
opener (rotating each round) must bid how few tiles they need to name the character; round the
table, everyone else bids LOWER or passes, and a pass sits out the round's bidding. The lowest
bidder then spends the bid: a tile costs 1, a hint card (studio, first aired, format, source)
costs `HINT_COST` (4), and they may name the character at any point. Right scores `35 − bid`;
wrong pays `WRONG_BONUS` (7) to every other player still here, and in multiple choice also
costs the bidder `MISS_COST` (7, scores may go negative). It is an original design,
settled in a question round — keep the bid-down-then-prove loop as its core.

**The score is `TILES − bid`, never "tiles still covered".** With hints in the game the two
disagree, and the bid is the number the bidder chose in front of the table. Stopping early
never changes the score, which keeps the bid the one decision that prices a round. The miss
bonus exists so the lowest bid is never free.

**Multiple choice charges the bidder for a miss (`MISS_COST`, 2026-11-04).** With the bonus
alone, a blind guess among four names (right a quarter of the time) at a 1-tile bid averaged
8.5 points against each opponent's 5.25, and a bid of 1 closes the bidding, so the opener's
best move was always "1" and the round a coin toss. With the cost the blind guess loses ground
(`rules.test.js` pins the arithmetic), while recognising a face from one tile still pays.
Typed answers keep the bonus alone: a blind typed guess is almost never right. No floor at
zero, or the cost would be free at the start of every game.

**The board was 4×4 and became 5×7** (16 tiles gave away a sixteenth of the face per tile and
left bids only 1–15). `HINT_COST` and `WRONG_BONUS` were tuned at 2 and 3 on the 16-tile
board and are derived from `TILES` (×TILES/16) so a hint and a miss keep their weight on any
board; the opener's default bid (`OPENING_BID`) and the reveal cascade's per-tile delay follow
`TILES` too. Retune the board in `COLS`/`ROWS` alone — but the playtest strategy copies
`MAX_BID` as a literal (Node cannot load `rules.js` there).

**Nothing in this game is private**, which is why local play has no handoff (the device goes
to whoever the heading names) and online play has no `secrets/` node. Bids are spoken, the
tiles come off in front of everyone, and a bought hint is face up for the whole table. On the
reveal every hint goes face up (`HintCards`' `showAll`), bought or not, as the recap.

## The pool and the deal

`utils/pool.js`'s `portraitPool` is `shared/utils/characterPool.js`'s `characterOwners`,
filtered three ways:

- **A real portrait**: AniList's no-picture stand-in is a real image at `…/default.jpg`, so a
  non-empty `imageUrl` is not enough.
- **Never a face someone is wearing**: every seat's portrait (`portraitsFor`) sits whole in
  the score row above the board all round, so dealt under the tiles it would be the answer on
  screen. Filtered in the pool rather than the deal, so the setup count is the number the deal
  draws from.
- **`sharedOnly`**: only characters on every list. It is off by default, since a shared pool
  rarely reaches eight portraits. The deal leans toward characters more players know either
  way: banded by owner count, then a window twice the size needed, shuffled.

`deal.js` decides everything once, on the dealing device: `rounds + SPARES` cards, each with its
options and hints, so guests never need the pack. **Wrong options come from the same show
first, then the same gender, then anyone** (AniFake's `pickDecoy` idea), so the options cannot
be ruled out at a glance. **With hints on, only one of them may share the show:** the hints
describe the show, so four names from one show all fit every card, and a hint bought for 4 tiles
told the bidder nothing. **Hints come from the player's own import first, then the fact pack**
(`resolveShowKey`): older imports carry none of `studio`/`format`/`source`/`seasonYear`, and the
playtest fixtures carry only the year. A fact neither has is still a card, disabled, saying "No
studio on record". Labels come from `shared/utils/mediaLabels.js`, which AniQuiz shares.

Grading is `names(card, text)`: the folded name, or the same words in any order, because
romanized names arrive family-name-first from some lists and given-name-first from others.

## The board

`PeekBoard` draws the portrait in full colour (colour is half of recognising someone from one
square of hair) in AniList's own 2:3 frame, so nothing is cropped where it could never be
uncovered. **Nothing names the character before the reveal:** the image's `alt` stays empty
until then, and the covered tiles are opaque blocks rather than a filter. Each tile's ink rule
is an OUTSET box-shadow, which also paints over the sub-pixel seam between two tiles; a border
inside each tile leaves a hairline of picture at some zoom levels.

**A portrait that will not load can be skipped, before any tile is open** (`skipCard`). Dead
CDN links happen, and offline the service worker never caches another origin. A skip swaps in
the next spare and restarts the bidding, since every bid was a price for the picture that is
gone. After a tile is open it is refused: the table has seen part of THIS picture. With no
spare left, the round is void. jsdom never fires `load` or `error`, so nothing gates on the
image loading; the tiles are live as soon as the round is.

A tile that comes off while the board is on screen leaves a GHOST that lifts away (`tile-lift`,
aria-hidden, never a button), and at the reveal every tile still covered lifts off in a cascade
over the picture, which is already there with its name. Both are decoration over a board that is
already in its new state, so the bots and a screen reader never wait on them.

## Online

`hooks/usePeekRoom.js` is AniQuiz's shape: a `deal` node written once and a `game` node moved
by transactions. **The answer is in `state/deal`, a stated concession** (AniQuiz's and
AniTune's): everyone looks at one portrait, so no device may hold the name and none may not.
The image URL is the same story, since every phone must load the picture to tile it. Handlers
act as this device's seat and ignore the id `PeekRound` passes first.

`settleIfComplete` covers departures:

- a departed bidder whose turn it is passes (or, before any bid, the opening turn moves on);
- a bidder who leaves mid-peek voids the round (`result.void: 'left'`, no points either way);
- below two players, the game ends.

The one-shot key names round, card, phase, turn and bid, because the view stays `round` all
game. `smoke/anipeek.smoke.test.js` covers a full three-device game and both departures.

Words the playtest strategy (`playtest/strategies/anipeek.js`) and `AniPeekGame.test.jsx`
press: the "Tiles" stepper, "Bid N", "Pass", "Uncover tile N", "Hint: <label>", "Name them",
the "Answers" radios with "Lock in", the "Your answer" box, "Skip this character", "Next
round", "See results". The headings are "<name>'s Bid" / "Your Bid", "<name>'s Peek", "Name
Them", "Named!" / "Missed!" / "Round Void".
