# AniChain — design notes

Loaded when Claude works on files in this folder. The cross-game architecture these notes
build on (rules.js, online rooms, `secrets/`, presence, settings, profiles, styling) is in the
root `CLAUDE.md`.

## The game

`games/anichain/` (id `anichain`) is one-word-at-a-time clueing. Each turn two clue-givers see
a secret character from the table's lists. They take turns adding ONE word to a single
sentence, and they cannot confer, so each word has to follow whatever the other just said.
After every word, the guessers it was for get one guess each. The first right guess ends the
turn and is worth `valueAt(cap, n)` = cap + 1 − n (never below 1). Words run to the `cap`
(default 10); if nobody is right by then, the turn is "Out of Words" and nobody scores.

It came from Caden's ideas list and was settled in a question round:
- **One guess per word.** A wrong guess just waits for the next word.
- **Banned words:** any part of the character's name, the show's title, and the names of
  the show's other cast.
- **The table shape:** Claude recommended a default, and the other two shapes became a
  setting.

Keep the alternating, no-conferring sentence as the core.

## Three table shapes (`shape`)

| shape | givers | who may guess after a word | who scores | min |
| --- | --- | --- | --- | --- |
| `pair` (default) | seats r and r+1, moving one seat a round | everyone else | guesser V, each giver ⌈V/2⌉ | 3 |
| `rivals` | one per team, rotating within the team | **the team whose giver said that word**, bar the giver | that team V | 2 a side |
| `teams` | the turn's team's next two members | the rest of that team; the other team watches | that team V | 3 a side |

**In `rivals`, only the word's own team may guess it.** That rule is the point of the shape. If
both teams could guess every word, a giver's choice of word would mean nothing: both teams
hear the same sentence. Restricted, a word that sets the answer up hands the OTHER team the
next guess.

A `teams` round is both teams' turns (`turnsPerRound`), Red first on even rounds.
`turnNo(game)` is the running turn number, used for stamps and one-shots.

Teams use the shared split (`shared/utils/teams.js`, `shared/components/teams/`), which was
lifted out of AniTurf for this game. There is no crown: givers rotate.

## Words and guesses (`chainWords.js`)

**`castIndex`** is the table's lists plus the pack's casts (`appearsIn`/`supportingIn`),
keyed by `characterNameKey` and resolved show keys. It is narrower than AniName's
`buildIndex` on purpose, so it is its own module rather than an import across games.

**`bannedWords`** returns the name's words, then the show's (the list's title, the pack's
title and the franchise key, which drops "Season 3"), then the rest of that show's cast.
Each word carries its reason. Words of two letters or fewer, and a small `STOP` set, are
skipped: banning "the" or "season" helps nobody. A word is refused when any of its parts
(split on hyphens and apostrophes) IS a banned word, or starts with one that is four letters
or longer. That catches "Titans" and "Narutos", while "eve" does not ban "eventually".

**`isRightGuess`** accepts the full name in any order, or words that name exactly one
character the table knows. This is `shared/utils/nameMatch.js`'s `uniqueByWords`, lifted out
of AniName for this: "Kakashi" counts, and "Uchiha" at a table of three Uchihas does not.

## The deal (`deal.js`)

`drawCharacter` draws from `chainPool`: main characters by default (`pool: 'main'`), falling
back to everyone if the lists mark nobody main. It tries three tiers in order:
1. a character a giver AND an eligible guesser hold;
2. one a giver holds;
3. anyone.

Within the tier it weights by owner count, ×2 for mains and ×0.5 without a portrait. Nothing
dealt or skipped is dealt again that game. There are `SKIPS` (2) redraws a turn, before the
first word only. **The skipped characters are published with the reveal**, because the
givers saw them and the table should know what they passed on.

