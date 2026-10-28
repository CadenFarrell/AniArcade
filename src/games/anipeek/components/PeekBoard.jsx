import { useState } from 'react';
import { GRID, TILES } from '../rules';
import { Button } from '../../../shared/ui';
import { useSoundCue } from '../../../shared/hooks/useSoundCue';

// How far apart the last covered tiles lift off at the reveal: fast enough to
// read as one unveiling, slow enough that the face comes out of the board.
const CASCADE_MS = 45;

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

  // The tiles that came off since the last render — a ghost of each lifts away
  // where it sat, so a peek is a tile coming off rather than a hole appearing.
  // Compared during render (state that follows a prop); a new card starts with
  // nothing lifting, so a skip or the next round never flies its first board's
  // tiles.
  const openKey = `${imageUrl}|${uncovered.join(',')}`;
  const [prevKey, setPrevKey] = useState(openKey);
  const [lifting, setLifting] = useState([]);
  if (prevKey !== openKey) {
    const sameCard = prevKey.split('|')[0] === imageUrl;
    const before = new Set(sameCard ? prevKey.split('|')[1].split(',').filter(Boolean).map(Number) : uncovered);
    setPrevKey(openKey);
    setLifting(uncovered.filter((i) => !before.has(i)));
  }
  // Every device hears a tile come off — the whole table is watching the
  // board, so it is a shared moment (styling.md's sound rule), not a press.
  useSoundCue('select', uncovered.length ? openKey : null);

  // A covered tile's face, drawn by the live tile and by its ghost alike.
  const face = (i) => (
    <>
      <span className="halftone pointer-events-none absolute inset-0 opacity-25" />
      <span className="relative font-display text-sm font-bold text-fg-subtle">{i + 1}</span>
    </>
  );
  const look = 'relative grid place-items-center bg-surface shadow-[0_0_0_1px_var(--color-ink)]';
  // tile-lift ends invisible and starts as the tile, so with the animation
  // removed (reduced motion) the ghost is simply gone. aria-hidden and never a
  // button: the bots and a screen reader see the board as it now is.
  const ghost = (i, delayMs = 0) => (
    <span
      key={i}
      aria-hidden="true"
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
      className={`${look} tile-lift z-10`}
    >
      {face(i)}
    </span>
  );

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

      {/* At the reveal the tiles still covered lift off in a cascade rather
          than vanishing — the unveiling the whole round was a bid on. The
          picture and its name are already there underneath. */}
      {revealAll && !failed && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)`, gridTemplateRows: `repeat(${GRID}, 1fr)` }}
        >
          {Array.from({ length: TILES }, (_, i) => (
            open.has(i) ? <span key={i} /> : ghost(i, 150 + i * CASCADE_MS)
          ))}
        </div>
      )}

      {!revealAll && (
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)`, gridTemplateRows: `repeat(${GRID}, 1fr)` }}
        >
          {Array.from({ length: TILES }, (_, i) => {
            if (open.has(i)) return lifting.includes(i) ? ghost(i) : <span key={i} aria-hidden="true" />;
            return onPick && !failed ? (
              <button
                key={i}
                type="button"
                aria-label={`Uncover tile ${i + 1}`}
                onClick={() => onPick(i)}
                className={`${look} focus-pop z-0 hover:bg-surface-2 focus-visible:z-10`}
              >
                {face(i)}
              </button>
            ) : (
              <span key={i} aria-hidden="true" className={look}>{face(i)}</span>
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
