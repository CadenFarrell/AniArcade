---
paths:
  - "src/**/*.jsx"
  - "src/**/*.css"
  - "src/shared/ui/**"
  - "src/shared/services/sound.js"
  - "src/shared/hooks/useSoundCue.js"
  - "public/favicon.svg"
  - "public/art/**"
  - "public/sounds/**"
---

# Styling and the shell

Moved from the root `CLAUDE.md` so it loads only when Claude works on the files above. The
cross-game architecture it builds on is still there.

## Styling

**The look is a manga page: warm paper, black ink, one red.** It replaced a neon arcade
cabinet (near-black canvas, glow halos) because the cabinet read as generated and generic;
the references were two manga landing pages. Canvas `#efebe2`, three surfaces 1.12 / 1.24:1
apart, ink `#141414` for every border and hard shadow. **Every token name survived the
swap** — roles, not values, are what call sites name — which is how ~500 call sites changed
colour without being edited. The tokens, shared primitives and shell went first; the hub,
setup screens, results and in-round screens followed, each onto a shared frame (below), and
the game sounds with them.

**The accent contract INVERTED with the canvas, and it is the one non-obvious rule here.**
On paper no colour can be both readable text on the page (luminance below ~0.15) and a
fill under ink text (above ~0.20). So every solid fill is a DARK print ink and carries
**`text-paper`**, and the same ink reads as text on the page — the way the references set
black ORDER NOW and white-on-red logos. Each accent's comment carries both ratios (text on
`surface-2`, the darkest surface; paper text on the fill), and both must be re-checked
together. Two consequences:

- `text-ink` now means *ink-coloured text*, which is right only on a LIGHT fill — a white
  chip, or a knocked-back tint. `anirank/utils/tierTone.js` is the worked example: solid
  rungs take `text-paper`, the /45 tints over paper are mid-tone and take `text-ink`.
- `pink` is vermilion (`#b4300f`) and `red` is crimson (`#931229`) — two reds, separated by
  hue. So a right/wrong is never colour alone: rows use `shared/ui/Mark.jsx` (a stamped ✓/✗
  with its word) and a result landing uses `ResultImpact`'s ✓/✗ block. A board or panel is
  ruled in INK, never in a game's red accent — AniQuiz's crimson is hub identity only, and
  a board ruled in it read as a board of mistakes.

`Button`'s `primary` is **ink**, not pink: a page whose every main action is red has no red
left for the one thing that should stand out. `secondary` is the outline of the same block.

**The glow is gone, and `--glow` with it.** Light needs a dark room; on paper a coloured blur
reads as a printing fault. `btn-pop` kept its physics exactly — the ink shadow is what the
press travels into. Where glow carried meaning it was replaced, not dropped: `TimerBar`'s last
five seconds take a paper `hatch` (a texture change, which also survives colour-blindness),
and the "lit" leader / perfect-board numerals are inked in amber, the score colour.

**Print textures are static, gradient-or-inline-SVG utilities** — `paper-grain`,
`plus-grid`, `halftone` (`--tone`, `--tone-size`), `speed-lines` (`--lines`), `hatch`
(`--hatch`), `slash` (`--slash`). No requests, nothing to 404, nothing that moves, so nothing
for reduced motion to stop. Colour comes from the custom property with an ink default.

**Motion is three things, all FROM-state animations so reduced motion leaves the finished
picture:** `screen-in` on `Screen`'s root (every view renders its own Screen, so every view
change in every game page-turns with no router involved — clip-path and opacity only, NEVER
transform, because a transformed ancestor becomes the containing block for `fixed`
descendants and a modal mounted mid-animation would jump); the hub's `PanelWipe` between
title → hub → game (timers in `hub/useWipe.js`, not `animationend`, which jsdom never fires
and a backgrounded tab can freeze; a press during a wipe is ignored, so tests must wait for
`[data-wipe]` to clear); and `attract-blink` on PRESS START.

