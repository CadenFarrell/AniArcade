# AniWave — design notes

Loaded when Claude works on files in this folder. Moved here from the root `CLAUDE.md`,
which still holds the cross-game architecture these notes build on (rules.js, online rooms,
presence, settings, profiles, styling).

## AniWave: three modes, and the one that needs no deck

`games/wavelength/` (id `aniwave`) has three clue modes, and **`clueMode` defaults to `text`,
which draws no cards at all**. That default is load-bearing rather than arbitrary: it makes
AniWave **the only game playable before an AniList import has ever run**, which is the one
thing a brand-new player can do. `WavelengthSetup` says so in a banner, and every pool
control, count and warning is gated behind `needsCardPool(mode)` so the default path never
grows one. Do not change that default without deciding out loud that the property is going.

The other two draw from `utils/cards.js`, which is a **wrapper over `anirank/utils/deck.js`,
deliberately not a fork** — the opposite call from `anifake/utils/pool.js`, and for a stated
reason: AniFake needed different fields and a fame ladder, AniWave wants the identical card
off the identical collapse rules. Franchise folding, the folded-name character key and
portrait-beats-no-portrait are three non-obvious rules, and a second copy of them means one
show reading as two different cards between two games on one device. `POOL` passes synthetic
`{ kind: 'opinion', items }` probes, the same trick `opinionPoolCounts` uses; an opinion axis
filters nothing, which is exactly the pool a clue card wants.

| mode | target | published with the clue |
| --- | --- | --- |
| `text` | random, hidden | typed clue |
| `cards` | random, hidden | one card, **searched** out of the eligible pool |
| `readroom` | **the psychic's own dial** | the one card they were **dealt** |

**The two card modes differ on dealt-vs-searched, and that asymmetry is the design rather
than an unfinished migration.** `cards` used to deal a hand of five; on a shared list near
`MIN_CARD_POOL` that is half the deck, and the ordinary round was one where nothing in the
hand sat anywhere near the target. A hand is a *physical-deck* constraint and does not
survive the translation, so the psychic now searches the whole eligible pool through the
same `Combobox` + `rankSuggestions` typeahead AniGuess and AniFake use. `readroom` keeps its
deal for the opposite reason: the mode is judging the psychic on a card they did **not**
choose, and a psychic who can search picks one they have a loud obvious opinion about, which
measures nothing. Do not "tidy" the two into one path.

That split is why `rules.js` carries **two** predicates where it once had `dealsCards`:
`needsCardPool` (both card modes — what the setup screens gate on) and `dealsHand`
(`readroom` alone — what the hooks write into `secrets/`). Merging them writes a hand the
mode never reads and leaves `myDealReady` waiting on a card that is never coming, which is a
round stuck on "Dealing you in…" forever. `sharedOnly` also stops being merely advisable and
becomes the only thing between the table and a psychic who searches up something nobody else
has watched — the deal used to prevent that structurally.

One cost, paid deliberately: `cards` and `text` converge, since both are now "say anything".
What still separates them is that a card is unambiguous and pictured, and that the round is
about anime rather than about vocabulary. The search box's empty state shows a `BROWSE_SIZE`
strip of random eligible cards — a search box is a worse cold start than a hand was, since
with nothing typed there is nothing on screen to react to. It is not a hand: every other
eligible card is one query away, and it never rerolls.

`readroom` sounds like a different game and isn't: the answer key stops being a random number
and becomes an opinion, but it still arrives through `revealTarget` from the psychic's device
alone, so every guarantee below holds unchanged. `scoreDial`, `explainRound` and `finalScores`
never learn the mode exists — `submitClue` is the only function that branches.

