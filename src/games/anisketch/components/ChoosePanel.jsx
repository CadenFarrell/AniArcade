import { useState } from 'react';

/**
 * The drawer's offer: each character as a portrait card, a button named
 * "Draw <name>". Portraits in colour — hair and costume are what the drawer is
 * about to put on paper. A dead image falls back to the initial, so a broken
 * CDN link never leaves a hole.
 */
export default function ChoosePanel({ choices, onChoose }) {
  if (!choices.length) {
    return <p className="text-center text-fg-body">Dealing your characters…</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {choices.map((c) => (
        <button
          key={c.key}
          type="button"
          aria-label={`Draw ${c.name}`}
          onClick={() => onChoose(c.key)}
          className="btn-pop focus-pop flex flex-col overflow-hidden rounded-none! border-ink bg-surface p-0! text-left text-fg-strong"
        >
          <Portrait character={c} />
          <span className="block px-2 pt-2 text-base font-bold leading-tight [overflow-wrap:anywhere]">{c.name}</span>
          {c.series && <span className="block px-2 pb-2 text-xs text-fg-helper [overflow-wrap:anywhere]">{c.series}</span>}
        </button>
      ))}
    </div>
  );
}

/** A character's portrait, square, framed on the face (the hub tile's crop). */
export function Portrait({ character, className = '' }) {
  const [broken, setBroken] = useState(false);
  return (
    <div aria-hidden="true" className={`relative aspect-square w-full overflow-hidden border-b-2 border-ink bg-surface-2 ${className}`}>
      {character?.imageUrl && !broken ? (
        <img
          src={character.imageUrl}
          alt=""
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover object-[50%_15%]"
        />
      ) : (
        <>
          <span className="speed-lines absolute inset-0 opacity-20" />
          <span className="absolute inset-0 grid place-items-center font-display text-4xl font-bold uppercase text-fg-ghost">
            {(character?.name ?? '?').slice(0, 1)}
          </span>
        </>
      )}
    </div>
  );
}
