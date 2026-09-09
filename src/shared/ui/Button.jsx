// The chunky press-down block that every action in the app is built from.
// The physics (border, hard shadow, lift on hover, sink on press) live in the
// `btn-pop` utility in src/index.css; this file only picks colour and size.
//
// Solid variants all use ink-coloured text rather than white. That is both the
// neo-brutalist look and the accessible choice — white on pop-pink is only
// 3.1:1, while ink on pop-pink is 6.4:1 and passes AA at any size.

// Bright fills take an ink border; the dark `neutral` fill takes a light one,
// because ink-on-canvas has no edge to show.
//
// Each variant also sets `--glow`, the halo colour `btn-pop` paints behind the
// hard shadow. It is set HERE rather than in the utility because only the call
// site knows the fill, and a halo in a different colour from the block reads as
// a rendering fault rather than as light. Keep it identical to the `bg-` token.
//
// `neutral` deliberately sets none. It is the unlit control — a dark block on a
// dark ground — and giving it a white halo would make the lowest-emphasis
// button in the app glow as brightly as the primary action.
const VARIANTS = {
  primary: 'bg-pop-pink text-ink border-ink [--glow:var(--color-pop-pink)]',
  secondary: 'bg-pop-purple text-ink border-ink [--glow:var(--color-pop-purple)]',
  success: 'bg-pop-lime text-ink border-ink [--glow:var(--color-pop-lime)]',
  danger: 'bg-pop-red text-ink border-ink [--glow:var(--color-pop-red)]',
  warning: 'bg-pop-amber text-ink border-ink [--glow:var(--color-pop-amber)]',
  info: 'bg-pop-blue text-ink border-ink [--glow:var(--color-pop-blue)]',
  neutral: 'bg-surface-2 text-white border-line-strong',
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
  className = '',
  disabled = false,
  children,
  ...rest
}) {
  // Disabled blocks keep the border and shadow so the layout never shifts;
  // they just go flat and grey, and `btn-pop` already suppresses the motion.
  const tone = disabled
    ? 'bg-surface-2 text-fg-disabled border-line'
    : VARIANTS[variant];

  return (
    <button
      disabled={disabled}
      className={`btn-pop focus-pop ${tone} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// Bare text button for low-emphasis navigation ("← Back"). No block, no
// shadow — using a full pop block for these would flatten the visual hierarchy.
export function GhostButton({ className = '', children, ...rest }) {
  return (
    <button
      className={`focus-pop rounded-pop-sm px-2 py-1 font-display font-bold text-fg-body
        transition-colors hover:text-white ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
