import { useCoverGame } from '../context/coverGameContext';
import { ART } from './credits';
import { accentVar } from './accents';
import Kana from './Kana';
import { KANA } from './kanaText';

// The page behind every screen: a printed sheet. All layers decorative, all
// pointer-events-none, all inside one fixed container so a long page scrolls
// past them rather than dragging them along.
//
// It replaced a CRT (glow pools under a vignette and grain), and kept that
// version's one hard rule: NOTHING HERE MOVES. A full-screen animated layer is a
// permanent compositing cost on every screen in the app, so every layer is a
// static print texture — see the print-texture utilities in index.css.
//
// The sheet is a COVER: a speed-line burst from the corner, a screentone brush
// slash and a name in kana set down the edge like a manga cover's, all in one
// ink. It used to be faint registration crosses (plus-grid, now only AniTurf's
// board cells), which read as a blank page of plus signs between the hub's
// print and each game's banner.
//
// Whose cover is decided here, so no screen has to: an explicit `game` (a
// registry descriptor, or anything with `accent` and `kana`) wins; otherwise
// the game the hub has open (CoverGameContext, which reaches every screen of a
// game, in-round included); otherwise the arcade's own — the brand vermilion
// and アニアーケード, on the hub's screens and on a component mounted alone in a
// test. The menus still pass `game` so they are right even mounted alone.
//
// `art` is one of shared/ui/credits.js's ART keys, for the few screens that
// carry a print (the hub). It is multiplied into the paper and knocked right
// back, so it reads as an image printed faintly on the sheet rather than as a
// photo behind the content — content here is ink on paper and has to stay
// readable over it.
const ARCADE = { accent: 'pink', kana: KANA.arcade };

export default function Backdrop({ art = null, game = null }) {
  const open = useCoverGame();
  const cover = game ?? open ?? ARCADE;
  const print = art ? ART[art] : null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden bg-canvas"
      style={{ '--game-ink': accentVar(cover.accent) }}
    >
      {print && (
        <img
          src={print.src}
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-[0.07] mix-blend-multiply"
        />
      )}
      <CoverLayers kana={cover.kana} />
      <div className="paper-grain absolute inset-0 opacity-[0.22]" />
    </div>
  );
}

// Every layer takes the game's ink from `--game-ink`, set on the root above.
function CoverLayers({ kana }) {
  return (
    <>
      {/* Speed lines bursting from the top-left corner (index.css). */}
      <div className="speed-burst absolute inset-0 opacity-[0.16] [--lines:var(--game-ink)]" />
      {/* The brush slash: a band of screentone cut to the slash's parallelogram,
          with a solid stroke under its edge — the red-under-a-title stroke from
          the hub, in the game's ink. Both fade out to the right the way a dry
          brush runs out; at full length the band's hard top edge read as a
          misprint. Rotating it is fine: the no-transform rule is about Screen,
          and this is a leaf of a fixed layer. */}
      <div
        className="absolute bottom-[10dvh] -left-[8vw] w-[85vw] max-w-[60rem] -rotate-6
          [mask-image:linear-gradient(to_right,#000_25%,transparent_95%)]"
      >
        <div
          className="halftone h-[16dvh] opacity-[0.35] [--tone:var(--game-ink)] [--tone-size:6px]
            [clip-path:polygon(5%_0,100%_0,95%_100%,0_100%)]"
        />
        <div className="slash mt-2 h-3 w-[75%] opacity-[0.3] [--slash:var(--game-ink)]" />
      </div>
      {/* Ink screentone in the one corner the cover leaves empty. */}
      <div
        className="halftone absolute -right-10 -bottom-10 h-72 w-72 opacity-[0.12] [--tone-size:9px]
          [mask-image:radial-gradient(circle_at_bottom_right,#000_0%,transparent_70%)]"
      />
      {/* The name down the right edge, the way a manga cover runs its title,
          faint enough that the column's text reads over it where they overlap.
          Sized by its own LENGTH as well as the viewport: a fixed 12dvh fitted
          the six-glyph game names, but アニアーケード (seven) ran past the
          bottom of a laptop screen and vertical text wraps a new column rather
          than overflowing — a stray ド beside the rest. Each glyph takes about
          1.12em with Kana's tracking; 5rem is the top bar plus a margin, and
          nowrap means a miscount clips instead of wrapping.
          Hidden under forced colours, which would repaint it solid CanvasText. */}
      {kana && (
        <div
          className="absolute top-16 right-[2vw] leading-none whitespace-nowrap text-[var(--game-ink)]
            opacity-[0.09] forced-colors:hidden"
          style={{ fontSize: `min(22vw, 12dvh, calc((100dvh - 5rem) / ${[...kana].length * 1.15}))` }}
        >
          <Kana vertical>{kana}</Kana>
        </div>
      )}
    </>
  );
}
