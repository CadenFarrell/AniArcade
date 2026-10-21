import { portraitFor } from '../utils/portrait';
import { countCharacters } from '../utils/profileStats';
import { Icon } from '../ui';
import Portrait from './Portrait';

// Who you are, at the right end of the hub's top bar.
//
// This used to be a full-width card between the wordmark and the game list,
// which framed picking a profile as a setup step you had to clear before the
// arcade would let you in. It is not — it's an identity you set once and then
// forget, so it belongs in the chrome, next to where every other app puts an
// account control.
//
// HubScreen hands it to TopBar as `end`, on the menu only. Inside a game the
// same end of the bar holds the room code and Leave (RoomShell), and a profile
// switch mid-round would change who you are in a room that already seated you
// — so the two never share the bar, by construction rather than by layout.

// Drawn, not 👤: the platform emoji is the one full-colour object on an
// ink-and-paper bar. Stroke via a token class driven by the button's hover, the
// rule every drawn glyph here follows.
function PersonGlyph({ className }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-4 w-4 fill-none ${className}`}>
      <circle cx="12" cy="8" r="4" strokeWidth="2.2" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function ProfileButton({ profile, onOpen }) {
  // No profile yet: this is the one control on the screen that has to be found,
  // so it gets the brand vermilion rather than the quiet outline.
  if (!profile) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="focus-pop flex h-10 items-center gap-2 rounded-pop-sm border-2 border-ink bg-pop-pink
          px-3 font-display text-sm font-bold uppercase tracking-wider text-paper
          transition-transform hover:-translate-y-0.5"
      >
        <PersonGlyph className="stroke-paper" />
        Set profile
      </button>
    );
  }

  // The counts live in the picker — the pill only has room for the one fact
  // that changes what you should do next, which is "this list is empty".
  const empty = countCharacters(profile) === 0;
  // The face you wear in every game (portrait.js: the one you chose, else your
  // best-known), so the bar shows who you are the way every seat does. A list
  // with no pictured character keeps the drawn person instead.
  const face = portraitFor(profile);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Profile: ${profile.name}${empty ? ' (anime list is empty)' : ''}. Change profile`}
      className="group focus-pop flex h-10 items-center gap-2 rounded-pop-sm border-2 border-ink bg-surface
        px-3 font-display text-sm font-bold uppercase tracking-wider text-fg-strong
        transition-colors hover:bg-ink hover:text-paper"
    >
      {face ? (
        <span
          aria-hidden="true"
          className="relative isolate -ml-1.5 block h-7 w-7 flex-shrink-0 overflow-hidden border-2 border-ink
            bg-surface-2 transition-colors group-hover:border-paper"
        >
          <Portrait portrait={face} name={profile.name} initialClass="text-sm" />
        </span>
      ) : (
        <PersonGlyph className="stroke-ink transition-colors group-hover:stroke-paper" />
      )}
      {/* Capped so a long name can never push the brand off a phone's bar. */}
      <span className="max-w-[32vw] truncate sm:max-w-[12rem]">{profile.name}</span>
      {empty && <Icon name="warning" className="text-pop-amber group-hover:text-paper" />}
    </button>
  );
}
