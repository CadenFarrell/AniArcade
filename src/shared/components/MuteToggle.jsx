import { playSound } from '../services/sound';
import { useSound } from '../context/soundContext';

// The speaker in the top bar. Drawn rather than an emoji (🔊 renders in every
// platform's own colours, which on an ink-and-paper bar is the one full-colour
// thing on screen) and stroked in ink so it matches the house beside Hub.
// Stroke is a token class driven by the button's hover rather than
// currentColor: standalone art paints with tokens, and only the inline icons
// in shared/ui/icons.js follow the text colour (that file says why).
//
// Renders nothing where there is nothing to mute — outside the provider, or on
// a browser with no Web Audio — rather than a switch that does nothing.
export default function MuteToggle() {
  const { muted, setMuted, supported } = useSound();
  if (!setMuted || !supported) return null;

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    // Only on the way ON: the confirmation that sound works is a sound. Played
    // after setMuted so the module already knows it is unmuted.
    if (!next) playSound('toggle');
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={!muted}
      aria-label={muted ? 'Sound off. Turn sound on' : 'Sound on. Turn sound off'}
      title={muted ? 'Sound off' : 'Sound on'}
      className="group focus-pop grid h-10 w-10 place-items-center rounded-pop-sm
        transition-colors hover:bg-wash"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-fg-icon transition-colors group-hover:stroke-fg-strong">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" strokeWidth="2" strokeLinejoin="round" />
        {muted ? (
          <path d="M16 9.5l5 5M21 9.5l-5 5" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <>
            <path d="M15.5 9a4 4 0 0 1 0 6" strokeWidth="2" strokeLinecap="round" />
            <path d="M18 6.5a7.5 7.5 0 0 1 0 11" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  );
}
