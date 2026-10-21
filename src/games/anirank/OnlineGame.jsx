import { useState } from 'react';
import { useAniRankRoom } from './hooks/useAniRankRoom';
import RoomSetup from '../../shared/components/RoomSetup';
import { countShows } from '../../shared/utils/profileStats';
import OnlineLobby from './components/OnlineLobby';
import RoomTiers from './RoomTiers';
import AniRankResults from './components/AniRankResults';
import RankBoard, { CardTray, CurrentItem, LockInButton, WaitingOn } from './components/RankBoard';
import RankSeats from './components/RankSeats';
import { isOpinion, promptFor } from './axes';
import WaitingScreen from '../../shared/components/WaitingScreen';
import RoomShell from '../../shared/components/RoomShell';
import { Backdrop, GhostButton, HubButton, Icon, Screen } from '../../shared/ui';

// The online view-router. Same shape as src/games/anitune/OnlineGame.jsx: a
// shell() wraps every in-room screen with the room code, a way out and the
// sync-error banner, and room.view picks the screen.
export default function OnlineGame({ onBack, onExit }) {
  const room = useAniRankRoom();

  // Which tray card this device has picked up in an open round. Deliberately
  // local state and never written to the room: it is a half-finished thought,
  // and everything under state/ is readable by every member.
  const [selectedId, setSelectedId] = useState(null);

  // Drop it whenever the room changes screen, so a card held over from the last
  // round is not still selected in the next one. Adjusted during render rather
  // than in an effect: React re-runs this component before committing, so no
  // cascading render — the effect version is what the lint rule forbids.
  const [seenView, setSeenView] = useState(room.view);
  if (seenView !== room.view) {
    setSeenView(room.view);
    setSelectedId(null);
  }

  if (!room.roomCode) {
    return (
      <>
        <HubButton onClick={onExit} />
        <RoomSetup
          room={room}
          onBack={onBack}
          tone="amber"
          stat={(p) => `${countShows(p)} shows`}
        />
      </>
    );
  }



  // Every in-room screen goes through RoomShell: the way out, the room code and
  // Leave in the top bar, and the connection banners.
  const shell = (children, opts) => <RoomShell room={room} onExit={onExit} {...opts}>{children}</RoomShell>;

  if (!room.view) {
    return shell(<WaitingScreen title="Loading room…" />);
  }

  if (room.view === 'lobby') {
    return shell(<OnlineLobby room={room} />, { codeInPage: true });
  }

  // The room's other half. No `room.game` guard, unlike every branch below:
  // there is no round here, and startCompare explicitly nulls `game`.
  if (room.view === 'tiers') {
    return shell(<RoomTiers room={room} />);
  }

  if (room.view === 'round' && room.game) {
    const { open } = room;
    // In an open round "done" means locked in, not "placed the current card".
    const committed = open ? room.iHaveLockedIn : room.iHavePlaced;
    // The whole deck, not the tray — a card lifted back off the board is held
    // but no longer in the tray. See the same note in AniRankRound.
    const selectedItem = room.deck.find((c) => c.id === selectedId) ?? null;

    const handlePlace = (slotIndex) => {
      if (!open) return room.place(slotIndex);
      if (!selectedId) return;
      room.placeCard(selectedId, slotIndex);
      setSelectedId(null);
    };

    // Tapping a filled slot: put down what you are holding (swapping the two),
    // or lift this one out if your hands are empty.
    const handlePickUp = (slotIndex) => {
      const card = room.myBoard[slotIndex];
      if (!card) return;
      if (selectedId === card.id) return setSelectedId(null);
      if (selectedId) {
        room.placeCard(selectedId, slotIndex);
        return setSelectedId(null);
      }
      setSelectedId(card.id);
    };

    return shell(
      <>
        <Backdrop />
        <Screen width="md">
          {/* The table as faces, like every other game's round: who is still
              placing, who has locked in, who left (dimmed). No NOW — online
              everyone places at once. */}
          <RankSeats
            players={room.players}
            pendingIds={room.pendingIds}
            youId={room.myPlayerId}
            subjectId={isOpinion(room.axis) ? room.subjectId : null}
            open={open}
            scores={room.scoring ? room.totalScores : null}
            departedIds={room.departedIds}
          />

          {open
            ? !committed && (
              <CardTray items={room.tray} selectedId={selectedId} onSelect={setSelectedId} />
            )
            : <CurrentItem item={room.item} index={room.cursor} total={room.deck.length} />}

          <p className="mb-2 text-center text-base font-bold text-fg-strong">
            {/* The subject ranks for real — they are the answer key, so telling
                them to guess at themselves would be nonsense. */}
            {isOpinion(room.axis) && room.subjectId === room.myPlayerId
              ? 'You’re the subject — rank these honestly. Everyone else is guessing at you.'
              : promptFor(room.axis, room.subject?.name ?? 'they')}
          </p>

          {committed ? (
            <>
              <p className="mb-2 text-center font-display text-lg font-extrabold text-pop-lime">
                Locked in <Icon name="check" />
              </p>
              <WaitingOn names={room.pendingNames} />
            </>
          ) : (
            <p className="mb-4 text-center text-base text-fg-helper">
              {open
                ? 'Tap a card then a slot. Tap two slots to swap them — nothing counts until you lock in.'
                : 'Pick a slot. Once it is placed it cannot be moved.'}
            </p>
          )}

          <RankBoard
            board={room.myBoard}
            item={open ? selectedItem : room.item}
            selectedId={open ? selectedId : null}
            disabled={committed}
            topLabel={room.axis.topLabel}
            bottomLabel={room.axis.bottomLabel}
            onPlace={handlePlace}
            onClear={open ? room.clearSlot : undefined}
            onPickUp={open ? handlePickUp : undefined}
          />

          {open && !committed && (
            <LockInButton
              ready={room.boardFull}
              onLockIn={() => { room.lockIn(); setSelectedId(null); }}
            />
          )}
        </Screen>
      </>
    );
  }

  if (room.view === 'results' && room.game) {
    return shell(
      <AniRankResults
        players={room.players}
        boards={room.game.boards}
        deck={room.deck}
        axis={room.axis}
        subjectId={room.subjectId}
        scoring={room.scoring}
        totalScores={room.totalScores}
        // Online only: totalScores is the running room total, so without this a
        // player cannot tell what the round they just finished was worth.
        roundScores={room.roundScores}
        departedIds={room.departedIds}
        onPlayAgain={room.returnToLobby}
        playAgainLabel="Back to lobby"
      />
    );
  }

  return shell(<WaitingScreen title="Loading…" />);
}
