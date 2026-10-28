# AniName — design notes

Loaded when Claude works on files in this folder. The cross-game architecture these notes
build on (rules.js, online rooms, presence, settings, profiles, styling) is in the root
`CLAUDE.md`.

## The game

`games/aniname/` (id `aniname`) is "I can name N". Each round deals a category, such as
"characters from Naruto" or "anime animated by MAPPA". The opener (rotating each round) must
open the bidding. Going round the table, everyone else raises or drops out, and dropping out
lasts for the round. When nobody will raise, the high bidder has `seconds` (default 60) to
type that many answers.

- **Made it:** the bidder scores the bid (`madePoints`).
- **Fell short:** everyone else still here scores `missPoints`, half the bid rounded up.

The clock is the same whatever the bid, so a big bid is a race. Caden settled the design in a
question round: an auction where the top bidder proves it, typed answers checked
automatically, the table able to overrule, and the name AniName. The category kinds were left
to Claude. Keep the bid-up-then-prove loop as its core; it is the mirror of AniPeek's
bid-down.

## Answers: three verdicts (`answers.js`)

**The deal carries categories only** (`{ kind, key, label, known }`). Every device builds the
same index from the room's copies of the profiles plus its own pack (`buildIndex`), and
`answersFor` derives a category's answers. A genre can have hundreds of shows behind it, so
the answers are never copied into a room.

**A typed name is `right`, `wrong` or `pending`** (`judgeName`). Our data is a slice: a list
holds the shows its player imported, a cast is the ~60 best-known characters, and the pack
covers ~1000 popular shows.

- **`right`:** the index says it belongs. Partial and reordered names count when they match
  exactly one answer: "Kakashi" is Kakashi Hatake, and "Uzumaki Naruto" is Naruto Uzumaki.
  "Uchiha" is several people, so it is not guessed. Punctuation splits words, so "Frieren"
  meets "Frieren: Beyond Journey's End".
- **`wrong`:** only when the index KNOWS the name and knows it does not fit. That means a full
  character name on record outside the show (or not a main, for `mains`), or a known show
  whose studio, year or genre is on record and different. **Tags never say wrong**, because
  the pack keeps only a show's top few.
- **`pending`:** everything else. These go to the table after the clock (`review`), but only
  when they could change the result.

There are no typeahead suggestions on purpose: a dropdown turns recall into recognition.

## Categories and the deal (`deal.js`)

The kinds and their `min` known answers are: cast (6), mains (4), studio (5), year (6),
genre (8) and tag (5). Voice-actor roles were left out, because the pack covers them too
thinly to be fair.

- **Categories come only from shows on the table's lists** (`categoriesFor`), and lean
  toward shows more players hold.
- No category repeats, no kind comes twice running when another can, and one show's cast is
  never asked for twice.
- Too few categories gives `{ error, found }`, and setup and the lobby keep a trial deal for
  the status line (`copy.js`).
- `TAG_SKIP` drops census tags, as in AniOut.

## Rules (`rules.js`)

- **The opener cannot drop out before any bid.** A table of one goes straight from its bid to
  naming. Local setup seats two by default (`useAutoSeat(…, 2)`), but one may play.
- **Reaching the bid in right answers ends the round at once.** A repeat (by key, so
  "Kakashi" after "Kakashi Hatake") is listed and counts for nothing.
- **Review settles as soon as the result is decided** (bid reached, or too few pending left).
  Anyone but the namer may rule (`canJudge`), and the namer may rule only when nobody else is
  here. Locally the device rules as any other seated player, because the table decides in
  person.
- **Time:** rules take `now`. Locally that is `Date.now()`, with the close on a timer set for
  the deadline. Online it is server time; the screen's clock drains to the deadline, and a
  second clock `NAME_GRACE_MS` later closes the round from any device (AniQuiz's
  arrangement), so a namer who closed their tab cannot hold the room.
- **Departures** (`settleIfComplete`):
  - a departed seat whose turn it is drops out (before any bid, the opening moves on);
  - a departed high bidder restarts the auction;
  - a departed namer voids the round;
  - below two online players, the game ends.

## Online

**Nothing is secret**, so everything lives in `state/`. The NAMER's device grades each name
before its transaction (`useNameRoom`'s `name`), against its own index. A forged verdict is
possible but visible, because every phone shows each answer as it lands.

`smoke/aniname.smoke.test.js` covers three things: a three-device game through the review,
the clock closing a round, and a namer leaving.

The playtest strategy (`playtest/strategies/aniname.js`) and `AniNameGame.test.jsx` press
these words:

- the "Count" stepper, "Bid N", "Drop out"
- the "Your answer" box, "Add", "I'm done"
- "Accept “x”" / "Reject “x”"
- "Next round", "See results"

The headings are:

- "<name>'s Bid" / "Your Bid"
- "<name>'s Turn" / "Your Turn"
- "Table Decides"
- "Named Them!" / "Fell Short" / "Round Void"

The game's ink is the decorative `--color-pop-umber` (index.css), wired into every accent map.
