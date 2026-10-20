import { useEffect, useRef } from 'react';
import ArcadeMark from './ArcadeMark';
import { playSound } from '../shared/services/sound';
import { Button, Icon, Kana } from '../shared/ui';
import { ART } from '../shared/ui/credits';
import { KANA } from '../shared/ui/kanaText';

// The attract screen: what the arcade shows before anybody has pressed a button.
// Once per browser session (titleSeen.js), so it greets a fresh visit and stays
// out of the way of a refresh.
//
// It earns its one extra tap twice over. It is the arcade's cover — the screen
// that says what this is before the menu asks you to choose — and PRESS START is
// the user gesture the sound engine needs: browsers will not start audio until
// the page has been interacted with, so without this the hub's first tap would
// be the one sound nobody hears.
//
// Composition follows the SAMURAI reference: a grayscale print with a red sun
// disc behind it, the print MULTIPLIED over the disc so its ink lines stay black
// and only its paper turns red. The red is CSS, never in the image file.
const PRINT = ART.wave;

export default function TitleScreen({ onStart }) {
  const startRef = useRef(null);

  // Focused on arrival, so Enter or Space starts the arcade with no pointer at
  // all — the way an attract screen answers any button.
  useEffect(() => {
    startRef.current?.focus();
  }, []);

  const start = () => {
    playSound('start');
    onStart();
  };

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-canvas">
      {/* The art. Disc first, then the print multiplied over it. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div
          className="absolute top-[8%] right-[6%] aspect-square w-[46vmin] rounded-full bg-pop-pink
            sm:top-[10%] sm:right-[14%]"
        />
        <img
          src={PRINT.src}
          alt=""
          fetchPriority="high"
          className="absolute inset-y-0 right-0 h-full w-full object-cover object-[70%_50%]
            mix-blend-multiply sm:w-[78%]"
        />
        {/* A paper slab cut on the diagonal, so the type sits on clean paper
            rather than over the wave's linework. */}
        <div
          className="absolute inset-y-0 left-0 w-[88%] bg-canvas/92 sm:w-[52%]
            [clip-path:polygon(0_0,100%_0,72%_100%,0_100%)]"
        />
        <div className="paper-grain absolute inset-0 opacity-25" />
      </div>

      <Kana
        vertical
        className="absolute top-6 right-4 hidden text-3xl text-ink sm:block lg:text-4xl"
      >
        {KANA.arcade}
      </Kana>

      <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12 lg:px-20">
        <ArcadeMark className="mb-6" />
        <h1 className="font-display font-bold uppercase leading-[0.9] tracking-tight text-fg-strong">
          <span className="block text-6xl sm:text-8xl">Ani</span>
          <span className="relative isolate block text-6xl sm:text-8xl">
            Arcade
            <span aria-hidden="true" className="slash absolute -bottom-1 left-0 -z-10 h-[0.24em] w-[min(100%,26rem)]" />
          </span>
        </h1>
        <p className="mt-6 max-w-xs text-lg text-fg-body">
          Party games built from the anime you&rsquo;ve watched — on one screen or across a room.
        </p>

        <div className="mt-10">
          <Button ref={startRef} size="xl" sound={null} onClick={start} className="min-w-56">
            <Icon name="play" className="attract-blink mr-2" />
            Press start
          </Button>
        </div>

        <div aria-hidden="true" className="mt-10 flex items-center gap-3">
          <span className="font-display text-sm font-bold tracking-[0.4em] text-fg-subtle">2026</span>
          <span className="hatch h-3 w-24 [--hatch:var(--color-ink)]" />
          <Kana className="text-xs text-fg-subtle">{KANA.start}</Kana>
        </div>
      </div>

      <p className="px-6 pb-4 text-xs text-fg-subtle sm:px-12 lg:px-20">
        Art: {PRINT.artist}, <cite>{PRINT.title}</cite>, {PRINT.date} — {PRINT.source}, public domain.
      </p>
    </main>
  );
}
