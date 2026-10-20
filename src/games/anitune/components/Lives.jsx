import { Icon } from '../../../shared/ui';

// Last-one-standing's lives, as a row of hearts — or the skull once they are
// gone. It was `'♥'.repeat(n)` in six places, a text heart the display fonts do
// not carry, so it fell back to whatever system font had one and came out a
// different size on every screen. One component, one drawn heart.
//
// The count is the information, so it is labelled once for the whole row
// rather than heart by heart: "3 lives", not "heart, heart, heart".
export default function Lives({ count, className = '' }) {
  const n = Math.max(0, count ?? 0);
  if (n === 0) return <Icon name="skull" label="Out" className={className} />;
  return (
    <span role="img" aria-label={`${n} ${n === 1 ? 'life' : 'lives'}`} className={`inline-flex gap-0.5 ${className}`}>
      {Array.from({ length: n }, (_, i) => <Icon key={i} name="heart" />)}
    </span>
  );
}
