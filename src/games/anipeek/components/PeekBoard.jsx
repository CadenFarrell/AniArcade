import { useState } from 'react';
import { GRID, TILES } from '../rules';
import { Button } from '../../../shared/ui';

// The portrait under its tiles — every screen of a round draws this one board.
//
// The picture is full colour, unlike the arcade's greyscale player faces
// (Portrait.jsx): colour is half of what makes a character recognisable from
// one square of hair, and greying it would make the game harder in a way no bid
// accounts for. Framed 2:3, AniList's own portrait shape, so no part of the
// image is cropped away where nobody could ever uncover it.
//
// **Nothing about the answer is on the page before the reveal.** The image's
// alt text is empty until then (a screen reader would otherwise read the name
// out), and the covered tiles are opaque blocks, not a filter over the image.
// Each covered tile's ink rule is an OUTSET box-shadow rather than a border, so
// it also paints over the sub-pixel seam where two tiles meet — a border inside
// each tile leaves that hairline of picture showing at some zoom levels.
//
// A tile is a button only for the player spending the bid (`onPick`), named
// "Uncover tile N" — those are the words the playtest bots press. Everyone else
// sees the same blocks, inert.
//
// A portrait that fails to load (a dead CDN link, a device offline — the
// service worker never caches another origin) leaves every tile covered and
// says so, with `onSkip` when a fresh card is still allowed.
export default function PeekBoard({ imageUrl, name, uncovered = [], revealAll = false, onPick = null, onSkip = null }) {
  const [broken, setBroken] = useState(false);
  // Reset when the card changes without a remount (a skip, the next round) —
  // setState during render, Avatar.jsx's pattern, so a broken picture cannot
  // poison the one after it.
  const [prevSrc, setPrevSrc] = useState(imageUrl);
  if (prevSrc !== imageUrl) {
    setPrevSrc(imageUrl);
    setBroken(false);
  }

  const open = new Set(uncovered);
  const failed = broken || !imageUrl;

  return (
    <figure
      className="relative mx-auto mb-5 aspect-[2/3] w-full max-w-[15rem] overflow-hidden border-[3px] border-ink
        bg-surface-2 shadow-pop sm:max-w-[17rem]"
    >
      {!failed && (
        <img
          key={imageUrl}
          src={imageUrl}
          alt={revealAll ? name : ''}
          referrerPolicy="no-referrer"
          decoding="async"
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover object-[50%_15%]"
        />
      )}

      {!revealAll && (
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)`, gridTemplateRows: `repeat(${GRID}, 1fr)` }}
        >
          {Array.from({ length: TILES }, (_, i) => {
            if (open.has(i)) return <span key={i} aria-hidden="true" />;
            const face = (
              <>
                <span className="halftone pointer-events-none absolute inset-0 opacity-25" />
                <span className="relative font-display text-sm font-bold text-fg-subtle">{i + 1}</span>
              </>
            );
            const look = 'relative grid place-items-center bg-surface shadow-[0_0_0_1px_var(--color-ink)]';
            return onPick && !failed ? (
              <button
                key={i}
                type="button"
                aria-label={`Uncover tile ${i + 1}`}
                onClick={() => onPick(i)}
                className={`${look} focus-pop z-0 hover:bg-surface-2 focus-visible:z-10`}
              >
                {face}
              </button>
            ) : (
              <span key={i} aria-hidden="true" className={look}>{face}</span>
            );
          })}
        </div>
      )}

      {failed && (
        <figcaption className="absolute inset-x-3 bottom-3 border-2 border-ink bg-surface p-3 text-center shadow-pop-sm">
          <p className="mb-2 text-sm font-bold text-fg-strong">This portrait didn&apos;t load.</p>
          {onSkip ? (
            <Button variant="neutral" size="sm" fullWidth onClick={onSkip}>Skip this character</Button>
          ) : (
            <p className="text-xs text-fg-helper">
              {revealAll ? name : 'Tiles are open now, so this one plays on.'}
            </p>
          )}
        </figcaption>
      )}
    </figure>
  );
}
