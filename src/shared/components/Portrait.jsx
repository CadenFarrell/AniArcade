import { useState } from 'react';

// A player's face, as a panel fill: the character from their own list
// (portrait.js chooses which) in greyscale ink, multiplied into the paper, or —
// for a profile with no pictured character, or an image that failed to load —
// speed lines and their initial, so an empty list still gets a panel of its
// own rather than a broken image.
//
// It fills its nearest positioned ancestor (absolute inset-0); the caller
// owns the frame, aspect ratio and border. Shared by the setup slots and the
// results screens, so a player wears the same face from seat to podium.
export default function Portrait({ portrait, name, initialClass = 'text-5xl' }) {
  const [broken, setBroken] = useState(null);
  const shown = portrait && portrait.imageUrl !== broken ? portrait : null;

  if (shown) {
    return (
      <img
        src={shown.imageUrl}
        alt=""
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setBroken(shown.imageUrl)}
        className="absolute inset-0 h-full w-full object-cover object-[50%_15%] grayscale contrast-125
          mix-blend-multiply"
      />
    );
  }
  return (
    <>
      <span className="speed-lines absolute inset-0 opacity-20" />
      <span
        className={`absolute inset-0 grid place-items-center font-display font-bold uppercase text-fg-ghost
          ${initialClass}`}
      >
        {(name ?? '?').slice(0, 1)}
      </span>
    </>
  );
}
