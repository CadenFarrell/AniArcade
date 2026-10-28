import Kana from './Kana';

// A screen's title, set like a manga title: heavy condensed caps in ink, with a
// brush-cut stroke of the game's ink across the foot of the letters. It replaced
// a tilted sticker block (a coloured fill with the title knocked out of it),
// which on paper read as a label stuck on the page rather than as type printed
// on it.
//
// Same props as the sticker had, so all seventy-odd call sites restyled without
// an edit. `tone` now picks the stroke's colour rather than a fill; `tilt` is
// still accepted and ignored — a rotated title on a ruled page reads as a
// mistake, and the stroke's own cut angle carries the energy instead.
const TONES = {
  pink: '[--slash:var(--color-pop-pink)]',
  purple: '[--slash:var(--color-pop-purple)]',
  lime: '[--slash:var(--color-pop-lime)]',
  amber: '[--slash:var(--color-pop-amber)]',
  blue: '[--slash:var(--color-pop-blue)]',
  teal: '[--slash:var(--color-pop-teal)]',
  red: '[--slash:var(--color-pop-red)]',
  plum: '[--slash:var(--color-pop-plum)]',
  slate: '[--slash:var(--color-pop-slate)]',
  moss: '[--slash:var(--color-pop-moss)]',
};

const SIZES = {
  sm: 'text-3xl sm:text-4xl',
  md: 'text-4xl sm:text-5xl',
  lg: 'text-5xl sm:text-7xl',
};

export default function Wordmark({
  tone = 'pink',
  size = 'lg',
  subtitle,
  kana, // optional decorative katakana above the title — see kanaText.js
  level = 1, // heading level — a screen nested under another title wants 2
  className = '',
  children,
}) {
  const Heading = level === 1 ? 'h1' : 'h2';

  return (
    <div className={`text-center ${className}`}>
      {kana && <Kana className="mb-1 block text-sm text-pop-pink">{kana}</Kana>}
      <Heading
        className={`relative isolate inline-block px-1 font-display font-bold uppercase leading-none
          tracking-tight text-fg-strong ${SIZES[size]}`}
      >
        {/* Behind the letters (-z-10 inside the heading's own stacking context,
            which `isolate` creates so it can never slip under the page), and
            low enough that it crosses only their feet: the title has to stay
            ink-on-paper to read, with the colour as an accent under it. */}
        <span
          aria-hidden="true"
          className={`slash absolute -inset-x-2 bottom-[0.02em] -z-10 h-[0.26em] ${TONES[tone] ?? TONES.pink}`}
        />
        {children}
      </Heading>
      {subtitle && (
        <p className="mt-4 text-lg text-fg-body">{subtitle}</p>
      )}
    </div>
  );
}
