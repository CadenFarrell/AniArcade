import { ICONS, VIEWBOX } from './icons';

// One icon from the ink set in icons.js, sized to the text around it (1.1em,
// nudged onto the baseline), so `<Icon name="lock" /> Locked` lines up without
// anyone picking a pixel size. To make one bigger, give it (or its parent) a
// text size — `text-3xl` — never `h-8 w-8`: those lose to the built-in 1.1em in
// the stylesheet's order and the icon silently stays text-sized.
// icons.test.js fails on an Icon className carrying h-/w- sizes.
//
// Decorative unless given a `label`. Most icons sit beside words that already
// say the same thing, and a screen reader announcing "check, Yes" is noise; one
// that IS the information (an icon-only status, a lives count) passes `label`
// and becomes role="img" with that name.
export default function Icon({ name, label, className = '' }) {
  const shapes = ICONS[name];
  if (!shapes) return null;
  return (
    <svg
      viewBox={VIEWBOX}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' })}
      className={`inline-block h-[1.1em] w-[1.1em] shrink-0 align-[-0.18em] ${className}`}
    >
      {shapes.map(({ tag, paint, w, ...attrs }, i) => {
        const Tag = tag;
        return (
          <Tag
            key={i}
            {...attrs}
            {...(paint === 'stroke'
              ? { className: 'fill-none stroke-current', strokeWidth: w ?? 2.25, strokeLinecap: 'round', strokeLinejoin: 'round' }
              : { className: 'fill-current' })}
          />
        );
      })}
    </svg>
  );
}

// A finishing place: 1–3 as a numbered medal in the score colour, 4+ as plain
// "#4". It replaced getPositionEmoji's 🥇🥈🥉, which also hid the number from
// anything that could not see the colour of the medal — the digit is text here.
const MEDALS = {
  1: 'bg-pop-amber text-paper border-ink',
  2: 'bg-surface-2 text-fg-strong border-ink',
  3: 'bg-pop-amber/45 text-ink border-ink',
};

export function PlaceMark({ place, className = '' }) {
  const medal = MEDALS[place];
  if (!medal) return <span className={`font-display font-bold text-fg-helper ${className}`}>#{place}</span>;
  return (
    <span
      role="img"
      aria-label={`${place}${['', 'st', 'nd', 'rd'][place]} place`}
      className={`inline-grid h-[1.6em] w-[1.6em] shrink-0 place-items-center rounded-full border-2 align-middle
        font-display text-[0.8em] font-bold leading-none ${medal} ${className}`}
    >
      {place}
    </span>
  );
}
