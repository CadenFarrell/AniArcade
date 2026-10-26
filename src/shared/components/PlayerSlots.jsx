import { createContext, forwardRef, useContext, useMemo, useState } from 'react';
import { useProfileStore } from '../context/profileContext';
import { portraitFor, portraitsFor } from '../utils/portrait';
import { Badge, Card, Icon } from '../ui';
import Portrait from './Portrait';
import PortraitPicker from './PortraitPicker';

// The table's portraits, assigned once for the whole roster so no two slots
// wear the same face (portraitsFor). A PlayerSlot outside a PlayerSlots — or
// one whose player was not passed in `players` — falls back to its own best.
const PortraitContext = createContext(null);

// The seated players as a character-select screen: a card per player wearing
// a character from THEIR OWN list (the one they chose, else their best-known
// one, so the face is the same every time they sit down, and never the same
// face as anyone else at the table — see portraitsFor), their name in display
// caps,
// and their badges. Empty seats are a dashed "Add player" slot.
//
// It replaced a list of rows that was the same in every game and looked like a
// form. Everything a row could do a slot still does, through the same controls
// and the same accessible names — "Remove <name>", "Import <name>'s list", "Add
// player" — which the playtest bots and the component tests find them by.
//
// Shared by every local setup screen and, through Lobby.jsx's PlayerRoster,
// every online lobby.

/**
 * The grid. `title` and `count` make it the Players card; `players` (the seated
 * roster, in seat order) is what the portraits are shared out across.
 */
export function PlayerSlots({ title = 'Players', count, players, children, footer }) {
  const portraits = useMemo(() => portraitsFor(players ?? []), [players]);
  return (
    <PortraitContext.Provider value={portraits}>
      <Card title={count == null ? title : `${title} (${count})`} padding="lg" className="mb-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">{children}</div>
        {footer}
      </Card>
    </PortraitContext.Provider>
  );
}

/**
 * One seated player. `actions` are small controls laid over the portrait's top
 * right (import, remove); `corner` is a mark for its top left (the host's
 * crown, a drag handle); `badges` sit under the name. `dim` greys a player who
 * has left a room — kept, not dropped, so the host can see who went.
 *
 * `onChooseFace` makes the portrait itself a button that opens the character
 * picker (PortraitPicker.jsx) — every slot on a local setup screen, only your
 * own in a lobby, since a phone can only save its own profile. A slot whose
 * chosen character went to someone seated earlier says who has it (`takenBy`,
 * from portraitsFor); without that the choice looks like it failed to save.
 *
 * forwardRef + rest props so AniGuess can hand it dnd-kit's sortable ref,
 * style and listeners for drag-to-reorder.
 */
export const PlayerSlot = forwardRef(function PlayerSlot(
  { player, badges, actions, corner, dim = false, onChooseFace, className = '', ...rest },
  ref,
) {
  const shared = useContext(PortraitContext);
  const portrait = shared?.has(player.id) ? shared.get(player.id) : portraitFor(player);
  const takenBy = portrait?.takenBy;
  const frame = 'relative isolate block aspect-square w-full overflow-hidden border-b-2 border-ink bg-surface-2';

  return (
    <div
      ref={ref}
      {...rest}
      className={`relative flex flex-col overflow-hidden border-2 border-ink bg-surface shadow-pop-sm
        ${dim ? 'opacity-40' : ''} ${className}`}
    >
      {onChooseFace ? (
        // An INSET ring: the slot clips its overflow, so focus-pop's offset
        // ring would be cut off by the very card it is meant to mark.
        <button
          type="button"
          onClick={onChooseFace}
          aria-label={`Choose ${player.name}'s character`}
          title="Choose character"
          className={`${frame} group outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-focus`}
        >
          <Portrait portrait={portrait} name={player.name} />
          {/* A word, not a pencil: AniGuess's slots already carry a pencil for
              "Edit list", and two on one card would be a guess. */}
          <span
            aria-hidden="true"
            className="absolute right-1.5 bottom-1.5 border-2 border-ink bg-ink px-1.5 py-0.5 font-display text-xs
              font-bold uppercase tracking-wider text-paper group-hover:bg-surface group-hover:text-fg-strong"
          >
            Change
          </span>
        </button>
      ) : (
        <div aria-hidden="true" className={frame}>
          <Portrait portrait={portrait} name={player.name} />
        </div>
      )}
      {corner && <div className="absolute top-1.5 left-1.5">{corner}</div>}
      {actions && <div className="absolute top-1.5 right-1.5 flex gap-1">{actions}</div>}
      <div className="flex flex-1 flex-col gap-1.5 px-2.5 pt-2 pb-2.5">
        <span className="truncate font-display text-lg font-bold uppercase leading-none tracking-wide text-fg-strong">
          {player.name}
        </span>
        {(badges || takenBy != null) && (
          <span className="flex flex-wrap gap-1">
            {badges}
            {takenBy != null && <Badge tone="amber">Taken by {takenBy || 'someone'}</Badge>}
          </span>
        )}
      </div>
    </div>
  );
});

