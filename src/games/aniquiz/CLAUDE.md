# AniQuiz — design notes

Loaded when Claude works on files in this folder. Moved here from the root `CLAUDE.md`,
which still holds the cross-game architecture these notes build on (rules.js, online rooms,
presence, settings, profiles, styling).

## AniQuiz: the fact pack's game

`games/aniquiz/` (id `aniquiz`) is anime trivia, one player per clue: casts, portraits,
premiere order and fan favourites for casual fans, and the credits (studios, directors,
composers, source material, theme songs, air dates, voice actors) for the rest, all out of the
fact pack bar the portraits. It has two formats over one clue generator — a **board** (category columns, a Daily Double, a
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

**Casual topics, and the hard ones off by default** (2026-11-03: the credits topics were too
hard for casual fans). TOPICS is listed easiest first, and four topics ask what a viewer knows
from WATCHING rather than from the end roll:

- **The Squad** (`squad`): name the show from its three best-known leads, accepting every pack
  show they all lead. A lead sharing a 3+ letter word with the title ("Naruto Uzumaki", "Haruhi
  Suzumiya", "Frieren") is skipped (`nameInTitle`) — it would answer the clue in the asking.
- **Name That Character** (`portraits`): a portrait, name them or their show. The pack has no
  images, so the pictures are the PLAYERS' own (`utils/portraits.js`, from every seated list,
  keyed by the pack's character fold, `https` only) — the topic is as wide as the table's lists
  and empty with none. Neither the prompt nor the `<img>` alt ever names the character.
  `image` survives `normalizeClue`.
- **Which Came First?** (`firsts`) and **Fan Favourites** (`favourites`): four shows, one clearly
  the most of something (`COMPARE`: earliest/latest premiere year, highest averageScore, most
  popular). "Clearly" is a margin (`trails`): a year, 3 score points, 1.25× members — two shows
  of one year or a 1-point score gap is a coin toss. Their options ARE the question, so they are
  **`choiceOnly`**: `dealableTopics` leaves them out of a typed deal, `finisher` refuses one that
  arrives anyway, and the card says "multiple choice only" instead of a count. Their wrong
  options come from `compareDistractors` (same table-first, unshown-first order), and `detail`
  carries every option's value for the reveal, best first.

**Famous Lines** (`lines`, 2026-11-09) is the one topic not drawn from the pack. No source the
arcade uses has quotes. Outside ones were looked at (2026-11-10) and not used: AnimeChan's API
(free tier 5 requests an hour, fan-compiled "inspirational" quotes) and the Hugging Face
AnimeQuotes set (10k Japanese lines scraped from AnimeMotivation, no show column) — every line
from either would still need checking, so they save nothing. The checking sources that work:
Wikiquote's anime pages (episode-cited; `Category:Anime` lists which exist — most newer shows
have none), then two independent quote sites agreeing. Fandom wikis refuse automated reads
(402), and their BreezeWiki mirror sits behind bot protection. So `famousLines.js` is a
hand-curated list (430 lines, 200 shows),
bundled in AniQuiz's lazy chunk rather than shipped beside the pack: it is small, only this game
parses it, and a correction is an ordinary deploy. The file header holds its rules — spoilers
allowed (since 2026-11-10: the user's call, a table is assumed to have finished the anime; it was
"no spoilers" before), only lines spoken in an anime (never manga- or novel-only), only lines
whose wording and speaker are certain, English except where fans quote the Japanese — and `famousLines.test.js` holds every entry to them against the real pack. Every
line was checked (2026-11-09) against Wikiquote's episode-cited pages or several independent
quote sources: close matches were corrected to the sourced wording ("Unlimited Void", not
"Infinite Void"), lines no source has were removed ("Anya likes peanuts" is a fan meme), a
speaker the sources disagree on was dropped rather than guessed ("What's 1000 minus 7?" is
both Yamori's and Kaneki's). Lines left out as spoilers then (Ai's "lies are love", Rengoku's
"keep your heart burning") came back when spoilers were allowed.
Frieza's "this isn't even my final form" never went in: he never says it.
Since 2026-11-10 the bar is looser (the user's call: the topic needs lines for a lot of shows to
work): where sources disagree, the most credible one's wording goes in, and a line only fan quote
sites carry goes in as fans word it. The lines added that way (commits "fifth batch" through "eighth batch") are
the ones to revisit first if better sources turn up.

**The subtitle archive settles wording** (2026-11-10). SubArchivist (`subs.yakuaru.com`, robots.txt
allows all) holds whole-series subtitle text, mostly Crunchyroll's, with speakers; a book exports
as one plain-text file (`/books/<slug>/export/plaintext`), and it rate-limits hard (429 with
Retry-After; large books take minutes). Every line added since then is in it word for word, and the
looser-bar lines it covers were checked against it: reworded to it where it says the same thing,
replaced or dropped where it does not (it caught invented fan quotes such as Nao's "I'm not
jealous, I'm just territorial"). Its absence is not proof: it is one translation, so a famous dub
line (Attack on Titan's "grim reminder") stays. Many shows are not in it (no Death Note, Toradora,
Violet Evergarden, One-Punch Man), and the looser-bar lines from those are still unchecked.

**Close wordings get leeway, never a slash** (2026-11-09, at the user's request: they know it
as "Infinite Void", officially "Unlimited Void"). A line's `alt` lists the other sourced
wordings of its ending. The option always shows the official wording alone — "Unlimited Void /
Infinite Void" would be the only option with a slash, which answers the clue by its shape —
and the reveal names the rest under "Also accepted". The alternates are in `accept`, which
also keeps a decoy from ever being one of them. Finishing a line stays multiple choice only
(the user's call: an `alt` list cannot cover every way a person might type an ending). Each line
makes three shapes (`lineFinish`, `lineSpeaker`, `lineShow`) on ONE subject, the line, so a
column never quotes it twice; the show it spends is whichever of its shows (`also`: the same
scene in a remake) is in play. Decisions worth keeping:

- **Finishing a line is multiple choice only, per CLUE** (`choiceOnly` on the clue, not the
  topic): sub and dub word endings differently, so a typed ending would mark people who know the
  line wrong. `candidatesFor(ctx, topic, { choices })` drops those clues BEFORE the dedupe, or a
  line's unaskable ending could win the dedupe over its askable speaker. A typed table still gets
  the topic, and `poolSummary` counts only what it can ask.
- **The wrong endings are hand-written** (`decoys`, three per line), never other lines' endings,
  which would be different sentences and obvious. A decoy that MEANS the ending is a second right
  answer: Ponyo also loves ham, Anya also likes spies, so neither is a decoy.
- **A speaker's wrong options are the show's own pack cast** (main and supporting), never another
  show's — the prompt names the show, so an outsider is the odd one out. Fewer than three and
  the clue is not dealt as multiple choice. That is why `by` is spelt the pack's way
  ("Tanjirou Kamado", "Luffy Monkey"): any other spelling could put the speaker beside
  themselves as a wrong option, and a different romanization among the options is a tell.
  `pack` covers a different NAME (All Might is "Toshinori Yagi" in the pack); `aka` and either
  name order are accepted typed.
- **A line that gives itself away is not asked that way**: a title word in the line blocks
  `lineShow`, the speaker's name blocks both `lineShow` and `lineSpeaker`, and `noShow` marks the
  tells only a person sees ("Pikachu, I choose you!").
- **Priced half by the show's obscurity in the pool and half by the line's own `fame`** (1–3),
  so "King of the Pirates" is cheap even on a table where One Piece is the least-watched show.

The credits topics (`staff`, `music`, `origins`) are flagged **`hard`**, badged "Harder" on the
card, and are `DEFAULT_PREFS.topicsOff` — so a table that never opened the card plays the
watchable ones, while one that ever touched the switches keeps its saved list (mergePrefs).
`clues.test.js` pins the default to the `hard` flags.

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

**A deal spreads across shows, and across games, softly.** Every deal was random and still a
handful of shows kept coming back (measured 2026-11-03, 20 boards over a 25-show shared pool,
the real pack: JoJo asked 39 times against an average of 21, one show filling 5 cells of one
board, 22% of wrong options repeating within a board). Three causes, three fixes:

- **A clue spends a SHOW** (`showOf`): its subject, or for a character clue the character's
  show (`show` on the clue — internal to the deal; `normalizeClue` drops it). Character clues
  are built per character, and pack-v5's JoJo has 35 against a median show's 4, so counted by
  subject one big cast filled the voice and cast columns. `drawByShow` picks a show, then a clue
  of it; the quiz's queues are `spreadByShow` (every show once before any twice).
- **`tiers`**, strongest first: show unused this game + clue not dealt lately + show not in the
  last game; show unused + clue unseen; show unused; subject unused + unseen; subject unused;
  anything (the board only — a quiz never repeats a subject). A fresh show outranks an unseen
  clue because the same show three times in one sitting is the louder repeat. Every tier ends
  in what the deal did before, so a pool that dealt then deals now. `ladder` works on a copy of
  the spread state, committed only when the column fills.
- **`recent.js` remembers what this device dealt** (`aniquiz_recent`, not in `PRESERVED_KEYS`):
  three games of clue ids, the LAST game's shows only — a 26-clue board on a 20-show list spends
  nearly every show, so a longer show memory would empty the top tier every time.
  `dedupeBySubject` keeps an unseen clue per subject when there is one, or the tiers would
  never see it. Only the dealer remembers (online, the host); nothing reaches room state.
- **Wrong options**: the table's unshown names, then the pack's unshown, then repeats (the
  table's first), with `ctx.shownOptions` as the deal's record. A small pool therefore reaches
  into the pack before it repeats itself. Character and voice-actor options are sampled show
  first (`localGroups`), for the big-cast reason.

After: 1–2 cells per show a board, 1% of clues repeated from the last three games, 4% of
wrong options repeated; a whole-pack board deals in ~70ms.

**Options are built only for clues actually dealt.** Building them for every candidate (~10k
over the whole pack) took a deal twenty seconds; the reverse-clue lookups are bucketed once per
pack (`lookups`, memoized on the index object) for the same reason.

**`deal` and `game` are separate, AniTune's `round`/`game` split.** The deal (thirty clues with
their accept lists and options) is written once; every answer is a transaction on `game`
alone, so those writes stay small. Every rule therefore takes the deal as an argument.

**One player answers each clue: whoever's turn it is** (changed 2026-11-03 at the user's
request; it was "everyone answers every clue privately, a miss is free"). On the board the turn
picks a cell and answers it; in a quiz each question goes to the next seat. Both set the clue's
`solo` — the field the Daily Double always used — so every gate that waited on one player for a
Daily Double (`requiredIds`, `settleIfComplete`'s departed-solo reveal) now covers every clue
with no new code path. Everyone else watches: online they see the clue, clock and a read-only
`OptionsList`; locally the clue is answered in front of the table, so only the final still uses
`Handoff`. **The turn rotates whatever happened** — "keep picking while you're right" would let
one strong player run the board.

**A miss costs the clue's value**, and a pass and a blank at the clock are misses: the player
took the clue, so sitting it out is never the safe play. Scores go below zero. The old rule had
no penalty because with everyone answering at once a penalty mostly punished guessing; with one
answerer that argument is gone. `riskLine` (roundText.js) prints the stakes under every clue,
because "Pass costs points" is the one rule nobody would guess. A clue whose player LEFT reveals
uncharged (`revealNow`): walking away is not letting the clock run out. Online the host's
"Reveal now" shows as soon as an untimed clue is somebody else's, the AFK escape.

The Daily Double never sits in the top row (a wager on the easiest clue is free money), and
its stake floors at `DD_FLOOR` so a player on zero (or below) can still make it a swing. **The
final is everyone's, privately** — each wagers up to their score (0 when at or below zero, and
they still answer) — and waits only on players who wagered on it.

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
starts when the clue is in front of its player — as it opens, or after the final's handoff
(AniTune's `beginEntry` rule). Online runs AniWave's two clocks: the displayed one drains to the real
deadline, and a second offset by `REVEAL_GRACE_MS` gates `expireClue`, so an answer sent in the
last instant lands before the clue closes on it. Local play is not resumable; the Hub button
says so rather than pretending.

The local "Say it out loud" option (`localAnswers`, `rules.selfReport`) was removed with the
turn change: with one answerer there is nothing to hide and nothing to pass round.
`mergePrefs` drops the stale key from saved prefs.

A fresh board lands a column at a time and the final's reveal is staged row by row
(`useStagger`), each over complete markup, so the bots and a quick pick are never held up.

`AniQuizGame.test.jsx` plays whole games through the real screens against the real pack — a
solo quiz with no list, a full board through both wagers, two players taking typed questions in
turn with no handoff. Red is AniQuiz's accent as hub identity only: in-game, red still means wrong,
and the primary actions stay pink.
