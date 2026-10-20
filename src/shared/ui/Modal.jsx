import { useEffect } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { playSound } from '../services/sound';

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

  return (
    <div
      // backdrop-blur as well as the scrim: an ink scrim over a busy page
      // leaves the page's own ink lines showing through as noise behind the
      // panel. Blurring them is what makes the dialog read as IN FRONT.
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim backdrop-blur-sm px-4 py-8 overflow-y-auto"
      onClick={canDismiss && closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        // Without this the backdrop's onClick fires for every click inside.
        onClick={(e) => e.stopPropagation()}
        // A heavier rule and a deeper shadow than a plain card-pop: a dialog is
        // the one panel that has to look like it is lifted off the page.
        className={`w-full ${WIDTHS[width]}
          ${bare ? '' : 'card-pop border-[3px] p-6 shadow-[0_8px_0_0_var(--color-ink)] sm:p-8'} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