/** A small paper chip button for a slot's `actions`. Always labelled. */
export function SlotAction({ label, onClick, disabled, tone = 'ink', children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`focus-pop grid h-9 w-9 place-items-center border-2 border-ink bg-surface text-base
        hover:bg-surface-2 disabled:opacity-40 ${tone === 'danger' ? 'text-pop-red' : 'text-fg-strong'}`}
    >
      {children}
    </button>
  );
}

/** The empty seat: a dashed slot that opens the profile picker. */
export function AddPlayerSlot({ onClick, disabled, label = 'Add player' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="focus-pop flex min-h-40 flex-col items-center justify-center gap-1 border-2 border-dashed
        border-line-strong bg-surface/60 p-3 text-fg-helper transition-colors hover:border-ink hover:text-fg-strong
        disabled:opacity-40"
    >
      <span aria-hidden="true" className="font-display text-4xl leading-none">+</span>
      <span className="font-display text-base font-bold uppercase tracking-wide">{label}</span>
    </button>
  );
}

const showsBadge = (p) => {
  const shows = (p.animeList || []).length;
  return <Badge tone={shows ? 'lime' : 'amber'}>{shows ? `${shows} shows` : 'No list'}</Badge>;
};

/**
 * A local setup screen's whole roster: every seated player as a slot, then the
 * Add player seat. The same in five games (main profile seated — the games that
 * need a crowd seat the couch too, hooks/useAutoSeat.js — the picker adds the
 * rest, a link button imports into a seated player, a cross removes them), so
 * it is one component rather than five copies of the row markup that used to
 * drift.
 *
 * `onImport` is optional — AniTag reads nobody's list, so it offers no import
 * and passes `badgeFor={null}` for no list badge either.
 */
export function LocalRoster({
  players, activeId, onAdd, onRemove, onImport, onUpdate, disabled = false, badgeFor = showsBadge,
}) {
  // Whose character is being chosen. Any seat, not just yours: every profile
  // at a couch game is saved on this device.
  const [choosing, setChoosing] = useState(null);
  const { saveProfile } = useProfileStore();
  return (
    <>
      <PlayerSlots
        count={players.length}
        players={players}
        footer={players.length === 0 && (
          <p className="mt-3 text-sm text-fg-subtle">
            Nobody seated yet — set your main profile from the top bar at the hub, or add a
            player. Profiles and anime lists are shared with every game.
          </p>
        )}
      >
        {players.map((p) => (
          <PlayerSlot
            key={p.id}
            player={p}
            onChooseFace={onUpdate && !disabled ? () => setChoosing(p) : undefined}
            badges={(
              <>
                {p.id === activeId && <Badge tone="purple">You</Badge>}
                {badgeFor?.(p)}
              </>
            )}
            actions={(
              <>
                {onImport && (
                  <SlotAction label={`Import ${p.name}'s list`} disabled={disabled} onClick={() => onImport(p)}>
                    <Icon name="link" />
                  </SlotAction>
                )}
                <SlotAction label={`Remove ${p.name}`} tone="danger" disabled={disabled} onClick={() => onRemove(p.id)}>
                  <Icon name="cross" />
                </SlotAction>
              </>
            )}
          />
        ))}
        <AddPlayerSlot disabled={disabled} onClick={onAdd} />
      </PlayerSlots>
      {choosing && (
        <PortraitPicker
          profile={choosing}
          onClose={() => setChoosing(null)}
          // Saved through the store so every screen holding the profile sees it,
          // then handed back so the setup screen swaps its seated COPY — that
          // copy is what Start passes into the game.
          onSave={(next) => { saveProfile(next); onUpdate(next); }}
        />
      )}
    </>
  );
}
