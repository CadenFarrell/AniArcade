import { useEffect, useState } from 'react';
import { useAniRankRound } from '../hooks/useAniRankRound';
import RankBoard, { CardTray, CurrentItem, LockInButton } from './RankBoard';
import { isOpinion, promptFor } from '../axes';
import { Backdrop, GhostButton, Screen } from '../../../shared/ui';
import RoundHeader from '../../../shared/components/RoundHeader';
import RankSeats from './RankSeats';

// Local round orchestration: hands the pure round hook to the board, and calls
// onFinish once the round is over.
//
// onQuit drops back to setup, and that is all it does. It used to be wired to a
// "Hub" button here as well, which is why that button spent a release
// returning to setup instead of the hub; leaving the game is now LocalGame's
// one fixed Hub button, over every local view.
export default function AniRankRound({
  players, deck, axis: axisSpec, subjectId, scoring, blind, totalScores, onFinish, onQuit,
}) {
  const round = useAniRankRound(players, deck, { axis: axisSpec, subjectId, scoring, blind });
  const { finished, state, scores, axis, open } = round;
  const subject = players.find((p) => p.id === subjectId) ?? null;

  // Which tray card is picked up. Lives here rather than in the hook because it
  // is a property of this device's UI, not of the round — nothing about it needs
  // to survive, and online it must never reach the room.
  const [selectedId, setSelectedId] = useState(null);
  const placerId = round.currentPlacer?.id;

  // Drop the pick-up when the device changes hands, so the next player does not
  // start holding a card the last one had selected. Adjusted during render, not
  // in an effect — the effect version cascades a second render and is what the
  // react-hooks/set-state-in-effect rule forbids.
  const [seenPlacer, setSeenPlacer] = useState(placerId);
  if (seenPlacer !== placerId) {
    setSeenPlacer(placerId);
    setSelectedId(null);
  }

  // Reporting the result during render would set state on the parent mid-render;
  // an effect is the seam between "the round is over" and "show the results".
  useEffect(() => {
    if (finished) onFinish({ boards: state.boards, scores });
    // onFinish is a fresh closure each render — depending on it would re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (finished) return null;

  // Resolved against the whole deck, not the tray: a card lifted back off the
  // board is held but no longer in the tray, and looking it up there would make
  // the board think nothing was picked up.
  const selectedItem = deck.find((c) => c.id === selectedId) ?? null;
  const isSubject = isOpinion(axis) && placerId === subjectId;

  const handlePlace = (slotIndex) => {
    if (!open) return round.place(slotIndex);
    if (!selectedId) return;
    round.placeCard(selectedId, slotIndex);
    setSelectedId(null);
  };

  // Tapping a filled slot: put down what you are holding (swapping the two), or
  // lift this one out if your hands are empty.
  const handlePickUp = (slotIndex) => {
    const card = round.board[slotIndex];
    if (!card) return;
    if (selectedId === card.id) return setSelectedId(null);   // tap again to put it back down
    if (selectedId) {
      round.placeCard(selectedId, slotIndex);
      return setSelectedId(null);
    }
    setSelectedId(card.id);
  };

  return (
    <>
      <Backdrop />
      <Screen width="md">
        {/* Whose turn as the screen's heading (it had none — the bots filed it
            as "no heading"), how far round the table it has got as the tab, and
            what is being asked as the hint. The subject ranks for real — they
            are the answer key, so telling them to guess at themselves would be
            nonsense. */}
        <RoundHeader
          title={`${round.currentPlacer?.name ?? ''}’s turn`}
          tag={`${round.placedThisItem}/${players.length} ${open ? 'locked in' : 'placed'}`}
          hint={isSubject
            ? `Your turn, ${subject?.name ?? ''} — rank these honestly. Everyone else is guessing at you.`
            : promptFor(axis, subject?.name ?? 'they')}
        />

        <RankSeats
          players={players}
          pendingIds={round.pendingIds}
          activeId={placerId}
          subjectId={isOpinion(axis) ? subjectId : null}
          open={open}
          scores={scoring ? totalScores ?? {} : null}
        />

        {open
          ? <CardTray items={round.tray} selectedId={selectedId} onSelect={setSelectedId} />
          : <CurrentItem item={round.item} index={round.cursor} total={deck.length} />}

        <p className="mb-4 text-center text-sm text-fg-helper">
          {open
            ? players.length > 1
              ? 'Tap a card then a slot. Tap two slots to swap them. Lock in when you’re happy and pass the device on.'
              : 'Tap a card then a slot. Tap two slots to swap them — nothing counts until you lock in.'
            : players.length > 1
              ? 'Pass the device round — everyone places this card before the next is revealed.'
              : 'Pick a slot. Once it is placed it cannot be moved.'}
        </p>

        <RankBoard
          board={round.board}
          item={open ? selectedItem : round.item}
          selectedId={open ? selectedId : null}
          topLabel={axis.topLabel}
          bottomLabel={axis.bottomLabel}
          onPlace={handlePlace}
          onClear={open ? round.clearSlot : undefined}
          onPickUp={open ? handlePickUp : undefined}
        />

        {open && (
          <LockInButton
            ready={round.boardFull}
            onLockIn={() => { round.lockIn(); setSelectedId(null); }}
          />
        )}

        <div className="text-center">
          <GhostButton onClick={onQuit}>← Quit round</GhostButton>
        </div>
      </Screen>
    </>
  );
}
