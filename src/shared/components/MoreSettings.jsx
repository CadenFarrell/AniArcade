import { useId, useState } from 'react';
import { storage } from '../services/storage';
import { Icon } from '../ui';

// The fold under a settings card: the options most tables never touch, one tap
// away. A settings card is the main reason setup screens read as forms — each
// had every option on screen at once, most of them ones a returning player has
// never changed — and folding them keeps the decisions people actually make
// (rounds, the timer, the mode) visible without deleting anything.
//
// Remembered, arcade-wide, under its own key — the same call as
// aniarcade_setting_detail (HelpDetailProvider) and for the same reasons: it
// belongs to no game, and somebody who opened it for AniTune wants it open in
// AniQuiz too. Read once per mount; each fold writes when toggled.
//
// Warnings never go inside a fold. A banner about a setting that is folded away
// would be a problem the player cannot see the cause of, so every card keeps
// its banners outside, after the fold.
const MORE_KEY = 'aniarcade_more_settings';

// `about` names the fold for a screen reader, and only matters where one screen
// has two (AniQuiz's and AniTune's two settings cards): two buttons both called
// "More settings" give no way to tell which card each one opens. It is sr-only,
// after the visible words, so the spoken name still starts with them — and
// `openMoreSettings`' /more settings/ still finds every fold.
export default function MoreSettings({ children, about = '', className = '' }) {
  const [open, setOpen] = useState(() => storage.getItem(MORE_KEY) === true);
  const id = useId();

  const toggle = () => {
    const next = !open;
    setOpen(next);
    storage.setItem(MORE_KEY, next);
  };

  return (
    <div className={`mt-2 border-t-2 border-line pt-3 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={id}
        className="focus-pop -mx-1 flex items-center gap-2 px-1 py-1 font-display text-sm font-bold uppercase
          tracking-widest text-fg-body hover:text-fg-strong"
      >
        <Icon name="chevron" className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        More settings
        {about && <span className="sr-only"> for {about}</span>}
      </button>
      <div id={id} hidden={!open} className="pt-4">
        {children}
      </div>
    </div>
  );
}