**`spectra.js` is a fork of `axes.js`'s discipline, not an import.** An axis carries `kind`,
`items`, `defaultBlind`, `valueFor` and a "rank these as {name} would" prompt; a spectrum is
two words. The precedent is `anifake/utils/pool.js` forking `deck.js` for the same reason.
What *is* copied is the direction rule — `leftLabel` names dial value `DIAL_MIN` — and here a
flipped pair does not merely mislabel a track, it silently inverts every score, so
`spectra.test.js` pins the labels against `scoreDial` exactly as `axes.test.js` does.
The display label is *derived* (`${leftLabel} → ${rightLabel}`), so unlike AniRank's the two
cannot disagree. `utils/arc.js` pins the same promise in geometry — `valueToAngle(DIAL_MIN)`
is the left cap — because the arc dial is a second place the two ends can be swapped.

**A written spectrum travels as its whole definition, never as an id.** `getSpectrum` is the
polymorphic resolver `axes.js`'s `getAxis` already is, and the custom branch must come
**first**: a stored custom carries an id that resolves to nothing, so checking `spec.id`
before `spec.custom` would silently play every written spectrum as `FILLER → CANON` on every
device. The round's field is `spectrum` and `normalizeRound` still reads `spectrumId` — the
same back-compat seam as `settings?.axis ?? settings?.axisId`. `spectra.test.js` pins the
JSON round-trip, which *is* the online path.

**The psychic's own device draws its own target — and in `readroom` its own card — and no
other device ever computes either.** This is the one place the arcade escapes AniFake's
"whoever computes the deal learns it" concession: `startRound` writes only `psychicId`,
`round` and `mode`, and the psychic's device writes `{ target, hand, forRound }` to
`secrets/{psychicId}` (`hand` null in the two modes that are dealt nothing). Stamped, never
cleared, for the reason every other secret is — and the freshness check is on the **stamp**,
not on the target, because `readroom` legitimately has no target until the psychic places one.
The one-shot key needs the round in it (`secret:${round}:${playerId}`) — `useRoomCore` clears
its latches on a *view* change and the view stays `round` all game, so without it round two
sits clueless forever.

That the psychic's device *can* deal is worth stating: the roster in `state/` carries each
player's whole profile, so `eligibleCards` is computable anywhere. It is computed there and
only there. **It is also what makes player-written spectra possible at all** — the host has
never seen them, so the host cannot offer them, so the psychic must be the one who chooses.
`SpectrumPicker`'s candidates therefore never enter room state; only the pick is published.

`cards` mode's search box is the same fact used a second time: `searchableCards` runs on the
psychic's device off that same roster, so the whole eligible pool, every query typed into it
and every candidate it offered stay local, and only the card finally played is published.
Both hooks gate the memo on being the psychic in a `cards` round, because it flattens every
seated player's anime list and a guesser would pay for a list they never see.

**A round can never be in the guess phase without a spectrum.** `submitClue` publishes the
spectrum, the clue-or-card and the phase change in one patch, so the alternative — two writes
that can arrive in either order or half-fail, leaving the table dialling against blank ends —
is unrepresentable rather than merely avoided.

**The cost is stated rather than papered over: the psychic is the target's sole holder.** It
reaches the room only when they publish it at the moment dials lock — never at clue time,
which would put the answer in `state/` while people are still guessing. A psychic who leaves
in between takes it with them and `abandonRound` voids that round, keeping totals. Do **not**
"fix" this by having the host keep a backup: the host is a guesser that round, which is
strictly worse than the concession it imitates. `skipDepartedPsychic` splits the two cases —
in `clue` nothing is committed so the role is simply handed on, in `guess` it is unrecoverable.

**Presence cannot see a player who is connected and simply not acting, so there are two manual
endings — and each sits on the only device that can perform it.** `revealNow` is the psychic's,
because a reveal needs the target and they are its sole holder; it is the same call the clock
makes, reached early, and it is what stops an untimed round waiting forever on somebody who is
reading their phone. "Abandon this round" is the host's, because the case it covers is *the
psychic* having stopped responding. Do not merge them into one host control: that would need the
host to hold a target, which is the backup copy the paragraph above forbids. The residual limit,
recorded rather than designed around: a host who is also the stalled psychic leaves neither
button with a live device behind it, and only presence recovers that room.

