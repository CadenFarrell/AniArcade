import { useEffect, useState } from 'react';
import { Badge, Button, Kana, Modal, SheetSection } from '../ui';

// A game's rules, as one dialog: the goal, a round, the scoring, and only the
// settings that change how it plays. The text is the game's own `howTo.js`
// (the descriptor's `howTo` loader), built from its rules.js constants, so a
// retuned number reaches the sheet without anyone remembering to edit it.
//
// Opened from the top bar's "How to play" on every screen of a game — cover,
// setup, a round, the lobby, results — and by itself the first time a game is
// opened on a device (hub/howToSeen.js). Both from HubScreen, which is the one
// place that knows which game is open; nothing in a game had to change.
//
// The dismiss button reads "Got it" because the playtest bots press that by
// name (playtest/core/generic.js's PROGRESS list), so a bot meeting the sheet
// on a first visit closes it and carries on, exactly as a player would.
export default function HowToSheet({ game, onClose, onFeedback }) {
  const [state, setState] = useState({ howTo: null, failed: false });

  // Usually already here: preloadGames fetched it at idle, and a resolved
  // import() answers on the next tick. A failure is a dropped connection, not
  // a crash, so it says so rather than throwing into the game's boundary.
  useEffect(() => {
    let live = true;
    Promise.resolve()
      .then(() => game.howTo())
      .then((mod) => { if (live) setState({ howTo: mod.HOW_TO, failed: false }); })
      .catch(() => { if (live) setState({ howTo: null, failed: true }); });
    return () => { live = false; };
  }, [game]);

  const { howTo, failed } = state;

  return (
    <Modal onClose={onClose} width="md">
      <Kana className="block text-sm text-pop-pink">{game.kana}</Kana>
      <h2 className="mb-1 font-display text-3xl font-bold uppercase text-fg-strong">How to play</h2>
      <p className="mb-4 font-display text-lg font-bold uppercase tracking-wide text-fg-body">{game.title}</p>

      {howTo && (
        <>
          <p className="mb-2 text-base text-fg-strong">{howTo.goal}</p>
          {howTo.players && <Badge className="mb-5">{howTo.players}</Badge>}
          {howTo.sections.map((section) => (
            <SheetSection key={section.title} title={section.title}>
              {section.items.map((item) => (
                <li key={item} className="text-fg-body">{item}</li>
              ))}
            </SheetSection>
          ))}
        </>
      )}
      {!howTo && !failed && <p className="mb-5 text-fg-body">Loading the rules…</p>}
      {failed && (
        <p className="mb-5 text-fg-body">
          The rules couldn’t load. Check your connection and open How to play again.
        </p>
      )}

      <Button variant="primary" fullWidth onClick={onClose} className="mt-2">
        Got it
      </Button>
      {onFeedback && (
        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-1 text-sm text-fg-subtle">
          <span>Something unclear?</span>
          <button
            type="button"
            onClick={onFeedback}
            // min-h-6: the 24px target floor (WCAG 2.5.8), as the hub's Credits link.
            className="focus-pop min-h-6 px-1 font-bold text-fg-body underline decoration-2 underline-offset-2
              hover:text-fg-strong"
          >
            Send feedback
          </button>
        </p>
      )}
    </Modal>
  );
}
