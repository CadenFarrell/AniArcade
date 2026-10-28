# AniQuiz — design notes

Loaded when Claude works on files in this folder. Moved here from the root `CLAUDE.md`,
which still holds the cross-game architecture these notes build on (rules.js, online rooms,
presence, settings, profiles, styling).

## AniQuiz: the fact pack's game

`games/aniquiz/` (id `aniquiz`) is trivia built from the credits: studios, directors,
composers, source material, theme songs, air dates, voice actors and casts, all out of the
fact pack. It
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

**The pack holds two kinds of cast, and the clues keep them apart.** `appearsIn` is the shows
a character is MAIN in; pack-v4's supporting characters (Levi, Kakashi — favourites ≥ 1000,
four per show) arrive under `supportingIn` instead. Both cast clues *say* "main character", so
`castByShow` (which feeds `mainCast` and `voiceActorReverse`'s accept list) reads `appearsIn`
only, and `voiceActorReverse` refuses a subject whose home is not a show they lead. The
`appearsIn` clue asks a lead "which show is X a main character in" and a character who is
supporting everywhere "which show is X from", accepting every show they are in. A
character's `home` is a show they lead when one is in play, otherwise one they support in.
`buildContext` resolves the pool's keys through the pack's `aliases`, so a player whose
profile names a later season still puts the franchise in play.

**pack-v5's outside facts feed two topics.** A **Theme Songs** column (`themeShow` — name
the show from its first opening; `themeArtist` — who performs a named song; `artistReverse` —
name a show this performer sang a theme for) and four more shapes in **Source Material**
(`magazine`, `originalPublisher`, `originalYear`, `magazineReverse`). Text only on purpose:
playing the song is AniTune. Three fairness rules, each with a test:

- `themeShow` accepts every pack show whose theme of the same kind has the same title,
  narrowed to the same performer when the prompt names one ("Believe" is several songs) — but
  a matching theme with **no** performer on record is accepted, not ruled out. It never quotes
  a song named after its own show ("Date A Live", "Mezase Pokémon Master" — 36 themes in v5,
  20 of them the one it would have quoted); `leadTheme` passes over those, matching whole
  words either way round.
- `themeArtist` asks about a solo performer when the show has one (a "FictionJunction & LiSA"
  option among three solo names is a tell), and accepts any one performer or the full credit.
- A manga's publisher and a light novel's imprint are **separate domains** (`publisher`,
  `imprint`): mixed, a player could discard every option of the wrong kind without knowing
  anything. The magazine prompt says "where was it serialized", because Shōnen Jump+ and
  Pixiv are websites, and a source year later than the premiere is never asked.

**A table can switch whole topics off** (QuizSettings' "Categories" card), never individual
clue shapes — a topic is what a player sees as a column, and seventeen shape switches would be
a wall nobody reads. Three decisions worth keeping:

- **The pref is `topicsOff`, the list switched OFF**, read through `enabledTopics`. Stored the
  other way round, a topic added in a later build would be missing from every saved table's
  board until somebody opened the card. Unknown ids are ignored.
- **It reaches the deal and nothing else.** `buildDeal` passes the enabled topics to
  `dealBoard` / `dealQuiz` (the final draws from them too); room state never sees it, because
  only the host deals and grading reads only the clue. Fewer enabled topics than `categories`
  deals a narrower board, and the card says so before Start rather than surprising anyone.
- **`poolSummary` counts each topic in distinct SUBJECTS, not candidates**, and reports every
  topic marked `enabled`. A column takes one clue per subject, so candidates overstated what a
  topic could fill — a show askable three ways counted three times toward the five-row floor.
  The card shows the count beside switched-off topics too, which is what makes turning one
  back on an informed choice, and flags a topic too thin for a column.

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

**One device can answer out loud** (`localAnswers: 'aloud'`, local only): the clue goes up once,
everyone says their answer, "Show the answer" shows it, and the table ticks who got it in
`SelfReport` — `rules.selfReport` scores the ticks at face value and marks each answer `aloud`.
It replaced about a hundred handoffs a board. **Never on a wagered clue** (Daily Double, final):
an honour tick placed after seeing the answer would let a player decide whether they had
"really" known it, so those keep the private handoff whatever the option says.

A fresh board lands a column at a time and the final's reveal is staged row by row
(`useStagger`), each over complete markup, so the bots and a quick pick are never held up.

`AniQuizGame.test.jsx` plays whole games through the real screens against the real pack — a
solo quiz with no list, a full board through both wagers, two players passing the device for
typed answers. Red is AniQuiz's accent as hub identity only: in-game, red still means wrong,
and the primary actions stay pink.
