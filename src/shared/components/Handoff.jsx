import { usePlayerPortrait } from '../context/tablePortraitsContext';
import { KANA } from '../ui/kanaText';
import { Button, Kana } from '../ui';
import Portrait from './Portrait';

// Pass the device: the screen every local game shows between players, and the
// one a table sees most. It was six hand-built cards ("Pass the device to /
// Caden / I'm Caden — ready") in four sizes; it is now one manga panel of the
// next player's character, their name in a black slab across it, so whose go it
// is reads from across the table before anyone has read a word.
//
// The rules every handoff already followed, kept: it names who the device is
// for, it needs a deliberate tap, and it NEVER moves on by itself — the screen
// is useless until the right person is holding it. Nothing secret may appear on
// it (everyone can see it), which is why `note` says what the next person is
// about to do rather than anything about the round.
//
// `kicker` is the line above the panel ("Pass the device", or AniGuess's "Look
// away" when the device stays put and one person turns round instead). The
// button keeps each game's own words — the playtest bots press it by them.
export default function Handoff({
  player, kicker = 'Pass the device', note = 'Everyone else, look away.', cta, onReady, className = '',
}) {
  const portrait = usePlayerPortrait(player);
  const name = player?.name ?? 'the next player';
  return (
    <section className={`mx-auto w-full max-w-sm ${className}`} aria-label={`${kicker}: ${name}`}>
      {/* A real heading: it is what a screen reader lands on, and what the
          playtest bots name the screen by. */}
      <h2 className="mb-3 flex items-baseline justify-center gap-2 font-display text-sm font-bold uppercase tracking-[0.3em] text-fg-helper">
        {kicker}
        <Kana className="text-[11px] tracking-[0.12em] text-fg-subtle">{KANA.pass}</Kana>
      </h2>
      <div className="relative mb-5 border-[3px] border-ink bg-surface shadow-pop">
        <div aria-hidden="true" className="relative isolate aspect-[4/3] overflow-hidden bg-surface-2">
          <Portrait portrait={portrait} name={name} initialClass="text-8xl" />
          <span className="halftone pointer-events-none absolute inset-y-0 right-0 w-1/3 opacity-25" />
        </div>
        {/* The name slab: ink across the panel's foot, the way a manga sets a
            character's name card over their first panel. */}
        <p
          className="border-t-[3px] border-ink bg-ink px-4 py-2.5 font-display text-4xl font-bold uppercase
            leading-none tracking-wide text-paper [overflow-wrap:anywhere] sm:text-5xl"
        >
          {name}
        </p>
      </div>
      {note && <p className="mb-5 text-center text-base text-fg-body">{note}</p>}
      <Button variant="primary" size="xl" fullWidth onClick={onReady}>
        {cta ?? `I'm ${name} — ready`}
      </Button>
    </section>
  );
}