**Type:** Oswald (display, condensed caps), Archivo (body), and Dela Gothic One as
`--font-kana` — **decoration only**, always through `<Kana>` (aria-hidden, `lang="ja"`), and
the file is a cut holding only the katakana block + べ を 中 選. Every string comes from
`shared/ui/kanaText.js` or a game descriptor's `kana`, and
`kanaText.test.js` pins them against the cut, because a missing glyph silently falls back mid-word. **The module is
`kanaText.js`, not `kana.js`:** beside `Kana.jsx` on a case-insensitive filesystem, Vite
resolved `./Kana` to the `.js` and every `<Kana>` crashed. `font-synthesis-weight: none` on
`body` stops kana inheriting a faux bold.

**Art is public-domain ukiyo-e, never generated — except the hub tiles, which are the
player's own characters.** The title, hero and credits use three Met Open Access prints
(Hokusai, Kuniyoshi, Hiroshige), grayscale WebP in `public/art/`, each processed once — the
record of source, licence and processing is `shared/ui/credits.js`, which also feeds the
hub's Credits dialog and the title screen's credit line, and `credits.test.js` checks each
file exists and is CC0. The tiles draw fresh greyscale portraits from the main profile's
imported list every visit (`hub/tileCharacters.js`; see `src/hub/CLAUDE.md`), so every
player's board is theirs — they are the player's data, not shipped assets. **The red is never
in a file:** a CSS sun disc sits behind the print and the print is `mix-blend-multiply`'d over
it, so ink lines stay black and only the paper turns red. Keep every shipped asset CC0 or OFL;
a new one under any other licence needs a decision, not just an entry.

**The shell:**

