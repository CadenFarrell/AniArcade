import { WRONG_BONUS } from '../rules';
import { Card, Mark } from '../../../shared/ui';

// Who it was, and what that did to the scores. The right/wrong is a Mark (a
// ✓/✗ shape with its word), never colour alone. `who(id)` is the caller's
// naming — "You" online for this device's player, the name otherwise.
export default function RevealCard({ card, result, who, children }) {
  let line;
  if (result?.void === 'left') line = <p className="text-fg-body">{who(result.by)} left — no points this round.</p>;
  else if (result?.void === 'broken') line = <p className="text-fg-body">No portrait left to deal — no points this round.</p>;
  else if (result?.correct) {
    line = (
      <p className="flex flex-wrap items-center justify-center gap-2 text-fg-body">
        <Mark yes label="Right" />
        {/* One flex child for the whole sentence: split across several, the
            row's gap lands before the full stop. */}
        <span>{who(result.by)} named them for <span className="font-bold text-pop-amber">{result.points} points</span>.</span>
      </p>
    );
  } else if (result) {
    line = (
      <p className="flex flex-wrap items-center justify-center gap-2 text-fg-body">
        <Mark yes={false} label="Wrong" />
        <span>
          {result.text ? `${who(result.by)} said “${result.text}”.` : `${who(result.by)} passed.`}
          {' '}Everyone else +{WRONG_BONUS}.
        </span>
      </p>
    );
  }
  return (
    <Card padding="lg" className="text-center">
      {card && result?.void !== 'broken' && (
        <>
          <p className="font-display text-3xl font-bold uppercase leading-tight tracking-wide text-fg-strong [overflow-wrap:anywhere]">
            {card.name}
          </p>
          {card.series && <p className="mb-3 text-fg-helper">{card.series}</p>}
        </>
      )}
      <div className="mb-5">{line}</div>
      {children}
    </Card>
  );
}
