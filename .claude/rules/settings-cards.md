---
paths:
  - "src/games/**/*Settings.jsx"
  - "src/games/**/*Setup*.jsx"
  - "src/games/**/*Lobby*.jsx"
  - "src/games/**/prefs.js"
  - "src/games/**/help.js"
  - "src/shared/components/SettingHelp.jsx"
  - "src/shared/components/MoreSettings.jsx"
  - "src/shared/hooks/useGamePrefs.js"
---

# Game settings and settings cards

## Prefs

Each game's options are one `DEFAULT_PREFS` literal in `games/<game>/prefs.js`, read through
`useGamePrefs.js` and stored in the one arcade-wide key `aniarcade_game_prefs`
(`{ [gameId]: {...} }`). **`DEFAULT_PREFS` is the schema:** `mergePrefs` drops unknown keys and
type-mismatched values against it.

- **`writePrefs` merges a partial**, and must: setup screens and lobbies are near-twins, not
  twins (AniFake's lobby has no talk mode), and replacing the slice would wipe options only one
  of them can reach.
- **A new key reaches existing players**, since `mergePrefs` fills missing keys from the
  defaults. A new option defaulted to "on" reaches everyone who never opens the card — decide
  that rather than discover it.

**One settings card per game, rendered by both screens** (`AniGuessSettings`, `AniFakeSettings`,
`AniRankSettings`, `AniTuneSettings`, `AniTagSettings`, `WavelengthSettings`, AniQuiz's
`QuizSettings`) — the hand-kept pairs had all drifted. A local- or online-only option is a prop
on the card (`local`, `online`), never a second copy. Changes report as one
`onChange(key, value)`, because the lobby's settings object IS what leaves the host's device.

**Adding an option:** the key in `prefs.js`; the control in the card; the key in BOTH screens'
settings objects, seeded from `prefs` (a key missing from the lobby's object never reaches
`startGame`); and — only if the *rules* act on it — a copy onto the round node in the room hook
with a `!== false`-style default in `normalizeGame`. An option that only picks a screen
(`talkMode`) or how a pool is drawn (`sharedOnly`, `fame`) stays out of round state. AniRank
keeps separate `useState`s, because an axis change resets `blind`. Anything derived from a pref
worth testing goes in a `.js` module (`prefs.js`, `fame.js`) with a pure `.test.js`.

## Setting notes, folds and the detail toggle

**A note has two tiers and `SettingHelp.jsx` is the only place either is styled:** the first
sentence (what it does) as `children`, the argument for it as `more`. Hand-placed paragraphs
had made cards three times taller in prose than controls, at three drifting weights.

**Options most tables never change fold under "More settings"** (`MoreSettings.jsx`), inside
their own card. **A warning never goes inside a fold** — a banner about a hidden setting is a
problem with no visible cause, so banners sit after it. The open state is one arcade-wide key,
`aniarcade_more_settings` (not in `PRESERVED_KEYS`). Folded controls are `hidden`, so a test or
bot opens the fold first: `openMoreSettings(user)` in `shared/testing/arcade.jsx`, which opens
only closed folds, because the remembered state carries between tests.

**`DetailToggle` goes on every card with something to reveal, and only those** — a card of
truncated notes whose control is somewhere off-screen is a feature nobody finds. The preference
is its own key, `aniarcade_setting_detail` (it belongs to no game, so it cannot live in the
prefs map), off by default, and not in `PRESERVED_KEYS`.

**Both fail soft:** `useHelpDetail` returns `{ detail: false, setDetail: null }` outside a
provider and `DetailToggle` renders nothing there — these are leaf components in every setup
screen, the likeliest to land in a screen nobody wrapped. AniFake and AniRank keep their copy in
a `help.js` beside `prefs.js`; AniTune and AniGuess inline theirs.
