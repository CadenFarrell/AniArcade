# AniTune — design notes

Loaded when Claude works on files in this folder. The cross-game architecture these notes
build on (rules.js, online rooms, presence, settings, profiles, styling) is in the root
`CLAUDE.md`.

## The game

`games/anitune/` (id `anitune`) plays an opening or ending from the table's lists, and
players name the show. Three modes (`modes.js`, all over one `rules.js`):

- **Race** (`RACE`): first right answer takes the song. A buzz pauses the clip and the buzz
  window. A wrong answer locks that player out of this song, and the rest resume with exactly
  the time they had left (`pausedRemainingMs`).
- **Everyone guesses** (`SIMULTANEOUS`): everyone answers the same clip, and everyone right
  scores. Answers are graded on submit but hidden until all are in, so the scoreboard cannot
  tell player three what players one and two managed.
- **Last one standing** (`LIVES`): everyone guesses, and a miss costs a life. **Saying nothing
  costs a life too** (`settle` judges everyone *required* to answer), or waiting out the clock
  would be free. `rankLives` ranks by survival first, then by points only among players who
  went out ON THE SAME SONG (`eliminatedAt`), never by the order they were pushed, which is
  seat order.

Branch on `isRace` / `hasLives`, never a list of mode ids, so a fourth mode is one entry.

