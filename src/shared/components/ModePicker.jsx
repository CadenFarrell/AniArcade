import { useState } from 'react';
import { useTileCharacter } from '../context/tileCharacterContext';
import { firebaseEnabled } from '../services/firebase';
import { playSound } from '../services/sound';
import { accentBg } from '../ui/accents';
import { splitTitle } from '../utils/splitTitle';
import { Backdrop, HubButton, Icon, Kana, Screen } from '../ui';

// A game's cover page: the first screen after its hub tile, where a player picks
// how to play. It was seven hand-copied files each centring a wordmark over two
// buttons — a near-empty page between a busy hub and a busy setup screen — and
// is now one component every <Game>Game.jsx renders with its own descriptor.
//
// It is meant to read as the tile you tapped, opened: the same solid game-ink
// block and split ANI / WORD title as the tile's bar, and the same character
// (useTileCharacter, handed over by HubScreen) on the same greyscale panel. With
// no character — no list yet, or a game mounted alone in a test — the panel is
// bare speed lines, exactly as an empty tile is.
//
// The two modes are cards rather than plain buttons because the choice is not
// obvious to a new player: each says in a line what the mode means at the
// table. Their names still begin "Play on this device" / "Play online", which
// is what HubScreen.test and the playtest bots find them by.
export default function ModePicker({ game, tagline, onLocal, onOnline, onExit }) {
  const character = useTileCharacter();
  const [broken, setBroken] = useState(null);
  const shown = character && character.imageUrl !== broken ? character : null;
  const title = splitTitle(game.title);
  const ink = accentBg(game.accent);

  return (
    <>
      <Backdrop />
      {/* The menu is an in-game screen too, so the way home stays in the same
          corner here as it does everywhere past it. */}
      <HubButton onClick={onExit} />
      <Screen center width="lg">
        {/* The cover: game ink and title on the left, the character on the
            right, cut on the diagonal like the hub's banner. Decorative halves
            are aria-hidden; the h1 carries the game's full name. */}
        <section
          className="relative isolate mb-6 flex h-56 overflow-hidden border-2 border-ink bg-surface-2
            shadow-pop sm:mb-8 sm:h-72"
        >
          <div
            className={`relative z-10 flex w-[62%] flex-col justify-center pr-10 pl-5 text-paper sm:w-[74%] sm:pl-8
              [clip-path:polygon(0_0,100%_0,82%_100%,0_100%)] ${ink}`}
          >
            {/* Kana and prefix in full paper: dimmed to 80% they fell under
                4.5:1 on the lighter game inks. Size alone keeps them quiet. */}
            {game.kana && <Kana className="mb-1 text-xs">{game.kana}</Kana>}
            <h1 className="font-display font-bold uppercase leading-none">
              <span className="sr-only">{game.title}</span>
              <span aria-hidden="true">
                {title.prefix && (
                  <span className="block text-sm tracking-[0.35em] sm:text-base">{title.prefix}</span>
                )}
                <span className="block text-5xl tracking-wide sm:text-7xl">{title.word}</span>
              </span>
            </h1>
            {tagline && <p className="mt-3 max-w-[16rem] text-sm leading-snug sm:max-w-xs sm:text-base">{tagline}</p>}
          </div>

          {/* About as wide as it is tall (portrait-ish on a phone), so the 2:3
              portrait shows head and shoulders, not a slice of face. */}
          <div aria-hidden="true" className="absolute inset-y-0 right-0 w-[45%] sm:w-[34%]">
            {shown ? (
              <img
                src={shown.imageUrl}
                alt=""
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setBroken(shown.imageUrl)}
                className="absolute inset-0 h-full w-full object-cover object-[50%_15%] grayscale contrast-125
                  mix-blend-multiply"
              />
            ) : (
              <>
                <div className="speed-lines absolute inset-0 opacity-25" />
                <div className="halftone absolute inset-0 opacity-10" />
              </>
            )}
            {shown && (
              <span
                className="absolute right-2 bottom-2 max-w-[calc(100%-1rem)] border border-ink bg-surface
                  px-2 py-1 text-left [overflow-wrap:anywhere]"
              >
                <span className="block font-display text-xs font-bold uppercase leading-tight tracking-wide text-fg-strong">
                  {shown.name}
                </span>
                {shown.show && (
                  <span className="block text-[11px] leading-tight text-fg-helper">{shown.show}</span>
                )}
              </span>
            )}
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <ModeCard
            icon="phone"
            label="Play on this device"
            detail="One screen, passed around the table."
            primary
            onClick={onLocal}
          />
          <ModeCard
            icon="globe"
            label="Play online"
            detail={
              firebaseEnabled
                ? 'Everyone on their own phone. Join with a room code.'
                : 'Online play isn’t set up on this build.'
            }
            disabled={!firebaseEnabled}
            onClick={onOnline}
          />
        </div>
      </Screen>
    </>
  );
}

// One way to play: an icon, the mode's name, and a line on what it means. Built
// on btn-pop directly, like the hub tiles, because a two-line card is more than
// Button's label-in-a-block takes. The local card is the solid ink one — it
// works on every build and is the usual way in.
function ModeCard({ icon, label, detail, primary = false, disabled = false, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        playSound('tap');
        onClick();
      }}
      className={`btn-pop focus-pop flex items-start gap-4 p-5 text-left disabled:cursor-not-allowed
        ${primary ? 'border-ink bg-ink text-paper' : 'border-ink bg-surface text-fg-strong'}
        ${disabled ? 'opacity-50' : ''}`}
    >
      <Icon name={icon} className="mt-0.5 text-3xl" />
      <span className="min-w-0">
        <span className="block font-display text-2xl font-bold uppercase leading-none tracking-wide">{label}</span>
        <span
          className={`mt-1.5 block font-sans text-sm font-normal normal-case leading-snug tracking-normal
            ${primary ? 'text-paper' : 'text-fg-helper'}`}
        >
          {detail}
        </span>
      </span>
    </button>
  );
}
