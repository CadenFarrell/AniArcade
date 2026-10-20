import { useState } from 'react';
import { Button, NumberInput } from '../../../shared/ui';

// One wager. The limit is shown, not just enforced, because "how much can I
// bet" is the whole decision and a player should not discover it by having
// their number clamped.
export default function WagerEntry({ limit, onWager, disabled = false }) {
  const [amount, setAmount] = useState(() => Math.min(limit, Math.round(limit / 2 / 100) * 100));
  return (
    <div>
      <p className="mb-3 text-center text-base text-fg-body">
        Wager anything from 0 to <span className="font-bold text-pop-amber">{limit.toLocaleString()}</span>.
      </p>
      <NumberInput
        id="aniquiz-wager"
        ariaLabel="Wager"
        min={0}
        max={limit}
        step={100}
        value={amount}
        disabled={disabled}
        onChange={setAmount}
        className="mb-3"
      />
      <div className="mb-3 flex gap-3">
        <Button variant="neutral" size="md" fullWidth disabled={disabled} onClick={() => setAmount(0)}>
          Nothing
        </Button>
        <Button variant="neutral" size="md" fullWidth disabled={disabled} onClick={() => setAmount(limit)}>
          All in
        </Button>
      </div>
      <Button variant="primary" size="lg" fullWidth disabled={disabled} onClick={() => onWager(amount)}>
        Lock wager
      </Button>
    </div>
  );
}
