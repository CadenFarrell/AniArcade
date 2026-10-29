import { useState } from 'react';

// One character's picture, square and framed on the face — the board's cards,
// the ballot's options and the reveal's rows are all this. AniList portraits
// are 2:3, so a square shows head and shoulders (the hub tile's crop, and
// AniOut's CardGrid). A dead link falls back to speed lines and the initial,
// so a broken CDN URL never leaves a hole in the board. jsdom never fires load
// or error, so nothing waits on either.
//
// `faded` is for a card already drafted: the PICTURE fades, never the text
// beside it, which axe flags under 4.5:1.
export default function CardFace({ card, faded = false, className = '' }) {
  const [broken, setBroken] = useState(null);
  const src = card?.imageUrl;
  return (
    <div aria-hidden="true" className={`relative aspect-square w-full overflow-hidden bg-surface-2 ${className}`}>
      {src && broken !== src ? (
        <img
          src={src}
          alt=""
          decoding="async"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(src)}
          className={`absolute inset-0 h-full w-full object-cover object-[50%_15%] ${faded ? 'opacity-35 grayscale' : ''}`}
        />
      ) : (
        <>
          <span className="speed-lines absolute inset-0 opacity-20" />
          <span className="absolute inset-0 grid place-items-center font-display text-3xl font-bold uppercase text-fg-ghost">
            {(card?.name ?? '?').slice(0, 1)}
          </span>
        </>
      )}
    </div>
  );
}
