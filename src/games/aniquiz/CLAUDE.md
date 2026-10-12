# AniQuiz — design notes

Loaded when Claude works on files in this folder. Moved here from the root `CLAUDE.md`,
which still holds the cross-game architecture these notes build on (rules.js, online rooms,
presence, settings, profiles, styling).

## AniQuiz: the fact pack's game

`games/aniquiz/` (id `aniquiz`) is trivia built from the credits: studios, directors,
composers, source material, air dates, voice actors and casts, all out of the fact pack. It
has two formats over one clue generator — a **board** (category columns, a Daily Double, a
wagered final) and a **quick quiz** (a straight run, easiest first) — and two answer styles,
multiple choice and typed.

**`clues.js` turns the pack into clues, and a clue carries everything grading needs.**
`accept` is a list of folded answers and `rules.js` grades by membership in it, never by
consulting the pack. That is what lets a room grade inside a transaction on any device,
including a guest whose pack failed to load: only the host needs the pack, to deal. A guest
without it loses nothing but typed-answer suggestions.

**Clues run both ways, and a reverse clue accepts every show in the WHOLE pack that fits it.**
"Bones animated this 2016 TV series" has more than one right answer, and marking a player
wrong for naming the other one is the game lying. The intended show leads the reveal and the
rest are listed as `alsoAccepted`. Distractors exclude everything in `accept`, so a "wrong"
option can never be marked right; `clues.test.js` checks every candidate in a synthetic pack
for exactly one accepted option. A description that fits more than `MAX_ACCEPT` shows is not a
clue and is dropped.

**Difficulty is obscurity and field blended, and obscurity is a percentile WITHIN THE POOL IN
PLAY.** Field alone prices every studio clue the same; obscurity alone makes the composer of the
most popular show a 200-point clue. An absolute scale would put all of a small shared list in
the cheap rows, so a table's twelve shared shows still spread 200 to 1000. A board column is
then a ladder: one clue drawn from each fifth of the column's difficulty range.

**Options are built only for clues actually dealt.** Building them for every candidate (~10k
over the whole pack) took a deal twenty seconds; the reverse-clue lookups are bucketed once per
pack (`lookups`, memoized on the index object) for the same reason.

**`deal` and `game` are separate, AniTune's `round`/`game` split.** The deal (thirty clues with
their accept lists and options) is written once; every answer is a transaction on `game`
alone, so those writes stay small. Every rule therefore takes the deal as an argument.

**Everyone answers every clue, privately, and the pick rotates round the table.** There is no
buzzer and no "whoever got it picks": with everyone answering at once that is usually several
people, and breaking the tie by speed would make the board a race. **A wrong answer costs
nothing unless it was wagered** — with simultaneous answers a miss penalty mostly punishes a
guess. A wager is different in kind: the player chose the stake. A blank at the clock on a
wagered clue loses the stake too, or sitting out the clock would be the safe play.

The Daily Double never sits in the top row (a wager on the easiest clue is free money), and
its stake floors at `DD_FLOOR` so a player on zero can still make it a swing. The final waits
only on players who wagered on it.

**The answer key is in `state/`, and that is a stated concession.** Neither read-gated node
fits: `secrets/` and `assignments/` both hide a value from SOME players, and this one is hidden
from all of them until the reveal. AniTune's round has the same property for the same reason.
Fixing it means a grader nobody can see, which is a server. The screens never render an
answer before its reveal.

**Pools are a `Select`, not `sharedOnly`:** `shared` (default), `anyList`, or `everything`. The
last needs no list at all, which makes AniQuiz the third game playable before an import.
`utils/pool.js` wraps `anirank/utils/deck.js` for `wavelength/utils/cards.js`'s reason —
a deck card's id IS `franchiseTitleKey`, the fold the pack is keyed on. The setup line says
"12 of 40 shows have facts" because the pack covers a few hundred popular shows, and without
the first number a long shared list that is mostly absent looks like the game ignoring it.

**Local play has no shared clock:** every rule is called with `now = null`, and `LocalClock`
runs one per player from the moment the handoff hands them the device — AniTune's
`beginEntry` rule. Online runs AniWave's two clocks: the displayed one drains to the real
deadline, and a second offset by `REVEAL_GRACE_MS` gates `expireClue`, so an answer sent in the
last instant lands before the clue closes on it. Local play is not resumable; the Hub button
says so rather than pretending.

`AniQuizGame.test.jsx` plays whole games through the real screens against the real pack — a
solo quiz with no list, a full board through both wagers, two players passing the device for
typed answers. Red is AniQuiz's accent as hub identity only: in-game, red still means wrong,
and the primary actions stay pink.
