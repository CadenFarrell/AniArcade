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

Moved from the root `CLAUDE.md` so it loads only when Claude works on the files above. The
cross-game architecture it builds on is still there.

## Game settings

Every game's remembered options live in `games/<game>/prefs.js` as a single `DEFAULT_PREFS`
literal, read through `shared/hooks/useGamePrefs.js` and stored in **one** arcade-wide key
(`aniarcade_game_prefs`, a `{ [gameId]: {...} }` map) — unlike the per-game keys that hold
state one game owns (`<game>_online_room`, `anirank_custom_prompts`).

`DEFAULT_PREFS` **is the schema**, not just a fallback: `mergePrefs` drops unknown keys and
type-mismatched values against it. Two consequences that are easy to get wrong:

- **`writePrefs` merges a partial**, and that is load-bearing rather than tidy. Setup screens
  and online lobbies are near-twins but not identical (AniFake's lobby has no talk mode), and
  a lobby that replaced the slice would wipe the options only local play can reach.
- **Adding a key changes behaviour for existing players**, because `mergePrefs` fills missing
  keys from the defaults on the next read. A new option defaulted to "on" reaches everyone
  who never opens the settings card — usually what you want, but decide it rather than
  discover it.

**Every game's settings card is one component rendered by both screens** —
`AniGuessSettings`, `AniFakeSettings`, `AniRankSettings`, `AniTuneSettings`,
`AniTagSettings`, `WavelengthSettings` and AniQuiz's `QuizSettings`, each beside its game's
setup screen. They were hand-kept copies first, and every pair had drifted somewhere
(AniWave's reset link sat inside the card online and under Start locally; AniGuess's two
screens listed the same options in different orders). A local-only or online-only option is a prop on the card (`local`,
`online`), never a second copy of it. Each card reports changes as one `onChange(key, value)`
because the lobby's settings object *is* what leaves the host's device, and a setter per prop
puts the drift back one level down.

Adding an option means: the key in `prefs.js`; the control in the game's settings card; the
key in **both** screens' settings object, seeded from `prefs` (the lobby's object is what
reaches `startGame`, so a key missing there never leaves the host's device); and — only if
the *rules* act on it — a copy onto the round node in the room hook with a `!== false`-style
back-compat default in `normalizeGame`. AniRank keeps separate `useState`s, because an axis
change resets `blind` and the state has to live beside the axis it is coupled to. An option
that only decides which screen renders (`talkMode`) or how a pool is drawn (`sharedOnly`,
`fame`) stays out of round state.

Anything derived from a pref that is worth testing belongs in a `.js` module, which is why
`prefs.js` and `fame.js` are separate files from the screens that read them. A component test
*could* reach it through the screen now (see `.claude/rules/testing.md`), but only by mounting that whole
screen under jsdom just to check one derived value. A pure `.test.js` checks it directly.

## Settings cards

**A setting's note comes in two tiers, and `shared/components/SettingHelp.jsx` is the only
place either one is styled.** Every setup screen and lobby used to hand-place a `<p
className="ml-10 text-base text-white/50">` holding both halves at once; four games' worth
of that put a two-to-four line paragraph under every single-line control, so a settings card
ran roughly three times taller in prose than in controls and read as a wall rather than as
help. None of the copy was deleted — several paragraphs carry rules the table actually needs
— the *why* simply stops being the first thing on screen. The split is nearly always where
the existing paragraph already broke: its opening sentence names the behaviour and the rest
argues for it. Pass the first as `children`, the second as `more`.

The weight was the other half of the problem. Helper copy had drifted to three treatments
across the games (`text-base text-white/50`, `text-sm text-white/50`, `text-sm
text-white/30`), and with no consistent signal for "this is the secondary line" the volume
read as noise instead of hierarchy. Everything routes through here now, at two weights only.

**The options most tables never change fold under "More settings"**
(`shared/components/MoreSettings.jsx`), inside the card they belong to: AniTune's clip and
pool details, AniGuess's randomizer and points, AniFake's pool and fame, AniTag's names-per-
round and own categories, AniQuiz's extras, timer and category switches. AniRank and AniWave
fold nothing — their cards were already short. Two rules: **a warning never goes inside a
fold** (a banner about a folded-away setting is a problem with no visible cause, so banners
sit after it), and the open state is one arcade-wide key, `aniarcade_more_settings`, for
`aniarcade_setting_detail`'s reasons (it belongs to no game; not in `PRESERVED_KEYS`). Folded
controls are `hidden`, so a test or bot that changes one has to open the fold first —
`openMoreSettings(user)` in `shared/testing/arcade.jsx`, which opens only closed folds,
because the remembered state carries from one test to the next.

**`DetailToggle` goes on a card only when that card has something to reveal**, and on every
such card rather than once per screen — two of them a few hundred pixels apart is mild
redundancy, while a card full of quietly-truncated notes whose control is somewhere above
the fold is a feature nobody finds. AniTune's second card is every-note-one-line and so
carries no toggle rather than an inert one.

**Both halves fail soft, deliberately.** `useHelpDetail` returns `{ detail: false, setDetail:
null }` outside a provider instead of throwing, and `DetailToggle` renders nothing at all
there rather than a control that does nothing. This is presentation only, and its consumers
are leaf components scattered across every game's setup screen — exactly the population most
likely to end up in a future screen nobody remembered to wrap.

AniFake and AniRank keep their copy in a `help.js` beside `prefs.js`, being long enough that
inlining buried the controls in JSX; AniTune and AniGuess inline theirs. **The preference is
arcade-wide and gets its own localStorage key** (`aniarcade_setting_detail`), not a slot in
`aniarcade_game_prefs`: that map is `{ [gameId]: {...} }` and each game's `DEFAULT_PREFS`
*is* its schema, so there is nowhere in it for a value belonging to no game. Off by default,
which is the point of the split — the short line is what a returning player should meet. It
is deliberately absent from `resetKeys.js`'s `PRESERVED_KEYS`: a crash reset clearing a
cosmetic preference is the right outcome, and the default it falls back to is the quiet one.
