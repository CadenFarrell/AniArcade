import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { playSound } from '../services/sound';
import { inertOutside } from '../utils/inertOutside';

// Everything that makes a layer a DIALOG rather than a box drawn over the page,
// shared by Modal (a panel on a scrim) and PauseScreen (a full-screen sheet).
// It was Modal's own body until the pause screen needed the same four things,
// and a second copy of focus handling is exactly what drifts.
//
// Returns `{ rootRef, panelRef }`: the root is the element carrying
// role="dialog" aria-modal, the panel is what takes focus when nothing inside
// already has it.
//
// - `onEscape` — called on Escape, or null for a dialog Escape must not close.
//   Only the TOPMOST open dialog answers it: a delete confirm opens on top of
//   the profile picker or an editor dialog, and with every dialog listening on
//   window one Escape closed both. Topmost is the last [aria-modal="true"] in
//   document order, which is the newest one — a dialog opened from inside
//   another renders inside it, and one opened elsewhere renders after it.
// - `sound` — played once on open (null for none).
export function useDialogLayer({ onEscape = null, sound = 'open' } = {}) {
  const rootRef = useRef(null);
  const panelRef = useRef(null);

  // A dialog opening is an event the player should hear. Once per mount; a
  // dialog that opened without any gesture (a resume prompt on load) is simply
  // silent, because the sound engine will not start outside one.
  useEffect(() => {
    if (sound) playSound(sound);
    // Once per mount, whatever the prop does afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof onEscape !== 'function') return undefined;
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      const open = document.querySelectorAll('[aria-modal="true"]');
      if (open.length && open[open.length - 1] !== rootRef.current) return;
      onEscape();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape]);

  // The page behind is out of reach while the dialog is open: inert for
  // keyboards, screen readers and the playtest bots, as the scrim already made
  // it for pointers (shared/utils/inertOutside.js says why it was not before).
  //
  // Focus goes with it. Making the background inert drops focus from the
  // button that opened the dialog, so the panel takes it, unless something in
  // the dialog already has it (an autoFocus button or field). Children's
  // autoFocus runs before this parent's layout effect, so the check sees it. On
  // close, focus goes back to that button, if it is still on the page and live.
  // The opener is read in the first RENDER, before any autoFocus inside has
  // moved focus.
  const [opener] = useState(() => (typeof document === 'undefined' ? null : document.activeElement));
  useLayoutEffect(() => {
    const undo = inertOutside(rootRef.current);
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    return () => {
      // Un-inert first: an inert element refuses focus.
      undo();
      if (opener && opener !== document.body && opener.isConnected && !opener.closest('[inert]')) {
        opener.focus?.({ preventScroll: true });
      }
    };
  }, [opener]);

  return { rootRef, panelRef };
}
