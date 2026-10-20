import { playSound } from '../services/sound';

// The chunky press-down block that every action in the app is built from.
// The physics (border, hard shadow, lift on hover, sink on press) live in the
// `btn-pop` utility in src/index.css; this file only picks colour and size.
//
// The variants follow the references' two-button pattern: the main action is a
// SOLID INK block with paper text (ORDER NOW), the alternative beside it is the
// same block in outline (CONTACT US). That is also why `primary` is ink rather
// than the vermilion `pink` it used to be — a page where every main action is
// red has no red left for the one thing that should stand out. The semantic
// variants keep their inks, each with paper text, which index.css measures as
// a pair (see the accent contract there).
const VARIANTS = {
  primary: 'bg-ink text-paper border-ink',
  secondary: 'bg-surface text-fg-strong border-ink hover:bg-surface-2',
  success: 'bg-pop-lime text-paper border-ink',
  danger: 'bg-pop-red text-paper border-ink',
  warning: 'bg-pop-amber text-paper border-ink',
  info: 'bg-pop-blue text-paper border-ink',
  neutral: 'bg-surface-2 text-fg-strong border-ink',
};

const SIZES = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-3 text-base',
  lg: 'px-6 py-4 text-lg',
  xl: 'px-6 py-5 text-2xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  // Which UI sound the press makes — a name from services/sound.js, or null for
  // none. Most buttons just tap; a caller that plays its own sound (the hub's
  // launch) passes null so a press is never two sounds at once.
  sound = 'tap',
  className = '',
  disabled = false,
  onClick,
  children,
  ...rest
}) {
  // Disabled blocks keep the border and shadow so the layout never shifts;
  // they just go flat and grey, and `btn-pop` already suppresses the motion.
  const tone = disabled
    ? 'bg-surface-2 text-fg-disabled border-line-strong'
    : VARIANTS[variant];

  const handleClick = (e) => {
    if (sound) playSound(sound);
    onClick?.(e);
  };

  return (
    <button
      disabled={disabled}
      onClick={handleClick}
      className={`btn-pop focus-pop uppercase ${tone} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// Bare text button for low-emphasis navigation ("← Back"). No block, no
// shadow — using a full pop block for these would flatten the visual hierarchy.
// An ink underline on hover is the print equivalent of a link.
// `fullWidth` is taken here rather than left in `rest`, where it reached the
// <button> as an unknown DOM attribute (React's console error, which the
// playtest bots fail a run on) — PsychicView passes it, as it would to Button.
export function GhostButton({ className = '', fullWidth = false, onClick, children, ...rest }) {
  const handleClick = (e) => {
    playSound('back');
    onClick?.(e);
  };

  return (
    <button
      onClick={handleClick}
      className={`focus-pop rounded-pop-sm px-2 py-1 font-display font-bold uppercase tracking-wide
        text-fg-body decoration-2 underline-offset-4 transition-colors hover:text-fg-strong
        hover:underline ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
