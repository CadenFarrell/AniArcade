import { useEffect, useState } from 'react';

/**
 * One <audio> element for the whole game, kept "primed" once a gesture has
 * unlocked it.
 *
 * WHY ONE ELEMENT. Mobile browsers (iOS Safari above all) refuse play() on a
 * media element unless a user gesture has started that element before. Once an
 * element has played from a gesture it may play again with none, even after its
 * src changes. The clip players used to make a new Audio() for every song, so
 * every song was a fresh, locked element: online that is why each phone had to
 * tap "Tap when ready" before EVERY song, and locally it could cost a "Play
 * clip" tap per song on an iPhone. Sharing one element means the first song's
 * tap is the only one.
 *
 * NOT VERIFIED ON A REAL iPHONE when this was written (no device to hand); the
 * fallbacks stay for that reason. If a later play() is refused anyway, the
 * player calls markPrimed(false) and goes back to asking for a tap — the old
 * per-song behaviour, never a dead clip.
 *
 * Switching songs is `src = …; load()`. ClipPlayer's old note said reusing an
 * element "leaves the old buffered range attached and makes seeking
 * unreliable" — true of swapping src WITHOUT load(): load() runs the media
 * element load algorithm, which aborts the old fetch and resets the buffered
 * ranges and currentTime, and the seek waits for the new loadedmetadata.
 *
 * The next-song preload keeps its own throwaway element on purpose: it only
 * warms the HTTP cache, and borrowing this one would cut off the song playing
 * now.
 */
export function usePrimedAudio() {
  // A lazy useState rather than a ref: one handle for the component's life,
  // readable during render. Its insides (the element, the primed flag) change
  // without re-rendering anything, which is all a closure is needed for.
  const [handle] = useState(createPrimedAudio);
  useEffect(() => () => handle.dispose(), [handle]);
  return handle;
}

export function createPrimedAudio() {
  let el = null;
  let primed = false;
  return {
    // Created lazily, so a render with no Audio (a test without the media
    // stubs, server rendering) never constructs one.
    get element() {
      if (!el && typeof Audio !== 'undefined') {
        el = new Audio();
        el.preload = 'auto';
      }
      return el;
    },
    get primed() { return primed; },
    // Set when a play() resolved (the element is unlocked) and cleared when one
    // was refused (it is not, whatever we believed).
    markPrimed(value = true) { primed = value; },
    // Stop everything when the game unmounts. Not `src = ''`: that resolves to
    // the page's own URL and starts a request for it.
    dispose() {
      if (!el) return;
      el.pause();
      el.removeAttribute('src');
      try { el.load(); } catch { /* jsdom without the media stubs */ }
      el = null;
      primed = false;
    },
  };
}
