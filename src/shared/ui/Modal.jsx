import { useEscapeKey } from '../hooks/useEscapeKey';

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
  className = '',
  children,
}) {
  const canDismiss = dismissible && typeof onClose === 'function';
  useEscapeKey(canDismiss, onClose);

  return (
    <div
      // backdrop-blur as well as the scrim: the panel is a dark card on a dark
      // backdrop over a near-black canvas, so dimming alone leaves three nearly
      // identical greys stacked up and the dialog stops reading as in front of
      // anything. Blurring what is behind it is what restores the depth the
      // luminance no longer supplies.
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim-strong backdrop-blur-sm px-4 py-8 overflow-y-auto"
      onClick={canDismiss && closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        // Without this the backdrop's onClick fires for every click inside.
        onClick={(e) => e.stopPropagation()}
        // The panel takes a brighter edge than a plain card-pop. A dialog is the
        // one surface that has to look like it is in front of everything else,
        // and border-line-strong reads as flush against a blurred backdrop.
        className={`w-full ${WIDTHS[width]}
          ${bare ? '' : 'card-pop border-line-loud p-6 sm:p-8'} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
