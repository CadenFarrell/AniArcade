---
paths:
  - "src/**/*.jsx"
  - "src/**/*.css"
---

# Styling: what every screen keeps

The look is a manga page: paper canvas (`#efebe2`), ink `#141414` for every border and hard
shadow, one red. Call sites name token ROLES (`@theme` in `src/index.css`), never values —
that is how the canvas went from black to paper without editing ~500 call sites. Textures,
type, art, the shell and the sound engine: `.claude/rules/styling-assets.md`.

**Every solid fill is a dark ink carrying `text-paper`.** On paper no colour is both readable
text (luminance under ~0.15) and a fill under ink text (over ~0.20), so fills are dark print
inks and the same ink reads as text on the page. Each accent's comment carries both ratios
(text on `surface-2`, paper on the fill); re-check both together.

- `text-ink` is right only on a LIGHT fill — a white chip or a /45 tint
  (`anirank/utils/tierTone.js` is the worked example).
- `pink` (vermilion) and `red` (crimson) differ only by hue, so a right/wrong is never colour
  alone: rows use `shared/ui/Mark.jsx` (✓/✗ with its word), a landing uses `ResultImpact`.
  Boards and panels are ruled in INK, never a game's red (AniQuiz's crimson board read as a
  board of mistakes).
- `Button`'s `primary` is ink, not pink, so red stays free for the one thing that should
  stand out; `secondary` is its outline.
- No glow (`--glow` is gone; a coloured blur on paper reads as a print fault). Where glow
  carried meaning it became a texture or amber ink (`TimerBar`'s last five seconds `hatch`).

**Neutral colour is a role, never an opacity:** never `white/N`, `black/N` or `text-white` —
a literal stays white whatever the canvas. Text has FOUR levels, a ceiling: 4.5:1 on
`surface-2` floors the ramp at 0.62 alpha (`fg-faint` folded into `fg-subtle` because both
needed the same alpha). Three roles sit below the floor on purpose and must not collapse into
`fg-subtle`: `fg-icon` (glyph buttons, 3:1), `fg-disabled` (WCAG-exempt), `fg-ghost`
(`aria-hidden` markers). A missing shade is a missing role, not an opacity. Scrims stay ink;
text on a scrim is `text-paper`.

**No emoji on screen — `shared/ui/icons.js` is the one icon set** (OS emoji paint in their own
glossy colours and look pasted in). An icon stays only where it says what the words do not:
yes/no, a row's status, lives, crown, mask, icon-only buttons. `<Icon name>` sizes to its
text, is the one place `currentColor` is allowed, and is decorative unless given `label`.
Places are `<PlaceMark>`, lives AniTune's `Lives`; `Banner` draws its own tone mark, so nothing prefixes a ⚠️.
`icons.test.js` fails on an unknown name or an emoji on a rendered line; the playtest
strategies find buttons by label, so a label change needs a strategy change.

**`field-lit` goes ALONGSIDE `focus-pop`, never instead** — the ink ring is what a
forced-colours user gets. It fires on `:focus`, not `:focus-visible`, so pointer users see it
too, and `NumberInput` applies it only while the value is valid (or it repaints the red error
border).

**Motion is from-state only**, so reduced motion leaves the finished picture: `screen-in` on
`Screen` (clip-path and opacity, NEVER `transform` — a transformed ancestor becomes the
containing block for `fixed` descendants and a modal jumps); the hub's `PanelWipe` (timers in
`hub/useWipe.js`, since jsdom never fires `animationend`; a press during a wipe is ignored, so
tests wait for `[data-wipe]` to clear); `attract-blink`.

**Viewport heights are `dvh`**, never `vh` or `min-h-screen` (mobile `vh` excludes the
retracting URL bar, so the screen jumps on first scroll). Modals blur what is behind them and
take a 3px rule and a deeper shadow.

**Sounds come in two kinds.** A moment that IS a press plays through the button
(`sound="yes"`, or `sound={null}` plus `playSound` in the handler when the result is only known
there). A moment that ARRIVES — a network verdict, a reveal, a turn, a clock — goes through
`useSoundCue(name, key)`, once per new key, so re-renders and StrictMode never replay it.
Online each phone sounds its OWN result (`correct`/`wrong`; anyone else's is `reveal`) and
shared moments sound everywhere; locally the table's result plays. `Button` defaults to
`'tap'` (`null` for none), `GhostButton`/`HubButton` play `back`, `Modal` plays `open`.
