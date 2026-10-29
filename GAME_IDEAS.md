# AniArcade — game ideas not built yet

Context for the new chat: AniArcade (this repo) has 12 games — AniGuess, AniTune, AniRank,
AniFake, AniWave, AniTag, AniQuiz, AniTurf, AniPeek, AniOut, AniName, AniChain. Every game has
a local (pass-and-play) and an online (Firebase room) mode, a rules sheet, a playtest bot
strategy and a smoke test. Read CLAUDE.md first. Things that shape any new game:

- Data available per player: their imported anime list (show title, studio, debut year,
  source, format, genres, episodes, score, popularity) and each show's characters (name,
  role Main/Supporting, gender, portrait, short description, favourites). The fact pack
  (public/facts/) adds ~1000 popular shows: tags, staff, theme songs, Japanese voice
  actors, main/supporting casts. There are NO quotes, synopses or hair/power data anywhere.
- Big tile words already taken: GUESS TUNE RANK FAKE WAVE TAG QUIZ TURF PEEK OUT NAME CHAIN.
- All 12 accent inks are taken (the newest is violet, AniChain's); a new game needs a new
  decorative colour token in src/index.css (+ accents.js, Badge, Wordmark, Lobby,
  OnlineIdentityCard maps). Each token's comment carries its two contrast ratios.
- No third-party network in local play; anything new (e.g. quotes) ships as a static file.
- Reusable pieces added with AniChain: a shared Red/Blue team split and teams card
  (shared/utils/teams.js, shared/components/teams/ — the crown is optional), and a
  partial-name guess matcher (shared/utils/nameMatch.js: "Kakashi" counts, "Uchiha" doesn't
  when several people share it). Any typed guess-the-character game should use the matcher.
- Games should be original designs in a genre, not a version of a specific existing game.

## Built: AniChain (was idea 1)
Two clue-givers alternate one word each toward a secret character. Shipped with three table
shapes (one pair vs everyone, rival givers, team pairs), one guess per word, and banned
words (name, show title, other cast). Notes in src/games/anichain/CLAUDE.md.
Possible follow-ups: an optional typed local mode, a per-word clock for local play.

## 1. Finish the quote
"I alone am the ___" — finish a famous anime line.
- Recommendation: make it a question category inside AniQuiz rather than its own game.
- The hard part is data: no source has quotes. It needs a hand-curated file (a few hundred
  lines with show + character + accepted endings), shipped like the fact pack.
- Translations differ (sub vs dub), so use multiple choice, or typed with loose matching
  and several accepted endings.
- Famous quotes cluster in ~40 big shows, so it won't follow players' lists closely; filter
  to shows on the table's lists where possible.
- Open questions: standalone vs AniQuiz category, who curates the quote list, typed vs choice.

## 2. AniDraft — draft a team, the table votes
A format popular on anime social media.
- Round: a set of roles (Captain, Rival, Healer, Comic Relief, Final Boss, Best Friend…).
  Players snake-draft characters from everyone's lists into their roles, then everyone
  votes on the best team (can't vote for your own).
- Data: characters + portraits from the lists; no facts needed.
- Pure opinion and arguments; a good fit for groups, works locally and online.
- Open questions: role list (fixed, random, or custom), draft order and timer, can a
  character be taken twice, vote format (single vote vs rank), number of rounds.

## 3. Redacted bio
A character's description with names blanked out, revealed one line at a time; guess
earlier for more points.
- Data: character descriptions are on profiles (trimmed); names must be redacted reliably
  (the character's own name parts, the show title, other cast names). AniChain's
  bannedWords (src/games/anichain/chainWords.js) already builds exactly that word list.
- Guesses can reuse shared/utils/nameMatch.js.
- Overlap: AniPeek's hint cards are similar; descriptions are short, so maybe 3–4 reveals.
- Open questions: buzz-in vs everyone answers, typed vs choice, how much to redact.

## 4. AniPitch — pitch a made-up anime
A comedy party game in the pitch-and-vote genre. Design our own loop rather than following
any existing card game's rules.
- Round: each player is dealt prompts (e.g. a genre, a setting, a trope, a twist) and
  pitches a made-up anime; the table votes for the best pitch.
- Data: none from lists; needs a hand-written prompt deck shipped as a file.
- The arcade has no pure-comedy game yet, and it works with no imported list.
- Local: pitches spoken aloud, votes passed round. Online: typed title + one-line pitch.
- Open questions: prompt categories, what makes the loop our own (e.g. a twist dealt
  mid-pitch, pitches built from the table's own shows), typed vs spoken, vote rules, rounds.

## 5. AniSketch — draw a character, others guess
- Round: the drawer gets a character from their list and draws it; others guess (typed
  or choice). Faster guesses score more for both.
- Data: characters from lists; portrait shown on reveal.
- The most work of these: a drawing canvas, and online syncing of strokes through Firebase
  (keep it small: batched stroke points, size limits, free-tier bandwidth).
- Typed guesses can reuse shared/utils/nameMatch.js.
- Open questions: timer, guess format, drawing tools (colours, eraser, undo).

## Also considered
- AniOut "grouping" mode: sort 16 characters into 4 hidden groups of 4. It reuses AniOut's
  one-answer deal checks, so it fits there as a mode.
- Higher or lower on show stats: skipped because AniRank already ranks by facts.
- Voice-actor categories in AniName: left out because the data is too thin.
