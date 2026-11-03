# Hub — tile layout and art

Loaded when Claude works on files in this folder. Moved here from the root `CLAUDE.md`,
which still holds the cross-game architecture these notes build on (rules.js, online rooms,
presence, settings, profiles, styling).

## The board

**The menu is a board rather than a list, and how many go across is worked out from the
roster.** `boardLayout.js`'s `boardColumns(n)` gives each width a RANGE of column counts its
tiles can live with — 2 on a phone, 3–4 at `sm`, 4–5 at `md`, 5–6 at `lg`, 6–7 at `xl` (tiles
roughly 130–185px at each tier's narrowest viewport) — and picks the count whose last row holds
the most tiles, more columns on a tie. A fixed 2/4/6 ladder came first, and at 13 games it left
one game alone on its last row at every width; 13 now lays out 7+6 on a desktop and 5+5+3 on a
laptop or tablet. A phone is only ever 2 across (3 is ~105px tiles), so an odd roster leaves one
tile there, centred. `boardLayout.test.js` fails the registry if a tablet or wider would ever
leave a lone tile, so a new game that does gets a decision rather than a stray tile. This is the
app's only use of `md:` and `xl:`; everything else is `sm:`/`lg:`.

**The board is flex, not grid, because a short last row is centred**, which a grid cannot do.
`HubScreen` puts the per-tier counts in `--cols-*` custom properties, picks the live one with
breakpoint classes, and sizes each tile an exact fraction of the board less 0.1px (so rounding
can never wrap a full row early). The size cap — 11.5rem a tile — is on the BOARD's max-width,
never the tile: a capped tile lets a whole extra one fit on a row and undoes the count. The hub's
Screen is `width="xl"`: `max-w-5xl`, then `max-w-6xl` from `xl` — at 5xl seven across made
the widest screens' tiles the smallest (132px against ~151). The top bar's row follows the same
two widths so its brand stays over the hero's edge.

Capping at 11.5rem also keeps each portrait sharp: AniList's "large" character image is
230×345, and a much wider tile would start to blur it.

**The panel is square, not 4:3, because the art is portraits.** AniList's character images
are 2:3, so a 4:3 panel could only show a slice of face cut off at the chin — players read it
as "too zoomed in". Square shows the top two thirds of the portrait (head and shoulders),
framed at `object-[50%_15%]` so hair is not clipped, and the board still ends well above a
1280×860 laptop's fold.

**A tile is a manga panel holding a character from YOUR list, captioned, over a title bar
in the game's own colour.** `tileCharacters.js` draws seven different characters from the
main profile's imported list each time the menu opens — and again when the main profile
changes — so every player's board is their own and no two visits match. The portrait is
greyscale and `mix-blend-multiply`'d over the `surface-2` panel (seven studios' art reads as
one page of screentone that way), and on hover the game's ink fades in behind it, so its
light tones take the game's colour — the hero's sun-disc trick at tile size.

