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
the same character is never the odd one twice in a game.

`deal.test.js` checks every dealt round against an independent `cardsOut` written from the
rules' text, so `validRound` cannot vouch for itself.

**Decoy reasons** (`decoysFor`) are "All <value>" for a value at least one of the five is KNOWN
to lack, because an unknown could make the sentence true. The most plausible decoys come
first (a value most of the five hold), with one per kind before any kind repeats.

**Short lists say so.** `dealGame` returns `{ error, found }` instead of dealing fewer rounds.
Setup and the lobby keep a trial deal of the table as it stands (`copy.js`'s `setupStatus`),
because nothing short of dealing tells you how many rounds a list holds. `ShortBanner` lists
the fixes, and the bot's `fixBlocked` applies them, opening the More settings fold first.

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

The game's ink is the decorative `--color-pop-moss` (index.css), wired into every accent map
beside `plum` and `slate`.