Setup needs `rounds × turnsPerRound + SKIPS` characters (`copy.js`'s `charactersNeeded`).
It holds Start while the pack loads, because the pack supplies most of a cast, which is most
of the banned list.

## Locally (`useChainRound`, `LocalRound`)

The words are said and the guesses shouted, so the device is a scorekeeper. The flow:
1. A `Handoff` ("We're A and B — show us") opens the card.
2. "Hide it" opens the chain.
3. "Next word" counts each word.
4. "Got it" leads to "<name> got it" buttons for the guessers the last word was for.
5. "Out of words" appears at the cap. "Banned word" is the table calling a slip.
6. "Givers: peek again" reopens the card behind the same handoff.

**The card lives beside the game in one state object, never in it**, mirroring online: the
game learns only that a turn was dealt (`dealt`), and learns the character when the turn ends
(`publishReveal`). There is no guess window locally (`now` is null).

## Online (`useChainRoom`)

**The card is in `secrets/{giverId}` for both givers**, because it is hidden from everyone
else, and owner-read is the only node that does that.
- **Who deals:** the FIRST giver still here deals it (AniTurf's "nobody deals but the
  owner", stretched to a pair). It writes both nodes in one multi-path `update`, then opens
  the chain with `markDealt`.
- **Stamps:** each card is stamped `forGame` (`gameNo`), `forTurn` and `deal`, and shows only
  when all three match. The deal waits for the first `secrets/` snapshot.
- **What only a giver's device can do:**
  - judge guesses: `settleGuesses`, oldest `at` first, with `isRightGuess` against its card;
    anything behind a right guess is `late`;
  - publish the reveal;
  - check a word against the banned list, before it is sent.
- **The pool is on the game** (`game.pool`), because the dealing device is a giver's, not the
  host's.

**The guess window** (`GUESS_MS`, 15s) is what stops a quick giver from burying a word under
the next one. Word n+1 may come once no guess is pending AND either everyone the word was for
(and is here) has guessed or passed, or 15s have run since the word. The giver's bar shows
the countdown. A capped chain closes the same way, from any device (`outOfWords` under
`once(out:…)`).

**Departures** (`settleIfComplete`): a giver gone voids the turn ("Round Void"). The other
giver's phone still publishes the character. A turn with nobody left to guess is void too.
Below the shape's minimum (`enoughPlayers`), the game ends.

The host's table shape is published to `lobby/shape`, so a guest's lobby shows the teams card
exactly when a team game is coming. `smoke/anichain.smoke.test.js` covers:
- a three-device pair game: the card reaching both givers and nobody else, a banned word
  refused, the window, a wrong guess then a right one, the reveal, and a capped turn;
- rivals' team-only guessing;
- a giver closing their tab.

## Screens and words

`TableScores` is one `PlayerRow` for a pair game, or two team strips (`teamStyle` ink and
texture) for the team shapes. Either way the givers wear the speech mark and the next speaker
is NOW. `ChainLine` is the typed sentence in a `SpeechBubble`: the first giver's words are
underlined solid and the second's dashed, so two voices never rely on colour alone. Locally it
is only the count. In `rivals`, a hint names the word's speaker ("Caden's word is for Red
only"); a bare "this word" under "<next giver>'s Word" read as the coming word.

The playtest strategy (`playtest/strategies/anichain.js`) and `AniChainGame.test.jsx` press
these words:
- "… — show us", "Don't know them — another", "Hide it"
- "Next word", "Got it", "<name> got it", "Nobody yet", "Out of words", "Banned word",
  "Givers: peek again"
- the "Your word" box and "Add word"; the "Your guess" box, "Guess" and "Pass"
- "Next turn", "Next round", "See results"

The headings are "Your Character", "<name>'s Word" / "Your Word", "Last Guesses", and the
reveals "Got It!" / "Out of Words" / "Banned Word" / "Round Void". Online, every bot guess is
a made-up name, so every turn runs its window: that path most needs exercising, and it is why
the strategy's `cap` axis stays short.

The game's ink is the decorative `--color-pop-violet` (index.css), wired into every accent map.
