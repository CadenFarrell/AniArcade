import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { playSound } from '../services/sound';
import { inertOutside } from '../utils/inertOutside';

// There were six hand-rolled copies of this overlay, and only three of them
// wired up Escape. Folding the hook in here means every dialog gets keyboard
// dismissal for free — and the ones that must not be dismissed (the turn-over
// acknowledgement, the resume prompt) opt out with dismissible={false}.

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export default function Modal({
  onClose,
  dismissible = true,
  // Separate from `dismissible` because some dialogs have a destructive
  // dismiss — discarding an unfinished game, say. Escape is deliberate enough
  // to allow; a stray click on the backdrop is not.
  closeOnBackdrop = true,
  width = 'md',
  bare = false, // skip the panel chrome — for full-bleed announcement screens
  // The sound it opens with. null for a dialog that announces something with a
  // sound of its own (AniGuess's "Not quite!" plays `wrong`), so the two do
  // not land on top of each other.
  sound = 'open',
  className = '',
  children,
}) {
  const canDismiss = dismissible && typeof onClose === 'function';
  useEscapeKey(canDismiss, onClose);

  // A dialog opening is an event the player should hear. Once per mount; a
  // dialog that opened without any gesture (a resume prompt on load) is simply
  // silent, because the sound engine will not start outside one.
  useEffect(() => {
    if (sound) playSound(sound);
    // Once per mount, whatever the prop does afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The page behind is out of reach while the dialog is open: inert for
  // keyboards, screen readers and the playtest bots, as the scrim already made
  // it for pointers (shared/utils/inertOutside.js says why it was not before).
  //
  // Focus goes with it. Making the background inert drops focus from the
  // button that opened the dialog, so the panel takes it, unless something in
  // the dialog already has it (an autoFocus field). Children's autoFocus runs
  // before this parent's layout effect, so the check sees it. On close, focus
  // goes back to that button, if it is still on the page and live. The opener
  // is read in the first RENDER, before any autoFocus inside has moved focus.
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const [opener] = useState(() => (typeof document === 'undefined' ? null : document.activeElement));
  useLayoutEffect(() => {
    const undo = inertOutside(rootRef.current);
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    return () => {
      // Un-inert first: an inert element refuses focus.
      undo();
      if (opener && opener !== document.body && opener.isConnected && !opener.closest('[inert]')) {
        opener.focus?.({ preventScroll: true });
      }
    };
  }, [opener]);

  return (
    <div
      ref={rootRef}
      // backdrop-blur as well as the scrim: an ink scrim over a busy page
      // leaves the page's own ink lines showing through as noise behind the
      // panel. Blurring them is what makes the dialog read as IN FRONT.
      //
      // Centred by the panel's `m-auto`, NOT by items-center/justify-center:
      // a flex-centred child taller than its scrolling parent overflows above
      // the top too, where no scroll can reach — a tall dialog on a phone
      // opened mid-way down with its heading cut off. An auto margin centres
      // when there is room and collapses to 0 when there is not.
      className="fixed inset-0 z-50 flex bg-scrim backdrop-blur-sm px-4 py-8 overflow-y-auto"
      onClick={canDismiss && closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={panelRef}
        // Focusable only from code (the open above), never a Tab stop, and
        // with no ring: it is the panel, not a control.
        tabIndex={-1}
        // Without this the backdrop's onClick fires for every click inside.
        onClick={(e) => e.stopPropagation()}
        // A heavier rule and a deeper shadow than a plain card-pop: a dialog is
        // the one panel that has to look like it is lifted off the page.
        className={`m-auto w-full outline-none ${WIDTHS[width]}
          ${bare ? '' : 'card-pop border-[3px] p-6 shadow-[0_8px_0_0_var(--color-ink)] sm:p-8'} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
