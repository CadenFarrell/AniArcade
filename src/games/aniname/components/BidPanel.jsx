import { useState } from 'react';
import { MAX_BID, MIN_BID, madePoints, missPoints } from '../rules';
import { Button, Card, NumberInput } from '../../../shared/ui';

// One player's turn in the auction: raise, or drop out. The opener cannot drop
// out before anyone has bid — somebody has to set the first number — so their
// Drop out is disabled with the reason beside it. What the bid is worth either
// way is printed under it, because "seven" is the choice and the points are why
// it matters.
//
// Keyed by the caller per turn, so the stepper never carries a value over from
// the last bidder. Words the bots press: the "Count" stepper, "Bid N", "Drop out".
export default function BidPanel({ heading, bid, onBid, onPass }) {
  const floor = Math.max(MIN_BID, (bid?.n ?? 0) + 1);
  const [n, setN] = useState(() => Math.min(MAX_BID, bid ? floor : 3));
  const valid = Number.isInteger(n) && n >= floor && n <= MAX_BID;

  return (
    <Card padding="lg">
      <p className="mb-1 text-center font-display text-xl font-extrabold text-fg-strong">{heading}</p>
      <p className="mb-4 text-center text-sm text-fg-helper">
        {bid ? `Raise above ${bid.n}, or drop out.` : `You open — bid anything from ${MIN_BID} to ${MAX_BID}.`}
      </p>
      <NumberInput id="aniname-bid" ariaLabel="Count" min={floor} max={MAX_BID} value={n} onChange={setN} className="mb-2" />
      <p className="mb-4 text-center text-sm text-fg-body">
        {valid ? (
          <>
            Name {n}: <span className="font-bold text-pop-amber">+{madePoints(n)}</span>. Fall short: everyone else{' '}
            <span className="font-bold text-pop-amber">+{missPoints(n)}</span>.
          </>
        ) : `Bid ${floor}–${MAX_BID}.`}
      </p>
      <div className="flex gap-3">
        <Button variant="neutral" size="lg" disabled={!bid} onClick={onPass}>
          Drop out
        </Button>
        <Button variant="primary" size="lg" fullWidth disabled={!valid} onClick={() => onBid(n)}>
          {valid ? `Bid ${n}` : 'Bid'}
        </Button>
      </div>
      {!bid && <p className="mt-2 text-center text-xs text-fg-subtle">The opener can&apos;t drop out.</p>}
    </Card>
  );
}
