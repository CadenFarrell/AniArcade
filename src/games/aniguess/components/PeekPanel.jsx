import { useState } from 'react';
import { Button, Modal } from '../../../shared/ui';

// "Peek at my anime list", once per round. Button plus modal, identical in the
// local and online game screens. Neither copy could be dismissed with Escape;
// going through <Modal> fixes that for both.
export default function PeekPanel({ peekList, hasPeeked, onPeek, className = 'mb-5' }) {
  const [open, setOpen] = useState(false);

  const handlePeek = () => {
    setOpen(true);
    onPeek();
  };

  return (
    <>
      <Button
        variant={hasPeeked ? 'neutral' : 'secondary'}
        fullWidth
        className={className}
        onClick={handlePeek}
        disabled={hasPeeked}
      >
        {hasPeeked
          ? 'Already peeked this round'
          : 'Peek at my anime list (once per round)'}
      </Button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <h3 className="font-display text-2xl font-extrabold text-fg-strong">Your Anime List</h3>
          <p className="mb-5 text-base text-fg-helper">Titles only — no characters!</p>
          {peekList.length === 0 ? (
            <p className="text-lg text-fg-helper">No shared anime found.</p>
          ) : (
            // Focusable and named, because it scrolls: a keyboard user can
            // only scroll a region they can reach (axe's
            // scrollable-region-focusable, from the browser playtest).
            <ul
              tabIndex={0}
              aria-label="Your anime list"
              className="focus-pop max-h-80 space-y-2 overflow-y-auto"
            >
              {peekList.map((anime) => (
                <li key={anime.id} className="border-b border-line py-2 text-lg text-fg-strong">
                  {anime.title}
                </li>
              ))}
            </ul>
          )}
          <Button variant="secondary" size="lg" fullWidth className="mt-5" onClick={() => setOpen(false)}>
            Got it — close
          </Button>
        </Modal>
      )}
    </>
  );
}
