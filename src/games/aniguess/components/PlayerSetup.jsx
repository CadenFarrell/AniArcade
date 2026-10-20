import { useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import { useWins } from '../../../shared/hooks/useWins';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { normalizeTitle } from '../../../shared/utils/ranking';
import { AddPlayerSlot, PlayerSlot, PlayerSlots, SlotAction } from '../../../shared/components/PlayerSlots';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import AniGuessSettings from './AniGuessSettings';
import { DEFAULT_PREFS } from '../prefs';
import descriptor from '../index';
import { Badge, Banner, Button, CardRow, Icon, Modal } from '../../../shared/ui';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// A seat that can be dragged: seat order IS turn order in AniGuess, so the
// slots keep the drag-to-reorder the old list had. rectSortingStrategy because
// the seats are a grid now, not a column. The grip is the only drag handle, so
// the slot's own buttons stay ordinary buttons.
function SortableSlot({ player, isYou, onRemove, onGoToList }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: player.id });
  const totalCharacters = player.animeList.reduce((sum, anime) => sum + anime.characters.length, 0);

  return (
    <PlayerSlot
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      player={player}
      corner={(
        <span
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${player.name}`}
          className="focus-pop grid h-9 w-9 cursor-grab place-items-center border-2 border-ink bg-surface
            text-lg text-fg-icon hover:text-fg-strong"
        >
          <Icon name="grip" />
        </span>
      )}
      badges={(
        <>
          {isYou && <Badge tone="purple">You</Badge>}
          <Badge tone={totalCharacters > 0 ? 'lime' : 'amber'}>
            {totalCharacters > 0 ? `${totalCharacters} chars` : 'No chars'}
          </Badge>
        </>
      )}
      actions={(
        <>
          <SlotAction label={`Edit ${player.name}'s list`} onClick={() => onGoToList(player)}>
            <Icon name="pencil" />
          </SlotAction>
          <SlotAction label={`Remove ${player.name}`} tone="danger" onClick={() => onRemove(player.id)}>
            <Icon name="cross" />
          </SlotAction>
        </>
      )}
    />
  );
}

export default function PlayerSetup({ onStartGame, onGoToList, players, onPlayersChange, onBack }) {
  const { activeId } = useProfileStore();
  const { getWins, resetWins } = useWins();
  const [showPicker, setShowPicker] = useState(false);
  const [showWins, setShowWins] = useState(false);
  // Seeded from whatever this device last started a game with, not from the
  // literal defaults — see shared/hooks/useGamePrefs.js.
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('aniguess', DEFAULT_PREFS);
  // ONE OBJECT, the shape AniGuessSettings reports into. Local play offers
  // every option, so it is simply the whole saved slice.
  const [settings, setSettings] = useState(prefs);
  const change = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  const { sharedShowsOnly } = settings;

  const applyDefaults = () => {
    // Copied, not shared — the card writes a fresh array today, but handing
    // module state straight into a setter is a trap waiting for the next edit.
    setSettings({ ...DEFAULT_PREFS, pointsPerPosition: [...DEFAULT_PREFS.pointsPerPosition] });
    resetPrefs();
  };

  const sensors = useSensors(useSensor(PointerSensor));

  const removePlayer = (id) => onPlayersChange(players.filter((p) => p.id !== id));

  const handleDragEnd = ({ active, over }) => {
    if (active.id !== over?.id) {
      const oldIndex = players.findIndex((p) => p.id === active.id);
      const newIndex = players.findIndex((p) => p.id === over.id);
      onPlayersChange(arrayMove(players, oldIndex, newIndex));
    }
  };

  const allHaveChars = players.every(
    (p) => p.animeList.reduce((s, a) => s + a.characters.length, 0) > 0
  );
  const hasSharedAnime = players.length < 2 || players.some((p, i) =>
    players.some((other, j) => i !== j &&
      p.animeList.some(a => other.animeList.some(o => normalizeTitle(o.title) === normalizeTitle(a.title))))
  );
  const canStart = players.length >= 2 && allHaveChars && (!sharedShowsOnly || hasSharedAnime);

  const status = players.length < 2 ? 'Add at least 2 players to start.'
    : !allHaveChars ? 'Every player needs at least one character.'
      : sharedShowsOnly && !hasSharedAnime ? 'No two players share a show.'
        : `${players.length} players · drag to set the turn order`;

  const winsEntries = showWins ? Object.entries(getWins()).sort((a, b) => b[1] - a[1]) : [];

  const handleResetWins = () => {
    if (window.confirm('Reset all-time wins? This cannot be undone.')) {
      resetWins();
      setShowWins(false);
    }
  };

  return (
    <>
      <SetupLayout
        game={descriptor}
        tagline="The anime character guessing game"
        onBack={onBack}
        aside={(
          <Button variant="secondary" size="sm" onClick={() => setShowWins(true)}>
            All-Time Leaderboard
          </Button>
        )}
        left={(
          <>
            {/* A picker, not a name box: everyone on this couch is already saved
                on the device, and retyping their name was one typo away from
                seating a brand-new empty profile that looked like theirs.
                Importing a list is per-seat (the pencil) — it has to work for
                someone already seated, which a name box never could. */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={players.map((p) => p.id)} strategy={rectSortingStrategy}>
                <PlayerSlots count={players.length} players={players}>
                  {players.map((p) => (
                    <SortableSlot
                      key={p.id}
                      player={p}
                      isYou={p.id === activeId}
                      onRemove={removePlayer}
                      onGoToList={onGoToList}
                    />
                  ))}
                  <AddPlayerSlot onClick={() => setShowPicker(true)} />
                </PlayerSlots>
              </SortableContext>
            </DndContext>

            {players.length >= 2 && sharedShowsOnly && !hasSharedAnime && (
              <Banner tone="warning" className="mb-5">
                No two players share an anime title — uncheck &quot;Shared shows
                only&quot; or add matching titles.
              </Banner>
            )}
          </>
        )}
        right={<AniGuessSettings values={settings} onChange={change} local onReset={applyDefaults} />}
        start={(
          <StartBar status={status} ready={canStart}>
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                savePrefs(settings);
                onStartGame({ players, settings });
              }}
              disabled={!canStart}
            >
              Start Game
            </Button>
          </StartBar>
        )}
      />

      {showPicker && (
        <ProfilePicker
          mode="add"
          excludeIds={players.map((p) => p.id)}
          onPick={(profile) => onPlayersChange([...players, profile])}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showWins && (
        <Modal onClose={() => setShowWins(false)} width="sm">
          <h2 className="mb-6 font-display text-3xl font-extrabold text-fg-strong">
            All-Time Wins
          </h2>
          {winsEntries.length === 0
            ? <p className="py-4 text-center text-fg-subtle">No games played yet!</p>
            : winsEntries.map(([name, count], i) => (
              <CardRow key={name}>
                <span className="text-lg text-fg-strong">{i === 0 && <><Icon name="crown" label="Most wins" className="text-pop-amber" />{' '}</>}{name}</span>
                <span className="font-display text-xl font-extrabold text-pop-amber">
                  {count} W
                </span>
              </CardRow>
            ))
          }
          <div className="mt-6 flex gap-3">
            <Button variant="neutral" fullWidth onClick={() => setShowWins(false)}>
              Close
            </Button>
            {winsEntries.length > 0 && (
              <Button variant="danger" fullWidth onClick={handleResetWins}>
                Reset
              </Button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
