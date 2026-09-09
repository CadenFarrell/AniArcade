// Replaces the gradient-clipped <h1> that was copy-pasted into the hub, the
// AniGuess entry screen and PlayerSetup. Now a tilted sticker block — the same
// border + hard-shadow language as every button, at title scale.

// Each tone sets `--glow` alongside its fill, which `sticker` paints as a halo
// behind the hard shadow. This is the marquee — the single element on a screen
// that is allowed to be the brightest thing on it — so it carries the widest
// glow in the app. Badges deliberately do NOT get one: there can be six of them
// in a row, and a lit label repeated six times stops reading as emphasis.
const TONES = {
  pink: 'bg-pop-pink text-ink [--glow:var(--color-pop-pink)]',
  purple: 'bg-pop-purple text-ink [--glow:var(--color-pop-purple)]',
  lime: 'bg-pop-lime text-ink [--glow:var(--color-pop-lime)]',
  amber: 'bg-pop-amber text-ink [--glow:var(--color-pop-amber)]',
  blue: 'bg-pop-blue text-ink [--glow:var(--color-pop-blue)]',
  teal: 'bg-pop-teal text-ink [--glow:var(--color-pop-teal)]',
};

const SIZES = {
  sm: 'px-5 py-2 text-2xl sm:text-3xl',
  md: 'px-6 py-3 text-3xl sm:text-4xl',
  lg: 'px-7 py-4 text-4xl sm:text-6xl',
};

export default function Wordmark({
  tone = 'pink',
  size = 'lg',
  tilt = -2,
  subtitle,
  level = 1, // heading level — a screen nested under another title wants 2
  className = '',
  children,
}) {
  // Inline rotation rather than a utility so sibling stickers can be tilted
  // opposite ways without minting a class for each angle.
  const headingProps = {
    style: { transform: `rotate(${tilt}deg)` },
    className: `sticker inline-block ${TONES[tone]} ${SIZES[size]}`,
    children,
  };

  return (
    <div className={`text-center ${className}`}>
      {level === 1 ? <h1 {...headingProps} /> : <h2 {...headingProps} />}
      {subtitle && (
        <p className="mt-5 text-lg text-fg-body">{subtitle}</p>
      )}
    </div>
  );
}
