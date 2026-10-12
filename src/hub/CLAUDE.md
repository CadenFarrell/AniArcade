# Hub — tile layout and icons

Loaded when Claude works on files in this folder. Moved here from the root `CLAUDE.md`,
which still holds the cross-game architecture these notes build on (rules.js, online rooms,
presence, settings, profiles, styling).

## The board

**The menu is a board rather than a list, and the tile sizing is the whole of it.**
`HubScreen.jsx` lays the roster out `grid-cols-2 sm:grid-cols-4 lg:grid-cols-6` inside a
`max-w-4xl` shell. A stacked column was already running off a laptop at six games and the
registry only grows. The ladder is picked so a tile stays roughly 136–155px at *every*
breakpoint rather than ballooning on desktop — which is why the icon inside it needs no
responsive size at all. `lg:` is the app's only one; everything else here is `sm:`-only.

Six across rather than four is also what stops the accent panel being mostly paint. The
icons are square and the marquee is `aspect-[4/3]`, so **growing the icon can never fill
the sides — the panel has to come IN to meet it.**

**The icon is sized with a definite height and never a percentage.** A percentage resolves
against a height the marquee's own `aspect-ratio` has not computed yet, so the box falls
back to sizing itself from the icon: the marquee comes out square instead of 4:3 and the
board grows straight past the fold. Same reason the emoji fallback is sized in `text-*`.

**`hub/gameIcons.js` is icon geometry as DATA, keyed by game id rather than carried on the
descriptor.** `icon` is still the emoji string and nothing about that shape changed —
`GameIcon` returns `null` when it finds no entry and the tile falls back to the emoji, so a
game added tomorrow has a working tile the day it lands and drawing it one later is a
single entry. The shapes live in a `.js` rather than in JSX for `wavelength/utils/arc.js`'s
reason: a `.js` module can be checked directly by a plain `.test.js` under `node`, while
anything defined inside a `.jsx` can only be reached by mounting it in a jsdom component
test. That is slower, and it checks what got rendered rather than the data itself.

`gameIcons.test.js` earns its place because **every failure here is silent.** A mistyped
key is indistinguishable from a game nobody has drawn yet, and "the icon never appeared" is
not something the hub can report. It pins the key set against the registry in *both*
directions — a game with no icon, and an orphan key naming no game — and that every shape
carries a `fill-`/`stroke-` class, because an unpainted shape is not a blank icon but a
BLACK one: SVG's default fill is black, which on this palette looks almost right.

Paint goes in `className` so the icons use the `@theme` tokens; geometry and stroke shape go
in attributes. That split is `Dial.jsx`'s. **No hex literals and no `currentColor`** —
`public/favicon.svg` is the one place hex appears in this repo, because a file in `public/`
cannot see the theme. Ink-on-accent is also what makes the unavailable card's `grayscale
opacity-50` work: a silhouette greys out cleanly where an emoji's own palette half-fades.

**A tile's blurb has two homes and exactly one is ever mounted** — `blurb-overlay` and
`blurb-inline` in `index.css`, guarded by `@media (hover: hover)` and `(hover: none)`. On a
pointer it overlays the panel on hover, which costs the tile no height and gives the text
the panel's whole depth: six lines instead of two, so a 97-character blurb stops truncating
on a 136px tile. On a touch screen there is no hover to reveal it with, and an overlay left
showing at rest would bury the artwork on every phone permanently, so there it sits under
the title and the tile is simply taller. The overlay is a **sibling** of the marquee rather
than a child, because the marquee is `aria-hidden` and nesting the text inside would drop
the blurb out of the button's accessible name.

`ArcadeMark` is `public/favicon.svg` brought into the app — the logo had lived only in the
tab. It is a **wide** plaque and that is not a styling whim: a ball on a stem over a base is
a person, the exact glyph the profile pill in the opposite corner wears, so it needs the
buttons beside it to read as a control panel — and squeezed into a 64px square a white ball
plus two white dots collapse into a face instead. Width is free on this screen; height is
not.
