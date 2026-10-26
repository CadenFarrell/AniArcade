import { HINTS, HINT_COST, budgetLeft } from '../rules';

// The hint cards: four facts about the character's show, each bought for
// HINT_COST tiles of the bid. Everyone sees a bought card — the table is
// watching the bidder narrow it down, and a hint only one player could read
// would be a secret with nowhere to live (nothing in this game is private).
//
// A fact the deal could not find (no studio on the profile or in the pack) is
// still a card, disabled, saying so — a card that silently vanished would
// leave the table wondering what it missed. The buy buttons are named "Hint:
// <label>", the words the playtest bots press.
//
// `showAll` is the reveal: every fact face up, bought or not, as the round's
// recap — the hint nobody paid for is often the one that would have given it
// away, and that is the argument the table has next.
export default function HintCards({ game, deal, card, canBuy, onBuy, showAll = false }) {
  if (!deal?.hintsOn || !card) return null;
  const left = budgetLeft(game);
  return (
    <section aria-label="Hint cards" className="mb-5 grid grid-cols-2 gap-2">
      {HINTS.map(({ id, label }) => {
        const value = card.hints?.[id];
        const taken = game.hintsTaken.includes(id);
        if (taken || (showAll && value)) {
          return (
            <div key={id} className="border-2 border-ink bg-surface px-3 py-2 shadow-pop-sm">
              <p className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-fg-helper">{label}</p>
              <p className="text-base font-bold text-fg-strong [overflow-wrap:anywhere]">{value}</p>
              {showAll && !taken && <p className="text-xs text-fg-subtle">Not bought</p>}
            </div>
          );
        }
        const reason = !value ? `No ${label.toLowerCase()} on record`
          : left < HINT_COST ? `Costs ${HINT_COST} tiles`
            : `${HINT_COST} tiles`;
        const enabled = canBuy && Boolean(value) && left >= HINT_COST && game.phase === 'peeking';
        if (!canBuy) {
          return (
            <div key={id} className="border-2 border-dashed border-ink bg-surface-2 px-3 py-2">
              <p className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-fg-helper">{label}</p>
              <p className="text-sm text-fg-subtle">{value ? 'Not bought' : `No ${label.toLowerCase()} on record`}</p>
            </div>
          );
        }
        return (
          <button
            key={id}
            type="button"
            disabled={!enabled}
            aria-label={`Hint: ${label}`}
            onClick={() => onBuy(id)}
            className="btn-pop focus-pop rounded-pop-sm! border-ink bg-surface px-3 py-2 text-left
              hover:bg-surface-2 disabled:border-dashed disabled:bg-surface-2 disabled:shadow-none"
          >
            <span className="block font-display text-[11px] font-bold uppercase tracking-[0.2em] text-fg-helper">{label}</span>
            <span className={`block text-sm ${enabled ? 'font-bold text-fg-strong' : 'text-fg-disabled'}`}>{reason}</span>
          </button>
        );
      })}
    </section>
  );
}
