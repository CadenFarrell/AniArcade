// Inline notice box. Covers the room-connection error, the "every player needs
// a character" warnings, and the online last-outcome banner — three shapes that
// were each spelled out separately with their own tinted-background classes.
//
// A paper slip with an ink rule and a thick stripe down its left edge in the
// tone's ink. The stripe carries the meaning and the slip stays paper: a full
// tinted box under body text is a second background colour to read through,
// and on this page every tint lands close enough to the paper to look like a
// printing smudge rather than a signal.
//
// The tone's mark is drawn here, once, so no call site prefixes its own "⚠️"
// any more — the stripe says "this is a warning" in colour, the mark says it in
// shape, and a warning that reads the same in greyscale is the point of both.

import Icon from './Icon';

const TONES = {
  info: 'border-l-ink',
  success: 'border-l-pop-lime',
  warning: 'border-l-pop-amber',
  danger: 'border-l-pop-red',
};

const MARKS = {
  success: { name: 'check', className: 'text-pop-lime' },
  warning: { name: 'warning', className: 'text-pop-amber' },
  danger: { name: 'warning', className: 'text-pop-red' },
};

export default function Banner({
  tone = 'info',
  onDismiss,
  className = '',
  children,
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-pop-sm border-2 border-l-8 border-ink bg-surface
        px-4 py-3 text-fg-strong ${TONES[tone]} ${className}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      {MARKS[tone] && <Icon name={MARKS[tone].name} className={`mt-0.5 text-lg ${MARKS[tone].className}`} />}
      <div className="flex-1 text-base">{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="focus-pop -my-1 -mr-1 grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm font-black text-fg-body hover:text-fg-strong"
        >
          <Icon name="cross" className="text-sm" />
        </button>
      )}
    </div>
  );
}