**Telling seven tiles apart is the title bar's job, and it took two things.** Every title
starts "Ani" and every panel is a greyscale face, so with only a thin colour stripe (which the
caption box then grew over) players could not tell the games apart at a glance. Now the
whole body under the picture is a **solid block of the game's ink with paper type** — the
accent contract's fill-plus-paper pairing — while the art above stays greyscale, so colour
appears exactly where it sorts. And **the title is split** (`tileTitle.js`'s `splitTitle`): a
small, spaced "ANI" over the word that differs, set large — GUESS, TUNE, RANK. The split is
drawn `aria-hidden` with the whole title in an `sr-only` span beside it, so the button is
still named "AniGuess", not "Ani Guess". `tileTitle.test.js` pins that every registered game's
big word is distinct, because the split is worth nothing if two games share one. A game not
yet available keeps a plain surface bar, so colour still means "ready to play". One known
weak pair: AniGuess (vermilion) and AniQuiz (crimson) are both reds; the big word carries
that one.

**The caption is a manga narration box, and it deliberately reads quieter than the title**:
a 1px ink rule and small type — the character's name in display caps over the show's title in
body type (`btn-pop` sets everything in display caps, so that line opts back out). **It hangs
across the panel's bottom edge, half on the picture and half on the title bar,** because
anywhere inside the panel it covered somebody's face — close-up portraits put the chin at the
bottom third. Names wrap and never truncate: the box's foot is pinned
`translate-y-[1.125rem]` into the bar, so a long one grows it upward over the picture's lower
part rather than down into the title. **Every box on the board is the same size** — full tile width, and as
tall as the tallest one needs (`useUniformCaptions.js`: the board measures each box's
natural text height after layout, writes the maximum to `--caption-h`, and re-measures on
resize and once fonts load; boxes in separate grid cells can share no height in CSS). Seven
boxes at seven heights read as clutter. It steps aside while the hover blurb
is up, and is a sibling of the panel (the panel clips with `overflow-hidden`). Since it pushes
into the bar, the bar takes `pt-6` whenever ANY tile on the board has a character
(`captioned`, a board-level answer), so a small list cannot leave one row's titles at two
heights.

Two corner marks were removed for doing nothing: a vermilion hanko seal with one kanji per
game (too small to read at tile size; its seven glyphs left the kana font cut with it) and a
01–07 panel number (decoration that only restated menu order).

**The draw lives in state, never in render.** `HubScreen` holds the board in `useState`
and redraws on exactly two events: returning to the menu (inside `backToMenu`'s wipe, so the
new faces arrive behind the slab) and the main profile object changing, caught with React's
adjust-state-while-rendering check rather than an effect, so a new profile paints with its
own board in the same frame. Deriving it in render would reshuffle every face on a hover.

**Eligibility and identity are the draw's whole job, and both are tested.** Only characters
with an `imageUrl` count — characters hand-entered in ListManager's old form have none — and one person
stands on one tile at most, distinct by `characterNameKey` because the same character is
listed under several seasons with different ids. A list too small to fill the board fills
what it can in board order; **every other tile, and every tile with no profile, is a bare
speed-lines panel** — never a stand-in picture and never a repeated face (that was a decision:
fallback art made a first visit look finished but made a small list look like somebody
else's). A portrait whose URL fails falls back to the bare panel too, remembered by URL so
the next draw's character gets its own chance.

Four things were replaced on the way here: a full block of accent per game (a paint chart,
not a manga page); drawn ink silhouettes in `gameIcons.js` (icon-pack art); public-domain
ukiyo-e crops (right for the page, but not *anime*); and *Pepper&Carrot* character art
(anime, but the same seven pictures for everyone). The descriptor no longer carries an emoji
`icon`; nothing renders one.

**The portraits are the player's own data, not the app's assets** — loaded from AniList's
CDN exactly as every in-game `Avatar` already is, with `referrerPolicy="no-referrer"`, and
only for a player who imported a list. Nothing ships in `public/`, and `credits.js` carries no
entry for them; the Credits dialog says where they come from instead. They load eagerly
(`decoding="async"`, no `loading="lazy"`): the board is the first thing the hub paints and
these are its pictures.

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
tab. It stands on the title screen now (the hub's masthead is the top bar's brand plus the
hero). It is a **wide** plaque and that is not a styling whim: a ball on a stem over a base is
a person, the exact glyph the profile control wears (until a list gives it the player's chosen face), so it needs the buttons beside it to
read as a control panel — and squeezed into a 64px square a ball plus two dots collapse into
a face instead.

**The tile and the game's cover page are one object, opened.** The tapped tile's character
goes into the game through `TileCharacterContext`, and `shared/components/ModePicker.jsx`
repeats the tile's game-ink block and split title at banner size (the accent class map is
`shared/ui/accents.js` and the split is `shared/utils/splitTitle.js`, shared by both so they
cannot drift). Change one, check the other.

## The record: a trophy in the bar

The hub page is the games and nothing else; everything else sits in the top bar's corners. The
main profile's play history (see `.claude/rules/play-history.md`) opens from `RecordButton.jsx`,
an icon-only trophy just left of the profile pill, shown only when there is a main profile. It
replaced a "Your record" card under the board (the record strip), removed because it was page
content that was not a game.

**`RecordScreen.jsx` is the whole record**, a full hub view like ListManager's (`recordOf` in
`HubScreen`, `{ id, from }`): totals, streaks, a card per game in its ink, head-to-head, and
every game, 20 at a time. It opens from the bar's trophy ("Your record") and from a trophy on
every profile-picker row — any profile, because every profile seated at a local game here is
recorded — and its back step returns where it came from ("← Hub" or "← Profiles"). It reads
storage once per mount, which is enough because nothing records while the hub is on screen. Its
log rows are `RecordLine.jsx`. The picker's trophy is a bare glyph like delete's rather than a
block like edit's: a third block squeezed the name to a few letters on a phone. The playtest
fallback denies both ways in.

## Invite links skip the front door

An invite link (`shared/utils/inviteLink.js`) opens its game with no title screen and no
menu: `HubScreen` seeds `titleSeen` and `gameId` from it in their initializers, marks the
title seen for the session, and takes the invite off the address bar. The wipe does not run
for it — there is nothing on screen to wipe from. `backToMenu` drops any invite still
pending. A link to a game this build does not have opens the plain hub.

## The first-visit welcome

`WelcomeModal.jsx` opens over the board when this device has **no profiles at all**: "Bring my
anime list" (the import that makes the profile, `ListImport` with no profile) and "Not
now". Never over an invite — it already knows what the player came for — and once
answered, never again (`welcomeSeen.js`, localStorage, not in `PRESERVED_KEYS`); the one-line hint and the bar's Set profile stay for later visits. The
playtest fixtures seed profiles, so the bots never meet it, and `generic.js` denies its
buttons anyway.

## How to play, and feedback

**A game's rules sheet opens by itself once per game per device, over the cover**
(`howToSeen.js`, one localStorage list of ids, not in `PRESERVED_KEYS`), invite links
included — a friend joining by link is the newest player at the table. `openGame` sets it
inside the wipe, so it is up when the cover appears; closing it any way marks it seen. After
that the top bar's "How to play" (`HowToButton`, passed as the bar's `end` while a game is
open) brings it back on any screen. Both dialogs render outside the view branches, since the
feedback box opens from the menu's footer ("Feedback", beside Credits) and from a sheet's
"Send feedback", which arrives with the game chosen. `renderArcade` marks every game seen
unless passed `{ showHowTo: true }`; the bots close a sheet by "Got it"
(`playtest/core/generic.js`'s `closeRulesSheet`) and never open one.

## Title, hero and wipe

**`TitleScreen` shows once per browser session** (`titleSeen.js`, sessionStorage): right on
a fresh visit, wrong on a refresh mid-game night. Its press is also the user gesture the
sound engine needs, so the hub's first tap is not the one sound nobody hears.

**The hero is height-capped (`h-36 sm:h-44`)** because the hub's height belongs to the board;
it carries the page's one h1, and its print sits multiplied over a CSS sun disc (see Styling
in the root CLAUDE.md for why the red is never in the image).