- `shared/components/TopBar.jsx` is the strip across every screen, mounted once by
  `HubScreen` (which knows the open game's title). Things a GAME owns arrive through two
  **slots** (`shared/context/topBarContext.js`) by portal: `HubButton` into the left,
  `RoomShell`'s room code + Leave into the right — minus the code in the lobby, whose
  banner draws the big `RoomCode` (each game's lobby branch passes `codeInPage`), so the one
  screen never shows the code twice. With no bar (a game mounted alone in a test) both fall
  back to placing themselves. `Screen`'s `pt-20` is what clears the bar's
  `h-14`.
- `shared/components/RoomShell.jsx` replaced the `shell()` hand-copied into all seven
  `OnlineGame.jsx` files (which had drifted: only AniTag showed the code on phones and capped
  the disconnect banners). A game's `shell` is now one line around it.
- `hub/TitleScreen.jsx` once per browser session (`hub/titleSeen.js`, sessionStorage, so a
  refresh mid-game skips it). PRESS START is also the user gesture the sound engine needs.
  `renderArcade` marks it seen unless passed `{ showTitle: true }`.
- Sound: `shared/services/sound.js` (Web Audio; bytes prefetched at idle, the context created
  inside the first gesture, every failure is silence) and `SoundProvider` for the mute switch
  (`aniarcade_sound_muted`, not in `PRESERVED_KEYS`). `Button` takes `sound` (`'tap'`
  default, `null` for none), `GhostButton` and `HubButton` play `back`, `Modal` plays `open`
  (its `sound` prop, `null` where the moment already made one).
  The files are Kenney CC0, converted to MP3 because Safari's Vorbis support is not worth
  betting a click on.
- **Game sounds come in two kinds, and which kind a moment is decides how it is wired.** A
  moment that IS a press — a Yes/No ruling, a buzz, a local guess — plays through the
  button (`sound="yes"`, or `sound={null}` plus `playSound` in the handler when the result
  is only known inside it). A moment that ARRIVES — a verdict over the network, a reveal, a
  turn coming round, a clock running down — goes through `shared/hooks/useSoundCue.js`:
  `useSoundCue(name, key)` plays once per new key (so re-renders and StrictMode never
  replay it) through `playCue`, which never creates the AudioContext — a context made
  outside a gesture starts suspended, so a cue on a freshly reloaded tab is silent until
  the first tap. `useCountdownCue` is the last five seconds' tick and the `timeup` buzzer,
  in `TimerBar` and AniGuess's own clock. **Online, each phone sounds its OWN result**
  (`myId`/`playerId` decides `correct` vs `wrong`; anyone else's result is the plain
  `reveal`), and shared moments — a reveal, the results stamp, a buzz — sound everywhere.
  On the one local device the table's result plays. `sound.test.js` checks every name
  has its file.

**No emoji, anywhere on screen — `shared/ui/icons.js` is the arcade's one icon set.** ~450
platform emoji were the last thing on the page drawn by somebody else: every OS paints them in
its own glossy colours, so on black ink they were the one part that looked pasted in. Most
were simply DELETED — they decorated a label that already said the same thing ("🎮 Start
Game") — and an icon survives only where it carries something the words do not: yes/no
marks, a player's status in a row (locked in, out, waiting, buzzed), lives, a host's crown,
the fake's mask, icon-only buttons. `<Icon name>` (24px ink, round strokes) sizes to the
surrounding text and is the one place `currentColor` is allowed — an inline icon is part of
the text it sits in, so it follows that text through every button variant. It is
decorative unless given a `label`. Places are `<PlaceMark place>` (a numbered medal, with
the digit as text), lives are AniTune's `Lives`, and `Banner` draws its tone's mark itself,
so no call site prefixes a "⚠️". `icons.test.js` checks every `<Icon name="…">` in `src`
exists and fails on any emoji on a rendered (non-comment) line; the playtest strategies find
buttons by label, so a label change there needs a strategy change too.

**Neutral colour is a ROLE, never an opacity, and `white/N` must not come back.** The
canvas, surfaces and accents were always tokens, but every dim text line, hairline and
translucent fill was a hardcoded `white/N` utility — ~510 of them at **fifteen** different
opacity steps, plus 16 `black/N` scrims. That the canvas could go from black to paper as a
value edit is the proof the ramp was worth it: a `white/N` literal would have been white on
paper, and so would the 229 `text-white` literals the paper pass had to sweep to
`text-fg-strong` by hand. Don't write `text-white` either.

**There are FOUR text levels and that is a ceiling, not a preference.** The ramp is ink at
graded alpha; on `surface-2` 4.5:1 puts the floor at 0.62, so there is only so much room
between it and solid ink. The ramp used to have six and the bottom two were simply illegal;
`fg-faint` was **folded into `fg-subtle`** because the alpha both needed in order to pass was
the same number — they were never two roles. Three roles sit below that floor on purpose:
`fg-icon` (glyph buttons, a UI affordance held to 3.0:1), `fg-disabled` (WCAG exempts
disabled controls) and `fg-ghost` (`aria-hidden` markers). Collapsing any of those into
`fg-subtle` silently re-couples them to an obligation they don't owe. If a shade seems
missing, the question is never "which opacity" but **which role**. Scrims stayed ink through
the canvas swap — a wash tints the page, a scrim hides what is under it, and hiding is
darkening on any ground — and text on a scrim is `text-paper`.

`public/favicon.svg` is hand-synced to `--color-pop-pink` / `--color-ink` / `--color-paper`
because a file in `public/` cannot see the theme — a palette change that skips it leaves the
tab icon on the old colours silently.

**`field-lit` is a second focus signal and must never become the only one.** Every field
already has an ink border, so focus cannot be a border alone. `field-lit` takes the primary
accent on the border plus a hard underline, and it is applied **alongside** `focus-pop`,
never instead of it: the ink ring is what a forced-colours or high-contrast user actually
gets. It fires on `:focus`, not `:focus-visible`, because a field that lights only for
keyboard users leaves every pointer user on an unlit form. `NumberInput` applies it **only
when the value is valid** — on an invalid stepper it would repaint the red error border at
exactly the moment the user is looking at it.

**Modals blur what is behind them** — an ink scrim over a busy page leaves the page's own ink
lines showing through as noise behind the panel — and the panel takes a 3px rule and a
deeper shadow, the one panel that has to look lifted off the page.

**Viewport heights are `dvh`, not `vh`.** `vh` on mobile browsers measures the viewport
*without* the retracting URL bar, so a centred screen paints a bar-height too low and then
jumps when the bar hides on first scroll. `Screen.jsx`, `ListManager.jsx` and the `body`
floor in the base layer all use `dvh`; they are all `min-height`, so it costs nothing on
desktop. Don't reintroduce `min-h-screen`.
