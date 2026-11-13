import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Kana, Modal, SheetSection } from '../ui';
import { howToPages } from '../utils/howToPages';

// A game's rules, as one dialog: the goal, a round, the scoring, and only the
// settings that change how it plays. The text is the game's own `howTo.js`
// (the descriptor's `howTo` loader), built from its rules.js constants, so a
// retuned number reaches the sheet without anyone remembering to edit it.
//
// Opened from "How to play" in the top bar on every screen of a game — cover,
// setup, a round, the lobby, results — and from the cover page's own button,
// and by itself the first time a game is opened on a device
// (hub/howToSeen.js). All from HubScreen, which is the one place that knows
// which game is open; nothing in a game had to change.
//
// PAGED, one section to a page (the goal first), because as one long dialog it
// ran off the bottom of a phone and the rules had to be scrolled — AniGuess's
// is a dozen bullets. The data is unchanged: shared/utils/howToPages.js cuts
// it, and splits a section too long for one small phone's page.
// Every page is drawn in the same grid cell, the others `invisible`, so the
// cell is as tall as the tallest page and Back/Next never move under a thumb
// that is tapping through. visibility:hidden also takes the off pages out of
// the tab order and the accessibility tree; aria-hidden says so to jsdom too.
// The panel is capped to the screen, with only the page area scrolling, as the
// last resort for a phone too small for even one page — never the plan.
//
// Exactly one "Got it" on every page, because the playtest bots close the sheet
// by pressing that name (playtest/core/generic.js's closeRulesSheet), from the
// first page, exactly as a player who already knows the game would: a quiet
// link under the row until the last page, where the Next button itself becomes
// it. Same element, so a keyboard user tapping Next lands on Got it with focus
// still in place.
export default function HowToSheet({ game, onClose, onFeedback }) {
  const [state, setState] = useState({ howTo: null, failed: false });
  const [page, setPage] = useState(0);
  const bodyRef = useRef(null);
  const backRef = useRef(null);
  const nextRef = useRef(null);

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
  const pageList = useMemo(() => (howTo ? howToPages(howTo) : null), [howTo]);
  const pageCount = pageList ? pageList.length : 1;
  const last = page >= pageCount - 1;

  // A page that did have to scroll (the last-resort case) starts the next one
  // at its top, not halfway down.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [page]);

  const goTo = (to) => {
    const next = Math.max(0, Math.min(pageCount - 1, to));
    // Back is disabled on the first page, and a disabled button drops focus to
    // <body>, outside the dialog — so it moves on to Next first.
    if (next === 0 && document.activeElement === backRef.current) nextRef.current?.focus();
    setPage(next);
  };

  const onKeyDown = (e) => {
    if (pageCount < 2 || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(page + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(page - 1); }
  };

  const pages = pageList
    ? pageList.map((p) => (p.goal != null ? (
      <div key={p.key}>
        <p className="mb-3 text-lg text-fg-strong">{p.goal}</p>
        {p.players && <Badge>{p.players}</Badge>}
      </div>
    ) : (
      <SheetSection key={p.key} title={p.title} className="">
        {p.items.map((item) => (
          <li key={item} className="text-fg-body">{item}</li>
        ))}
      </SheetSection>
    )))
    : [
      <p key="status" className="text-fg-body">
        {failed
          ? 'The rules couldn’t load. Check your connection and open How to play again.'
          : 'Loading the rules…'}
      </p>,
    ];

  return (
    // max-h-full against Modal's fixed scrim (inset-0, py-8): the panel never
    // runs past the screen, and the flex column hands any shortfall to the
    // page area alone, so the heading and the buttons stay in view.
    <Modal onClose={onClose} width="md" className="flex max-h-full flex-col">
      {/* Catches the arrow keys bubbling up from the controls inside, to turn
          the page; the wrapper is never a control itself. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div onKeyDown={onKeyDown} className="flex min-h-0 flex-1 flex-col">
        {/* The kana and the game's name share one line over the heading: as
            two lines of their own they cost a small phone's page a bullet. */}
        <div className="mb-4 shrink-0">
          <p className="flex items-baseline gap-2 font-display text-base font-bold uppercase tracking-wide text-fg-body">
            {game.kana && <Kana className="text-sm text-pop-pink">{game.kana}</Kana>}
            {game.title}
          </p>
          <h2 className="font-display text-3xl font-bold uppercase text-fg-strong">How to play</h2>
        </div>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid">
            {pages.map((content, i) => (
              <div
                key={content.key}
                aria-hidden={i === page ? undefined : true}
                className={`[grid-area:1/1] ${i === page ? '' : 'invisible'}`}
              >
                {content}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 shrink-0">
          {pageCount > 1 ? (
            <div className="flex items-center gap-3">
              <Button
                ref={backRef}
                variant="secondary"
                className="flex-1"
                disabled={page === 0}
                sound="back"
                onClick={() => goTo(page - 1)}
              >
                Back
              </Button>
              <span className="flex shrink-0 gap-1.5" aria-hidden="true">
                {pages.map((content, i) => (
                  <span
                    key={content.key}
                    className={`h-2.5 w-2.5 rounded-full border-2 border-ink ${i === page ? 'bg-ink' : 'bg-surface'}`}
                  />
                ))}
              </span>
              <span className="sr-only" aria-live="polite">{`Page ${page + 1} of ${pageCount}`}</span>
              <Button ref={nextRef} variant="primary" className="flex-1" onClick={last ? onClose : () => goTo(page + 1)}>
                {last ? 'Got it' : 'Next'}
              </Button>
            </div>
          ) : (
            <Button variant="primary" fullWidth onClick={onClose}>
              Got it
            </Button>
          )}

          {(!last || onFeedback) && (
            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-fg-subtle">
              {!last && <TextLink onClick={onClose}>Got it</TextLink>}
              {onFeedback && (
                <span className="flex items-center gap-x-1">
                  <span>Something unclear?</span>
                  <TextLink onClick={onFeedback}>Send feedback</TextLink>
                </span>
              )}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

// The sheet's quiet links: skip out early, and feedback.
function TextLink({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      // min-h-6: the 24px target floor (WCAG 2.5.8), as the hub's Credits link.
      className="focus-pop min-h-6 px-1 font-bold text-fg-body underline decoration-2 underline-offset-2
        hover:text-fg-strong"
    >
      {children}
    </button>
  );
}
