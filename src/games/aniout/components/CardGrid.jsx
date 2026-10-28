import { useState } from 'react';

// The round's characters as a grid of manga panels: the portrait over the name.
// Two modes, one layout, so the reveal lands on exactly the picture each player
// picked from.
//
//   - picking (`onPick` set): a radiogroup, select-then-lock like AniQuiz's
//     lettered answers — a thumb landing on the card beside the one it meant
//     must not cost the round. The pick is marked by an OUT tab and an ink name
//     bar, never colour alone. Each radio is named by the character's name only:
//     that is what the player is choosing, and what the bots press.
//   - reveal (`oddKey` set): a plain list. The odd one keeps full colour and
//     wears the OUT stamp; the five fade their PICTURES (never their text, which
//     axe flags under 4.5:1) and each card prints its show and its value for
//     the connection.
//
// Portraits are in colour: hair and costume are half of recognising someone,
// and the hub's greyscale is a board decoration, not a game surface.
export default function CardGrid({ cards, picked = null, onPick = null, oddKey = null }) {
  const reveal = oddKey != null;
  const cols = cards.length === 5 ? 'grid-cols-3 sm:grid-cols-5' : cards.length === 7 ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3';
  const Wrap = reveal ? 'ul' : 'div';
  return (
    <Wrap
      className={`mb-5 grid gap-2 sm:gap-3 ${cols}`}
      {...(reveal ? { 'aria-label': 'Characters' } : { role: 'radiogroup', 'aria-label': 'Characters' })}
    >
      {cards.map((c) => (reveal ? (
        <li key={c.key} className={`relative flex flex-col border-ink bg-surface ${c.key === oddKey ? 'border-[3px] shadow-pop' : 'border-2'}`}>
          <Face card={c} faded={c.key !== oddKey} />
          {c.key === oddKey && <OutTab />}
          <div className="flex flex-1 flex-col px-1.5 py-1.5">
            <span className="text-sm font-bold leading-tight text-fg-strong [overflow-wrap:anywhere]">{c.name}</span>
            {c.series && <span className="text-xs leading-snug text-fg-helper [overflow-wrap:anywhere]">{c.series}</span>}
            {c.note && (
              <span className="mt-1 font-display text-xs font-bold uppercase leading-tight tracking-wide text-fg-body [overflow-wrap:anywhere]">
                {c.note}
              </span>
            )}
          </div>
        </li>
      ) : (
        <button
          key={c.key}
          type="button"
          role="radio"
          aria-checked={picked === c.key}
          // The name alone: the OUT tab is aria-hidden, but tools that read
          // textContent (the playtest snapshot) would otherwise say "OutDenji".
          aria-label={c.name}
          onClick={() => onPick?.(c.key)}
          className={`btn-pop focus-pop relative flex flex-col overflow-hidden rounded-none! p-0! text-left
            ${picked === c.key ? 'border-ink bg-ink text-paper' : 'border-ink bg-surface text-fg-strong'}`}
        >
          <Face card={c} />
          {picked === c.key && <OutTab />}
          <span className="block px-1.5 py-1.5 text-sm font-bold leading-tight [overflow-wrap:anywhere]">{c.name}</span>
        </button>
      )))}
    </Wrap>
  );
}

// The picture, square and framed on the face (AniList portraits are 2:3, so a
// square shows head and shoulders — the hub tile's crop). A dead link falls back
// to speed lines and the initial, so a broken CDN URL never leaves a hole in the
// grid. jsdom never fires load or error, so nothing waits on either.
function Face({ card, faded = false }) {
  const [broken, setBroken] = useState(false);
  return (
    <div aria-hidden="true" className="relative aspect-square w-full overflow-hidden border-b-2 border-ink bg-surface-2">
      {card.imageUrl && !broken ? (
        <img
          src={card.imageUrl}
          alt=""
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className={`absolute inset-0 h-full w-full object-cover object-[50%_15%] ${faded ? 'opacity-45 grayscale' : ''}`}
        />
      ) : (
        <>
          <span className="speed-lines absolute inset-0 opacity-20" />
          <span className="absolute inset-0 grid place-items-center font-display text-4xl font-bold uppercase text-fg-ghost">
            {(card.name ?? '?').slice(0, 1)}
          </span>
        </>
      )}
    </div>
  );
}

function OutTab() {
  return (
    <span
      aria-hidden="true"
      className="absolute left-0 top-0 border-b-2 border-r-2 border-ink bg-pop-moss px-1.5 py-0.5 font-display text-xs
        font-bold uppercase tracking-[0.2em] text-paper"
    >
      Out
    </span>
  );
}
