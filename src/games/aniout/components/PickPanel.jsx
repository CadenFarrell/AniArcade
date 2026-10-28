import { useState } from 'react';
import { Button } from '../../../shared/ui';
import CardGrid from './CardGrid';

// One player's pick: who is out, then (with reasons on) why the rest belong,
// then Lock in. Owns its own draft, so a round only ever sees a locked pick;
// the caller keys it per round and per player, so a draft never carries over
// to the next person holding the device.
//
// Words the bots and tests press: a character radio (by name), a reason radio
// ("Reason: All …"), "Lock in".
export default function PickPanel({ set, reasonsOn, onLock }) {
  const [card, setCard] = useState(null);
  const [reason, setReason] = useState(null);
  const complete = card != null && (!reasonsOn || reason != null);

  return (
    <>
      <CardGrid cards={set.cards} picked={card} onPick={setCard} />
      {reasonsOn && (
        <section className="mb-5" aria-labelledby="aniout-reason-heading">
          <h3 id="aniout-reason-heading" className="mb-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-fg-helper">
            Why do the rest belong?
          </h3>
          <div className="grid gap-2" role="radiogroup" aria-labelledby="aniout-reason-heading">
            {set.reasons.map((text, i) => {
              const on = reason === i;
              return (
                <button
                  key={text}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`Reason: ${text}`}
                  onClick={() => setReason(i)}
                  className={`btn-pop focus-pop rounded-pop-sm! px-3 py-2.5 text-left
                    ${on ? 'border-ink bg-ink text-paper' : 'border-ink bg-surface text-fg-strong hover:bg-surface-2'}`}
                >
                  <span className="[overflow-wrap:anywhere]">{text}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <Button variant="primary" size="lg" fullWidth disabled={!complete} onClick={() => onLock({ card, reason: reasonsOn ? reason : -1 })}>
        Lock in
      </Button>
    </>
  );
}
