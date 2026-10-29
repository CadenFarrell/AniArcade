import { Card } from '../../../shared/ui';
import { takenBy } from '../rules';
import CardFace from './CardFace';

// The round's board: every card dealt, in the order they were drawn. A card
// still free is a button for the picker (`onSelect` set) and a plain panel for
// everyone else; a drafted one stays where it was, its picture faded and its
// drafter named under it, so the board reads as what is left without cards
// jumping about after every pick.
//
// Select, then choose a role in the bar (DraftScreen): a thumb landing on the
// card beside the one it meant costs nothing until a role is pressed. The
// selection is marked by an ink name bar and a PICKED tab, never colour alone.
// Each button is named "Take <name>" — the show stays visible text beside it —
// which is what the bots press.
export default function DraftBoard({ game, players, selected = null, onSelect = null, youId = null }) {
  const taken = takenBy(game);
  const owner = (id) => (id === youId ? 'You' : players.find((p) => p.id === id)?.name ?? 'Someone');
  const left = game.board.length - taken.size;
  return (
    <Card
      title="The Board"
      action={<span className="text-sm font-bold text-fg-helper">{left} left</span>}
      padding="sm"
      className="mb-5"
    >
      <ul aria-label="The board" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {game.board.map((card) => {
          const by = taken.get(card.key);
          const isSelected = selected === card.key;
          const caption = (
            <span className="block px-1.5 py-1.5">
              <span className="block text-sm font-bold leading-tight [overflow-wrap:anywhere]">{card.name}</span>
              {card.series && (
                <span className={`block text-xs leading-snug [overflow-wrap:anywhere] ${isSelected ? '' : 'text-fg-helper'}`}>
                  {card.series}
                </span>
              )}
              {by && (
                <span className="mt-1 block font-display text-xs font-bold uppercase tracking-wide text-fg-body">
                  {owner(by)}
                </span>
              )}
            </span>
          );
          return (
            <li key={card.key} className="flex">
              {!by && onSelect ? (
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`Take ${card.name}`}
                  onClick={() => onSelect(isSelected ? null : card.key)}
                  className={`btn-pop focus-pop relative flex w-full flex-col overflow-hidden rounded-none! p-0! text-left
                    ${isSelected ? 'border-ink bg-ink text-paper' : 'border-ink bg-surface text-fg-strong'}`}
                >
                  <CardFace card={card} className="border-b-2 border-ink" />
                  {isSelected && <PickedTab />}
                  {caption}
                </button>
              ) : (
                <div className={`relative flex w-full flex-col border-2 border-ink ${by ? 'bg-surface-2' : 'bg-surface'} text-fg-strong`}>
                  <CardFace card={card} faded={Boolean(by)} className="border-b-2 border-ink" />
                  {caption}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function PickedTab() {
  return (
    <span
      aria-hidden="true"
      className="absolute left-0 top-0 border-b-2 border-r-2 border-ink bg-pop-magenta px-1.5 py-0.5 font-display
        text-xs font-bold uppercase tracking-[0.2em] text-paper"
    >
      Picked
    </span>
  );
}
