import { useMemo, useState } from 'react';
import { characterNameKey } from '../utils/character';
import { pictureableCharacters, withPortraitKey } from '../utils/portrait';
import { Icon, Input, Label, Modal } from '../ui';
import Portrait from './Portrait';

// How many faces the grid draws before "Show more". A long list holds
// hundreds of pictured characters, each an <img> from AniList's CDN; the
// best-known ones come first and the search reaches the rest.
const PAGE = 47;

// Choose which character a player wears — their face on every setup slot,
// turn strip, handoff and results screen, in every game (portrait.js). One
// choice per PROFILE, not per game, so it travels the way the list does:
// saved with the profile, and copied into an online room with it
// (profileFingerprint counts it, so useRepublishProfile carries a change made
// in a lobby to the other phones).
//
// Only characters on the player's own list with a picture are offered — the
// same set the automatic choice ranks (pictureableCharacters), so the grid and
// the table cannot disagree about who is on it. "Automatic" is always first and
// is the old behaviour: the best-known character nobody else at the table has.
//
// Choosing saves straight away and closes. `onSave(profile)` gets the whole
// updated profile; the caller writes it through the store and, on a local
// setup screen, swaps it into its seated copy so Start carries it into the
// game.
export default function PortraitPicker({ profile, onSave, onClose }) {
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const all = useMemo(() => pictureableCharacters(profile), [profile]);
  // A choice that a later edit took off the list reads as Automatic, which is
  // what portrait.js already falls back to for it.
  const saved = typeof profile?.portraitKey === 'string' ? profile.portraitKey : '';
  const current = all.some((c) => c.key === saved) ? saved : '';

  const folded = characterNameKey(query.trim());
  // The current choice leads the unsearched grid, so it is on screen even when
  // it is the two-hundredth best-known character on the list.
  const matches = folded
    ? all.filter((c) => c.key.includes(folded) || characterNameKey(c.show).includes(folded))
    : [...all.filter((c) => c.key === current), ...all.filter((c) => c.key !== current)];
  const visible = matches.slice(0, shown);

  const choose = (key) => {
    if ((key ?? '') !== saved) onSave(withPortraitKey(profile, key));
    onClose();
  };

  return (
    <Modal onClose={onClose} width="lg">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold uppercase text-fg-strong">
          {profile.name}&apos;s character
        </h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="focus-pop -mr-2 grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm text-xl font-black
            text-fg-icon hover:text-fg-strong"
        >
          ✕
        </button>
      </div>
      <p className="mb-5 text-sm text-fg-helper">
        The face {profile.name} wears in every game. If someone seated earlier picked the same
        character, they keep it.
      </p>

      {all.length === 0 ? (
        <p className="text-fg-subtle">
          No characters with pictures on this list yet. Import a list and they&apos;ll show up here.
        </p>
      ) : (
        <>
          {all.length > PAGE && (
            <div className="mb-4">
              <Label htmlFor="portrait-search">Search characters or shows</Label>
              <Input
                id="portrait-search"
                type="search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
                placeholder="Name or show..."
              />
            </div>
          )}

          {/* The grid scrolls on its own, so the heading and the search stay in
              view on a phone however far down the list you go. Padded so a
              focused tile's ring is not clipped by the scroll box. */}
          <div className="-m-1.5 max-h-[55dvh] overflow-y-auto p-1.5">
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {!folded && (
                <FaceTile
                  label="Automatic"
                  detail="Best-known, not taken"
                  selected={!current}
                  auto
                  onClick={() => choose(null)}
                />
              )}
              {visible.map((c) => (
                <FaceTile
                  key={c.key}
                  label={c.name}
                  detail={c.show}
                  selected={c.key === current}
                  portrait={c}
                  onClick={() => choose(c.key)}
                />
              ))}
            </ul>

            {folded && matches.length === 0 && (
              <p className="mt-2 text-sm text-fg-subtle">Nobody on this list matches “{query.trim()}”.</p>
            )}
            {matches.length > shown && (
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE + 1)}
                className="focus-pop mt-4 w-full border-2 border-ink bg-surface px-4 py-2 font-display font-bold uppercase
                  tracking-wide text-fg-strong hover:bg-surface-2"
              >
                Show more ({matches.length - shown} left)
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

function FaceTile({ label, detail, selected, portrait, auto = false, onClick }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        aria-label={auto ? 'Automatic character' : `${label}, from ${detail}`}
        className={`focus-pop group flex w-full flex-col border-2 border-ink bg-surface text-left
          ${selected ? 'shadow-pop-sm outline-3 -outline-offset-4 outline-ink' : 'hover:bg-surface-2'}`}
      >
        <span className="relative isolate block aspect-square w-full overflow-hidden border-b-2 border-ink bg-surface-2">
          {auto ? (
            <>
              <span className="speed-lines absolute inset-0 opacity-30" />
              <span className="absolute inset-0 grid place-items-center font-display text-2xl font-bold uppercase text-fg-strong">
                Auto
              </span>
            </>
          ) : (
            <Portrait portrait={portrait} name={label} initialClass="text-3xl" />
          )}
          {selected && (
            <span className="absolute top-1 right-1 grid h-7 w-7 place-items-center bg-ink text-sm text-paper">
              <Icon name="check" />
            </span>
          )}
        </span>
        <span className="block px-1.5 pt-1 pb-1.5">
          <span className="block truncate text-sm font-bold text-fg-strong">{label}</span>
          <span className="block truncate text-xs text-fg-subtle">{detail}</span>
        </span>
      </button>
    </li>
  );
}
