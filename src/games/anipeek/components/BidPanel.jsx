import { useState } from 'react';
import { MAX_BID, MIN_BID, pointsFor } from '../rules';
import { Button, Card, NumberInput } from '../../../shared/ui';

// Where a value sits before the bidder touches it: one under the bid to beat,
// or the middle of the range for an opener. Never a number they cannot bid.
const startingBid = (bid) => (bid ? Math.max(MIN_BID, bid.n - 1) : 8);

// One player's turn to bid: lower than the bid on the table, or pass. The
// opener cannot pass — somebody has to set the first price — so their Pass is
// disabled with the reason beside it. What the number is WORTH is printed under
// it, because "six tiles" is the choice and "ten points" is why it matters.
//
// Keyed by the caller per turn, so the stepper never carries a value over from
// the last bidder.
export default function BidPanel({ heading, bid, onBid, onPass }) {
  const ceiling = bid ? bid.n - 1 : MAX_BID;
  const [n, setN] = useState(() => Math.min(ceiling, startingBid(bid)));
  const valid = Number.isInteger(n) && n >= MIN_BID && n <= ceiling;

  return (
    <Card padding="lg">
      <p className="mb-1 text-center font-display text-xl font-extrabold text-fg-strong">{heading}</p>
      <p className="mb-4 text-center text-sm text-fg-helper">
        {bid
          ? `Go lower than ${bid.n}, or pass.`
          : `You open — bid anything from ${MIN_BID} to ${MAX_BID} tiles.`}
      </p>
      <NumberInput
        id="anipeek-bid"
        ariaLabel="Tiles"
        min={MIN_BID}
        max={ceiling}
        value={n}
        onChange={setN}
        className="mb-2"
      />
      <p className="mb-4 text-center text-sm text-fg-body">
        {valid
          ? <>Worth <span className="font-bold text-pop-amber">{pointsFor(n)} points</span> if you name them.</>
          : `Bid ${MIN_BID}–${ceiling}.`}
      </p>
      <div className="flex gap-3">
        <Button variant="neutral" size="lg" disabled={!bid} onClick={onPass}>
          Pass
        </Button>
        <Button variant="primary" size="lg" fullWidth disabled={!valid} onClick={() => onBid(n)}>
          {valid ? `Bid ${n}` : 'Bid'}
        </Button>
      </div>
      {!bid && <p className="mt-2 text-center text-xs text-fg-subtle">The opener can&apos;t pass.</p>}
    </Card>
  );
}
