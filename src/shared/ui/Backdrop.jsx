import { ART } from './credits';
import { accentVar } from './accents';
import Kana from './Kana';

// The page behind every screen: a printed sheet. All layers decorative, all
// pointer-events-none, all inside one fixed container so a long page scrolls
// past them rather than dragging them along.
//
// It replaced a CRT (glow pools under a vignette and grain), and kept that
// version's one hard rule: NOTHING HERE MOVES. A full-screen animated layer is a
// permanent compositing cost on every screen in the app, so the texture is
// paper fibre, registration crosses and a corner of screentone, all static —
// see the print-texture utilities in index.css.
//
// `art` is one of shared/ui/credits.js's ART keys, for the few screens that
// carry a print (the hub). It is multiplied into the paper and knocked right
// back, so it reads as an image printed faintly on the sheet rather than as a
// photo behind the content — content here is ink on paper and has to stay
// readable over it.
//
// `game` (a registry descriptor) turns the sheet into that game's cover, and
// only the MENUS pass it: the cover page (ModePicker), every setup screen and
// lobby (SetupLayout) and Play Online (RoomSetup). On those, a page of faint
// crosses read as blank between the hub's print and the game's own banner, so
// the crosses give way to the game's ink — a speed-line burst, a screentone
// brush slash and its kana name set down the edge like a manga cover's.
// In-round screens never pass it: a board, a timer and a row of faces are busy
// enough, and the quiet sheet is what keeps them readable.
export default function Backdrop({ art = null, game = null }) {
  const print = art ? ART[art] : null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden bg-canvas"
      style={game ? { '--game-ink': accentVar(game.accent) } : undefined}
    >
      {print && (
        <img
          src={print.src}
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-[0.07] mix-blend-multiply"
        />
      )}
      {game ? <CoverLayers kana={game.kana} /> : <SheetLayers />}
      <div className="paper-grain absolute inset-0 opacity-[0.22]" />
    </div>
  );
}

function SheetLayers() {
  return (
    <>
      <div className="plus-grid absolute inset-0 opacity-[0.16]" />
      {/* Screentone in two opposite corners, fading out — the way a manga page
          shades an empty panel corner rather than tinting the whole thing. */}
      <div
        className="halftone absolute -top-10 -right-10 h-72 w-72 opacity-[0.14]
          [mask-image:radial-gradient(circle_at_top_right,#000_0%,transparent_70%)]"
      />
      <div
        className="halftone absolute -bottom-10 -left-10 h-80 w-80 opacity-[0.12] [--tone-size:9px]
          [mask-image:radial-gradient(circle_at_bottom_left,#000_0%,transparent_70%)]"
      />
    </>
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
      {/* The game's name down the right edge, the way a manga cover runs its
          title. Sized to the viewport so the longest names (six glyphs:
          アニフェイク, アニチューン) fit under the top bar on a phone, and faint
          enough that the column's text reads over it where they overlap.
          Hidden under forced colours, which would repaint it solid CanvasText. */}
      {kana && (
        <Kana
          vertical
          className="absolute top-16 right-[2vw] text-[min(22vw,12dvh)] leading-none text-[var(--game-ink)]
            opacity-[0.09] forced-colors:hidden"
        >
          {kana}
        </Kana>
      )}
    </>
  );
}
