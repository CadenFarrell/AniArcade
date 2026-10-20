// The clip's player, drawn as the one dark panel on a paper page: an ink deck
// with a row of equaliser bars that move while the song plays and freeze when
// it is held (a race buzz) or done, and the clip's progress along its foot. It
// replaced a lone blue bar and the word "Listen…", which gave a music game
// nothing to look at while the music played.
//
// Presentational only — both players (ClipPlayer locally, SyncedClipPlayer
// online) own their audio and pass `pct` and `playing` in; `children` is their
// status line or button, set in paper on the ink.
//
// Under reduced motion the bars do not move at all (index.css) and stand at
// their own heights, so the deck still reads as a waveform rather than a row of
// identical posts.
const BARS = [0.45, 0.8, 0.6, 1, 0.7, 0.9, 0.5, 0.75, 0.95, 0.55, 0.85, 0.65, 0.4, 0.7];

export default function ClipDeck({ pct = 0, playing = false, children }) {
  return (
    <div className="w-full border-[3px] border-ink bg-ink px-4 pt-4 pb-3 text-paper shadow-pop">
      <div aria-hidden="true" className="mb-3 flex h-14 items-end justify-center gap-1.5">
        {BARS.map((h, i) => (
          <span
            key={i}
            className={`eq-bar w-2 bg-paper ${playing ? '' : '[animation-play-state:paused]'}`}
            style={{ height: `${h * 100}%`, animationDelay: `${-(i * 137) % 900}ms` }}
          />
        ))}
      </div>
      <div className="mb-2 h-2.5 w-full overflow-hidden border-2 border-paper bg-ink">
        <div className="h-full bg-paper transition-[width] duration-100" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-center">{children}</div>
    </div>
  );
}
