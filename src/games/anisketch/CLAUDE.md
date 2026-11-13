# AniSketch — design notes

Loaded when Claude works on files in this folder. The cross-game architecture these notes
build on (rules.js, online rooms, `secrets/`, presence, settings, profiles, styling) is in the
root `CLAUDE.md`.

## The game

`games/anisketch/` (id `anisketch`) is draw-and-guess with the table's own characters. Each
turn one player draws: they pick one of `choices` (default 3) characters off their own list,
in secret, and draw them against the clock (`drawSeconds`, 60/80/100/120, default 80);
everyone else names the character. Drawers rotate, `laps` times round the table
(`shared/utils/match.js`). Settled in a question round (2026-11-13): typed guesses online,
shouted and tapped locally; a pen with sizes, a palette, an eraser, undo and clear.

**Scoring** (`rules.js`): a right guess is `GUESS_MAX × time left / drawing time`, never under
`GUESS_MIN`, and the drawer takes `DRAWER_PER_GUESSER` for every player who names it — a
drawing is worth making clear rather than cryptic. A turn ends when the clock runs out (plus
`GRACE_MS`, so a guess sent in the last instant is judged first), when everyone still here has
named it, or when the drawer gives up.

## The secret: the drawer's phone only

**The offer and the pick are in `secrets/{drawerId}`**, hidden from everyone but the drawer,
and dealt by the drawer's OWN device (AniTurf's and AniChain's rule: no other phone, the host's
included, ever draws or holds them). Each offer is stamped `forGame`/`forTurn`/`deal` and shows
only when all three match; the deal waits for the first `secrets/` snapshot, or a refresh would
deal over the real one. **The game never holds the character until the turn is over**: it
learns that the offer went out (`markDealt`) and, at the end, who it was (`publishReveal`).
Locally the offer lives beside the game in the hook's own state, the same split.

What follows from it, as in AniChain:
- **Only the drawer's device judges a typed guess** (`settleGuesses` takes the judge as a
  function). It blanks a right guess's text as it credits it — that text is the answer, and
  `state/` is read in full by every member. Wrong guesses stay, because the feed of wrong
  guesses is half the fun.
- **A drawer who leaves voids the turn** ("Round Void"): nobody else can say who it was. A
  departed player's later turns to draw are skipped (`nextTurn`), never voided one by one.
- The judge is `deal.js`'s `isRightGuess` over `shared/utils/nameMatch.js`: the full name in
  any order, or words that name exactly one character on the table's lists ("Kakashi" yes,
  "Uchiha" at a table of Uchihas no) — graded exactly as AniChain and AniName grade a name.

**The offer** (`offerChoices`): pictured characters only (the reveal is the portrait), never
one already drawn this game, in tiers that lean and never filter — on the drawer's list AND
someone else's first (`sharedFirst`), then the rest of the drawer's list, then anyone's (a
drawer with no list still gets a turn). This device's recent deals go last within a tier.

## The drawing: SVG, its own node, chunks

**The pad is SVG, never `<canvas>`** (`components/SketchCanvas.jsx`, `sketch.js`): every
stroke is a `<path>` in one 4:3 integer space (`VIEW`, 1000×750), so a phone and a laptop draw
the same picture from the same numbers — and jsdom, which has no canvas, can draw on it, so the
component test and the jsdom bots play real turns (the bots' `draw` action,
`playtest/core/draw.js`; the browser layer draws with the mouse).

**Online the strokes live in `rooms/{code}/sketch/{gameNo}-{turn}/s{i}`, a sibling of
`state/`** (`hooks/useSketch.js`'s `useRoomSketch`): four writes a second would otherwise
re-fire every member's whole-room subscription. A stroke is written `{ c, w }` when the pen goes
down and its points go out every `FLUSH_MS` as numbered chunks (`p/0`, `p/1`…), each a string
of "x,y" pairs sent once; the drawer paints its own pen from local points, never the echo.
Undo removes the last stroke; Clear removes the turn. The next drawer's device deletes the
turn before when it deals, so a room carries one finished drawing at most.
**`database.rules.json` caps what a write may hold**: members only; the turn key's and stroke
key's shape (so at most 1000 strokes); ink 0–6 and size 0–2; a chunk at most 1200 characters;
no other field. The per-turn totals (`MAX_STROKES` 300, `MAX_POINTS` 20k) are the client's —
a rule cannot count a node's children. An 80-second drawing is about 30–60 KB per guesser.

**The palette** (`INKS`) is content, not UI accents: six inks picked for HAIR (black, brown,
blonde, red, blue, pink), because hair is how most anime characters are recognised. Each swatch
is a button named by its colour and pressed state, never colour alone. The eraser paints the
paper colour, so Undo takes it back whole.

## Local play

One device, two jobs. The drawer takes it behind a `Handoff`, picks in private ("Pick What to
Draw"), sees the pick once more ("Ready to Draw"), turns the screen to the table and presses
"Start drawing" — the clock starts then, not at the pick. The table shouts; the drawer taps
"<name> got it", and the moment of the tap sets the points. "Peek" shows the name for two
seconds on a screen the table can see, so it is a peek and not a label.

## Words the bots and tests press

`playtest/strategies/anisketch.js` and `AniSketchGame.test.jsx`: "I'm <name> — ready", "Draw
<name>", "Start drawing", the pad (`[data-sketch="pad"]`), "Undo", "Clear", "<name> got it",
"Give up", "Peek", the "Your guess" box and "Guess", "Next turn", "See results"; the headings
"Pick What to Draw", "<name> Is Choosing", "Ready to Draw", "Draw!", "Guess the Drawing", "It
Was…", "Round Void". `smoke/anisketch.smoke.test.js` covers the secret reaching the drawer
alone, strokes and undo syncing, a wrong guess then right ones judged on the drawer's phone,
the old drawing cleared, the rules refusing oversized and outside writes, a departed drawer
voiding the turn, and the end below two.

The game's ink is the decorative `--color-pop-rose` (index.css), chosen by CIELAB distance
after fern green read as AniTag's lime on the board.