**`useWipe` is timers, never `animationend`.** It swaps the screen at `SWAP_MS`, while the
slab covers everything, and ignores any press until `WIPE_MS` — two taps on two tiles would
otherwise queue two swaps. `PanelWipe` also catches pointer events for that half-second.
Tests that press again after a wipe must wait for `[data-wipe]` to leave the DOM, which is
what `HubScreen.test.jsx`'s `findTile` / `findHub` do. Reduced motion swaps immediately.

## Games load on demand

Every game's `Component` is `shared/utils/lazyGame.js`'s `lazyGame(() => import(...))`. The
registry used to import all seven eagerly, so the menu could not paint until every game,
Firebase and dnd-kit had arrived: one ~1 MB file (301 KB gzipped) before the first tile.
Startup is now ~360 KB (112 KB gzipped, measured 2026-10-28 with AniChain in). Count the entry
AND every chunk `index.html` preloads: Vite 8.3's Rolldown folds most of them into the entry,
which took the entry alone from 68 KB to 112 KB with the total unchanged. Each game is its own chunk, and Firebase sits in a
shared one that only a game pulls in.

**The tap is not slower, because the hub preloads.** `preloadGames` runs once the menu is up
and the browser is idle (`requestIdleCallback`, or a one-second timer on Safari, which has
none), and `preload()` is memoized, so a tap racing the preload shares its request. It skips
**Data Saver** users, who pay the on-tap load instead — someone who asked their phone to save
data should not download six games they never open.

**`GameLoading` covers a wait, and only a real one.** It renders nothing for its first 200ms:
a load that finishes in a few frames would otherwise flash a whole screen for one paint, and
past that a tap with no visible answer reads as a tap that did not register. It wears the
game's accent, so it reads as the tile opening.

**A download failure is not a crash, and `ErrorBoundary` must not treat it as one.**
`lazyGame` tags it `gameLoad`, and the boundary shows "Couldn't load this game" with Reload
and Back — never Reset, which would clear saved rooms, tier lists and settings to fix a
dropped connection. The failure that will actually happen is a tab left open across a
deploy: chunk filenames are content-hashed, so the old ones are gone, and hosting's
catch-all rewrite answers them with `index.html`. A reload fetches the new names. A phone
with the service worker (root CLAUDE.md, "Offline") is spared this — the previous build's
chunks stay in its cache for the page still running it — but everyone else is not, so the
screen stays. The failed promise is forgotten rather than memoized, so Back and a second tap
genuinely retry.

`HubScreen.test.jsx` preloads every game in `beforeAll`. The first import of a game under
vitest transforms its whole folder, which can outlast `findBy`'s one-second wait on a cold
run; preloading makes each test time the hub rather than the compiler, and the tap still
goes through Suspense.
