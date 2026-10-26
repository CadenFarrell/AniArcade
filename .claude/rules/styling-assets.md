---
paths:
  - "src/index.css"
  - "src/shared/ui/**"
  - "src/shared/components/TopBar.jsx"
  - "src/shared/components/RoomShell.jsx"
  - "src/shared/context/topBarContext.js"
  - "src/shared/context/SoundProvider.jsx"
  - "src/shared/services/sound.js"
  - "src/shared/hooks/useSoundCue.js"
  - "src/hub/TitleScreen.jsx"
  - "src/hub/titleSeen.js"
  - "public/favicon.svg"
  - "public/art/**"
  - "public/sounds/**"
---

# Styling: textures, type, art, the shell and sound

The rules every screen keeps are in `.claude/rules/styling.md`.

**Print textures are static gradient-or-inline-SVG utilities** — `paper-grain`, `plus-grid`,
`halftone` (`--tone`, `--tone-size`), `speed-lines` (`--lines`), `hatch` (`--hatch`), `slash`
(`--slash`): no requests, nothing that moves, colour from the custom property with an ink
default. `btn-pop`'s press travels into the ink shadow; the "lit" leader and perfect-board
numerals are inked amber, the score colour. `Backdrop` is the plain sheet (crosses, ink tone)
unless given `game`: then it is that game's cover — speed-line burst, screentone slash and the
vertical kana, all in `accentVar(accent)`. Only the menus pass it (`ModePicker`, `SetupLayout`,
`RoomSetup`); in-round screens stay on the quiet sheet so busy boards read.

**Type:** Oswald (display caps), Archivo (body), Dela Gothic One as `--font-kana` — decoration
only, always through `<Kana>` (aria-hidden, `lang="ja"`). The font file holds only the katakana
block + べ を 中 選, so every string comes from `shared/ui/kanaText.js` or a descriptor's `kana`,
and `kanaText.test.js` pins them against the cut (a missing glyph falls back mid-word). It is
`kanaText.js`, not `kana.js`: beside `Kana.jsx` on a case-insensitive filesystem Vite resolved
`./Kana` to the `.js` and every `<Kana>` crashed. `font-synthesis-weight: none` on `body`
stops faux-bold kana.

**Art is public-domain ukiyo-e, never generated** — three Met Open Access prints, greyscale
WebP in `public/art/`, recorded (source, licence, processing) in `shared/ui/credits.js`, which
feeds the Credits dialog and the title's credit line; `credits.test.js` checks each exists and
is CC0. The hub tiles are the player's own portraits instead (`src/hub/CLAUDE.md`). **The red
is never in a file:** a CSS sun disc sits behind and the print is `mix-blend-multiply`'d over
it. Every shipped asset is CC0 or OFL; anything else needs a decision, not just an entry.
`public/favicon.svg` is hand-synced to `--color-pop-pink`/`--color-ink`/`--color-paper`, since
a `public/` file cannot see the theme.

**The shell:**

- `TopBar.jsx` is mounted once by `HubScreen`. What a GAME owns arrives through two portal
  slots (`topBarContext.js`): `HubButton` left, `RoomShell`'s code + Leave right — minus the
  code in the lobby, whose banner draws the big `RoomCode` (`codeInPage`), so no screen shows
  it twice. With no bar (a game mounted alone in a test) both place themselves. `Screen`'s
  `pt-20` clears the bar's `h-14`.
- `RoomShell.jsx` is the one shell every `OnlineGame.jsx` wraps itself in (the seven
  hand-copied ones had drifted).
- `TitleScreen.jsx` shows once per browser session (`titleSeen.js`, sessionStorage, so a
  refresh mid-game skips it); PRESS START is also the gesture the sound engine needs.
  `renderArcade` marks it seen unless passed `{ showTitle: true }`.

**Sound engine** (`services/sound.js`, Web Audio): bytes prefetched at idle, the context made
inside the first gesture, every failure silence. `playCue` (what `useSoundCue` uses) never
creates the context — one made outside a gesture starts suspended, so a cue on a fresh tab is
silent until the first tap. `useCountdownCue` is the last-five-seconds tick and `timeup`, in
`TimerBar` and AniGuess's clock. `SoundProvider` holds mute (`aniarcade_sound_muted`, not in
`PRESERVED_KEYS`). Files are Kenney CC0 as MP3 (Safari's Vorbis is not worth betting on);
`sound.test.js` checks every name has its file.
