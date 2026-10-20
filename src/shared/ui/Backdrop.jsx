import { ART } from './credits';

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
export default function Backdrop({ art = null }) {
  const print = art ? ART[art] : null;

  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden bg-canvas">
      {print && (
        <img
          src={print.src}
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-[0.07] mix-blend-multiply"
        />
      )}
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
      <div className="paper-grain absolute inset-0 opacity-[0.22]" />
    </div>
  );
}
