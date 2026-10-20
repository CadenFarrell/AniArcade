import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSoundCue } from '../hooks/useSoundCue';
import { KANA } from '../ui/kanaText';
import { Icon, Kana } from '../ui';

const LOOK = {
  correct: { icon: 'check', word: 'Right!', kana: KANA.hit, ink: 'bg-pop-lime' },
  wrong: { icon: 'cross', word: 'Miss!', kana: KANA.miss, ink: 'bg-pop-red' },
};

const SHOW_MS = 750;

// The manga impact frame for a result landing: speed lines burst across the
// screen and a ✓ or ✗ block slams into the middle for SHOW_MS, then it is gone
// and the screen underneath (which already says the result in words) is all
// that is left. It also plays the result's sound, so the two can never fire on
// different rules — one component, one `eventKey`, one moment.
//
// Same keying as useSoundCue: it fires once per new non-null `eventKey` while
// `result` is 'correct' or 'wrong', and never again for that key. Online pass
// the result only when it is THIS player's (the sound rule — a room of phones
// does not all flash for one player's answer); null shows and plays nothing.
//
// It is decoration over a screen that already states the result, so it is
// aria-hidden and pointer-events-none: a tap during the flash lands on the
// button underneath rather than being eaten. The ✓/✗ SHAPE carries it as well
// as the colour, which matters here — lime and red are the pair a red-green
// colour-blind player cannot separate, and wrong's red sits beside the brand's.
//
// Under reduced motion the frame still appears (the result is worth showing)
// but does not move: impact-in is a from-state animation, so removing it
// leaves the finished picture for its SHOW_MS. Gone by a timer, not by
// animationend, which jsdom never fires and a background tab can freeze.
export default function ResultImpact({ result, eventKey }) {
  const look = LOOK[result] ?? null;
  const key = look ? eventKey : null;
  useSoundCue(result, key);

  // Which key is on screen. Set when a new key arrives (adjusting state while
  // rendering, the arcade's pattern for this), cleared by the timer.
  const [shown, setShown] = useState(null);
  const [seen, setSeen] = useState(undefined);
  if (key != null && key !== false && key !== seen) {
    setSeen(key);
    setShown({ key, look });
  }

  useEffect(() => {
    if (!shown) return undefined;
    const id = setTimeout(() => setShown(null), SHOW_MS);
    return () => clearTimeout(id);
  }, [shown]);

  if (!shown || typeof document === 'undefined') return null;
  const { look: l } = shown;
  return createPortal(
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[45] grid place-items-center">
      <span className="impact-lines speed-lines absolute inset-0 opacity-60" />
      <span
        className={`impact-in relative flex -rotate-3 flex-col items-center border-[3px] border-ink px-8 py-5
          text-paper shadow-pop ${l.ink}`}
      >
        <Kana className="text-sm">{l.kana}</Kana>
        <span className="text-7xl leading-none"><Icon name={l.icon} /></span>
        <span className="mt-1 font-display text-3xl font-bold uppercase tracking-[0.2em]">{l.word}</span>
      </span>
    </div>,
    document.body,
  );
}