**A timed round reveals `REVEAL_GRACE_MS` *after* its deadline, and the gap is load-bearing.** At
expiry every guesser holding a placed-but-unlocked dial submits it, so revealing on the same
instant races the writes it should be collecting and scores as "no dial" a guess the player can
see in front of them. That auto-lock lives in `OnlineGame` rather than in `GuessView`, because up
there the "have I locked already?" guard is `iHaveDialled` — real round state — while down there
it can only be a latch, and react-hooks forbids both spellings of one (a ref cannot be read during
render to caption the result, a state latch is a setState inside an effect). The draft is
deliberately *not* cleared on that path, so the screen keeps saying the dial went in; a
render-time reset keyed on the round number is what clears it, since "next round" is a host-only
button and a guest's draft would otherwise pre-place their dial in the round after. The hook therefore runs **two** `useDeadline` clocks:
the one `GuessView` renders drains to the real deadline, because that is the number the table was
promised, and a second one offset by the grace gates the reveal and nothing else. The duration
lives in `rules.js` and the instant does not, for the reason `startRound` reads `deadline` and
never invents one. `OnlineGame.test.jsx` pins the auto-lock and the draft reset against a
mocked room. Neither the smoke suite nor `rules.test.js` can reach them, because they live in
the view-router.

**Local and online are symmetric, and that is what keeps the game small.** `dials` is
`{ [playerId]: number }` in both — online each guesser writes their own, locally each writes
their own as the device is passed — so `finalScores` branches nowhere: a guesser scores their
own dial, the psychic scores the mean of the dials *actually placed*. Non-dialers are excluded
from that mean rather than counted as zero, or the psychic's score would measure the room's
connection quality. `normalizeDials` invents no entries, which is why the "rebuilding from the
active roster deletes departed players" trap cannot bite it.

**The arc dial splits keyboard from pointer, and both halves are load-bearing.** The flat bar
it replaced could let one transparent `<input type="range">` take everything, because a range
maps *x* linearly to value and so did the track. On an arc it does not — x is `cos(angle)` —
so a tap on the visible needle would jump elsewhere. The input therefore stays for what only
it can do (arrow keys, Home/End, `aria-valuetext`) with **`pointer-events: none`**, and
pointers go through `pointToValue` on the SVG. Deleting either half breaks a whole class of
user. `pointToValue` clamps below the baseline to the **near** cap: `atan2` goes negative
down there, and reading that as past `DIAL_MAX` would snap a drag heading for the left cap to
the far right — which happens in ordinary play, since a finger crosses the baseline first.

Three traps worth knowing before touching it.

- `normalizeRound` rebuilds from **named** fields rather than spreading `raw`, so a field the
  hook writes and it does not name is dropped on the first read — that is how `deadline`
  silently never started a clock, and the round now has five more fields to forget.
- `Number(null)`, `Number('')` and `Number([])` are all `0`, a perfectly finite dial at the far
  left, so `toDial` screens *before* coercing; a range input reports `''` before first paint
  and RTDB returns `null` for a cleared key, so both arrive in normal play.
- **A background tab does not run `requestAnimationFrame`.** The reveal's score count-up froze
  every total at `+0` until the player looked back at it, which self-heals — and that is what
  made it dangerous, since a screenshot or a second monitor showed a table where nobody scored.
  `prefersStill()` treats `document.hidden` exactly like `prefers-reduced-motion`, and
  `components/RevealScreen.test.jsx` pins it with a `requestAnimationFrame` that never fires. Correctness
  must never depend on an animation completing; an animation nobody can see is worth nothing.
  The band and marker keyframes have the matching property by construction — they animate
  **from** a start state with no `to`, so removing the animation leaves the finished picture
  rather than a blank one.