**Scoring is one function (`scoreAnswer` = `scoreParts`' base + speed).** A right answer is
`QUESTION_POINTS` (1) plus a speed bonus that tops out at 1 (`shared/utils/deadline.js`), so a
slow right answer always beats a fast wrong one. The reveal's "1 + 0.6" and its "+1.6" come
from the same call and cannot disagree. No window (an untimed round, or an answer before the
window opened) means the flat point, not zero. `timed: false` is a fully supported round, not a
degenerate one. **The last song scores ×`FINAL_MULTIPLIER` (2)**, announced before it plays, so
the last three songs are not a formality.

## Time

**Nothing in `rules.js` reads a clock.** Every time-dependent rule takes `now` as an explicit
absolute epoch-ms (server-corrected by the caller), and state stores absolute instants, never
durations. Devices agree on *when*, while disagreeing by hundreds of ms on *how long ago*.

- **`openWindow` is separate from dealing.** Online, the deal and the synchronized clip start
  are seconds apart on a cold CDN. Timing speed from the deal would reward whoever's audio
  buffered first. Idempotent; the first write wins.
- **Each answer stamps its elapsed time while its window is current (`elapsedIn`).**
  Pass-and-play opens a NEW window per player, so measuring at settle time would give the
  early players a free full bonus. Elapsed is clamped to the window at both ends: a frozen
  tab once recorded "43.0s" on a six-second window.
- **Race speed is measured to the buzz, not the submit**, or long titles lose to
  abbreviations.
- **`expireQuestion` is the one gate in the app that closes on time** rather than on
  consensus or a departure: a present player who never answers is something presence cannot
  see. Its one-shot key names the question index AND the phase, because a race question can
  expire twice (the buzz window, then the buzzer's answer window) without either changing.
- **`resumeRound` re-asks the question rather than resuming mid-question:** a saved deadline is
  a moment that has already passed. Scores, lives and the elimination order carry over; the
  pass order is rebuilt from the survivors. It returns `null` (offer a fresh game), never
  throws, because the blob may be from an older build.

## The song pool and the deal

**AniTune is the one game whose LOCAL play needs a third-party network**: themes come from
`api.animethemes.moe` and audio from `a.animethemes.moe`, so it cannot deal offline. Limits and
quirks are in `services/animethemesClient.js`'s header: about 90 requests a minute, throttled
by request START so several batches stay in flight; 403 without a User-Agent in Node; and no
CORS on the audio GET, so it is plain `<audio src>` only, never Web Audio.

- **Resolution (`services/resolveAnime.js`, `matchAnime.js`)**: an AniList id first (25 ids per
  request, match and themes in one response), then a title search that is re-ranked, because
  the API's ordering is not trustworthy. The result is cached once, never re-resolved per
  question.
- **Theme cache (`buildQuestions.js`)**: per slug, 14-day TTL, VERSIONED key. Bump the suffix
  whenever `THEMES_INCLUDE` or `slimThemes` changes, or players inside the TTL get the new
  reveal with none of the new fields. v3 stores the slimmed shape: v2's raw payload, at about
  20 KB a show, hit the ~5 MB localStorage quota and crowded the profiles key.
- **`eligibleEntries`**: `sharedSongsOnly` means EVERY player owns the show, deliberately
  stricter than AniGuess's "one other player". Everyone hears the same clip, so a show one
  player lacks is a guaranteed blind guess. The owners come out with each show for the
  reveal's "whose list" line and for the hints.
- **Popularity (`utils/popularity.js`)** ports AniFake's fame floor onto anime `popularity`:
  a quantile of the table's own pool, never a fixed count. Missing popularity is honestly
  absent here (`!= null`), unlike AniFake's `?? 0`. The default level is off, because
  `mergePrefs` backfills defaults and a filter that switched itself on would quietly shrink
  everyone's pool. A narrowed year range drops shows with no stored date; an untouched range
  keeps them (`yearRangeIsOpen`).
- **`pickAudioForTheme` ignores `spoiler`/`nsfw`**: they describe the VIDEO, and over 71 themes
  the filter removed 11% of songs and changed the chosen audio in zero cases.
- **`pickRound`**: at most `maxPerAnime` songs per show (topped up past the cap rather than
  dealing a short round). It stamps each question's `clipFraction` (`random` skips the first
  fifth, which is often silence) and its `lookalikes`.

**Grading (`utils/titleMatch.js`) is generous where a player plainly knows the show and strict
where a guess only looks like it does:** any season, English or romaji, or whole words of
the title. Never a 4+ letter substring, never only season or format words ("season 2"), and
never a word shared with one of the question's `lookalikes` (other franchises in this pool).
A guess that fits two shows is a coin toss, not an answer.

## Audio

- **One `<audio>` for the whole game (`hooks/usePrimedAudio.js`).** iOS lets an element that
  once played from a gesture play again without one, so only the first song needs a tap. Songs
  switch with `src = …; load()`. If a later `play()` is still refused, `markPrimed(false)`
  goes back to asking. This is not verified on a real iPhone, which is why the fallbacks stay.
  The next-song preload uses a throwaway element, so it never cuts off the current song.
- **The clip runs the whole window and on until the reveal** (`ClipPlayer`). There is no clip
  length: a fixed 10s clip in a 20s window was ten seconds of silence. `windowSeconds` only
  fills the bar, and hints unlock at 35% and 65% of it. The CDN often 503s with no `error`
  event, hence the stall timeout.
- **Online sync (`SyncedClipPlayer`)**: everyone taps ready, every device seeks to the same
  fraction, and plays at a server-time `clipStartAt` corrected by `serverOffset`. **A phone
  that cannot load the clip still reports ready**, or one broken phone holds the room on
  "Waiting for everyone…" forever; it answers from what the others hear.

## Local and online

Local (`hooks/useAniTuneRound.js`) has two one-device styles per mode:

- **Race**: `buzz` (a pad per player, number keys 1–9) or `shout` (`claimSpoken` /
  `awardSpoken`). A wrong shout ENDS the song, since the answer was on screen to check.
- **Everyone guesses**: `private` (pass the device; the entry order rotates each question, since
  entering last is an advantage) or `aloud` (`selfReport`: the table ticks who got it, flat
  points, no speed).

Online (`hooks/useAniTuneRoom.js`) funnels every action through ONE transaction on
`state/game`; an empty patch aborts it. The host deals (the slow network part) and publishes
the round. **The answers sit in `state/`, a stated concession** shared with AniQuiz and
AniPeek: every phone must load the audio URL, and nothing in a song is private. Gates count
`livePlayerIds` (present AND not knocked out), because an eliminated player never submits.
`revealNow` charges nobody a life, since it reconciles a departure; an expiry does charge.
`releaseBuzz` hands back a buzz whose buzzer left. `smoke/anitune.smoke.test.js` covers the
room.

Words the playtest strategy (`playtest/strategies/anitune.js`) presses: "Resume", "Start
fresh", "Play clip", "Buzz <name>", "<name> said it first", "Right", "Wrong", "Someone got
it", "Show the answer", "<name> got it", "Nobody got it", "Done", the "Which anime is this?"
box and "Lock in". The bot also fakes AnimeThemes responses at the real throttle.
