// Small status pill — "4 chars", "No chars", "SOON", "(you)".
// Same semantic colour map as Button, at label scale: solid ink with paper type
// for the toned ones, an outlined paper label for neutral.
//
// Never lit, never shadowed: there can be six in a row, and emphasis repeated
// six times stops reading as emphasis.

const TONES = {
  neutral: 'bg-surface text-fg-strong border-ink',
  pink: 'bg-pop-pink text-paper border-pop-pink',
  purple: 'bg-pop-purple text-paper border-pop-purple',
  lime: 'bg-pop-lime text-paper border-pop-lime',
  red: 'bg-pop-red text-paper border-pop-red',
  amber: 'bg-pop-amber text-paper border-pop-amber',
  blue: 'bg-pop-blue text-paper border-pop-blue',
  teal: 'bg-pop-teal text-paper border-pop-teal',
  plum: 'bg-pop-plum text-paper border-pop-plum',
  slate: 'bg-pop-slate text-paper border-pop-slate',
  moss: 'bg-pop-moss text-paper border-pop-moss',
  umber: 'bg-pop-umber text-paper border-pop-umber',
  'team-red': 'bg-team-red text-paper border-team-red',
  'team-blue': 'bg-team-blue text-paper border-team-blue',
};

export default function Badge({ tone = 'neutral', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-pop-sm border-2 px-2 py-0.5
        font-display text-xs font-bold uppercase tracking-wider ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
