// The cabinet screen behind every page. Three stacked layers, all decorative,
// all pointer-events-none, all inside one fixed container so a long page scrolls
// past them rather than dragging them along.
//
// Order matters and is the whole trick: the glow pools sit at the BOTTOM so the
// vignette darkens them at the edges exactly as it darkens the canvas, which is
// what makes them read as light behind the glass instead of as coloured blobs
// painted on top of it. Putting the vignette under the pools leaves bright
// smudges in the corners, which is the one thing a CRT never does.
//
// The pools use the three accents that name a game (pink, blue, amber were
// already the AniGuess/AniTune/AniRank identities), so the backdrop agrees with
// the hub tiles instead of introducing a fourth colour story.
//
// Only the pools animate, and `blob` is disabled under prefers-reduced-motion in
// src/index.css. The vignette and grain are static by design — see the `crt-*`
// utilities for why scanlines and flicker were turned down.
export default function Backdrop() {
  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden">
      <div className="blob bg-pop-pink h-80 w-80 -top-20 -left-16" />
      <div
        className="blob bg-pop-blue h-96 w-96 top-1/3 -right-24"
        style={{ animationDelay: '-8s' }}
      />
      <div
        className="blob bg-pop-amber h-72 w-72 -bottom-20 left-1/4"
        style={{ animationDelay: '-16s' }}
      />

      {/* Darkens the corners so the centre reads as the lit part of the tube. */}
      <div className="crt-vignette absolute inset-0" />

      {/* Fixed rather than absolute: grain that scrolls with the page reads as a
          texture printed on the content, while grain that stays put reads as the
          screen itself. Low opacity because this sits over every word in the app. */}
      <div className="crt-grain fixed inset-0 opacity-[0.035] mix-blend-overlay" />
    </div>
  );
}
