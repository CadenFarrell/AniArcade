import { useId } from 'react';
import { useCoverGame } from '../context/coverGameContext';
import { useDialogLayer } from '../hooks/useDialogLayer';
import { accentBg } from './accents';
import Backdrop from './Backdrop';
import Button from './Button';
import Kana from './Kana';
import { KANA } from './kanaText';

// The "are you sure?" for LEAVING a game — the Hub button mid-round, a room's
// Leave, AniTune's Back to setup. It replaced window.confirm, the browser's own
// grey OK/Cancel box: pasted-in chrome that said "OK" rather than what happens,
// and on a phone held every other device's room updates while it was open (the
// reason FinalChances.jsx never used one).
//
// A full sheet rather than a dialog on purpose: leaving is the one question that
// stops the game, so it reads as the game PAUSED — the open game's cover
// (Backdrop picks it up from CoverGameContext) and a slab in its ink, cut on the
// diagonal like ModePicker's cover, so it is plainly still that game's screen.
// It covers the top bar too (z-50 over the bar's z-40): with the Hub button
// still showing, a second press of it would be a question about the question.
// Smaller confirms — a delete, a host's abandon — are ConfirmDialog instead.
//
// "Keep playing" comes first and takes focus: the safe answer is the one a
// stray Enter or a second tap lands on. Escape is the same answer.
//
// Render it in the game's tree, never inside a top-bar portal: TopBar has
// backdrop-blur, which makes it the containing block for `fixed` descendants,
// and this sheet would shrink to the bar's 56px. (HubButton renders it beside
// its portal for that reason.) No transform anywhere here, for the same rule.
export default function PauseScreen({
  title,
  message = null,
  stayLabel = 'Keep playing',
  leaveLabel,
  onStay,
  onLeave,
}) {
  const game = useCoverGame();
  const ink = accentBg(game?.accent);
  const { rootRef, panelRef } = useDialogLayer({ onEscape: onStay });
  const titleId = useId();

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex overflow-y-auto bg-canvas px-5 py-8"
    >
      {/* Fixed at -z-10 inside this sheet's own stacking context, so it paints
          over the sheet's paper and under its column — the page behind stays
          hidden and the cover shows. */}
      <Backdrop />
      <div ref={panelRef} tabIndex={-1} className="m-auto w-full max-w-md outline-none">
        {/* The border and shadow are on the frame, not the slab: a clip-path
            cuts off whatever it does not keep, a border's diagonal edge and the
            hard shadow included. The strip the cut leaves is ModePicker's bare
            panel — speed lines over the frame's paper. */}
        <section className="relative isolate overflow-hidden border-2 border-ink bg-surface-2 shadow-pop">
          <div aria-hidden="true" className="speed-lines absolute inset-0 opacity-25" />
          <div
            className={`relative py-6 pr-14 pl-5 text-paper sm:pl-7
              [clip-path:polygon(0_0,100%_0,86%_100%,0_100%)] ${ink}`}
          >
            <Kana className="mb-1 block text-sm">{KANA.pause}</Kana>
            <h2 id={titleId} className="font-display text-4xl font-bold uppercase leading-none tracking-wide sm:text-5xl">
              {title}
            </h2>
          </div>
        </section>
        {message && <p className="mt-5 text-base leading-snug text-fg-body">{message}</p>}
        <div className="mt-6 flex flex-col gap-3">
          {/* The button's own `tap` stays off: staying is a step back into the
              game, which is GhostButton's `back`, and leaving's sound is the
              caller's (HubButton plays `back` as it always did). */}
          <Button size="lg" fullWidth autoFocus sound="back" onClick={onStay}>
            {stayLabel}
          </Button>
          <Button variant="danger" size="lg" fullWidth sound={null} onClick={onLeave}>
            {leaveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
