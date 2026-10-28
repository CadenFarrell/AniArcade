import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { HistoryScopeContext } from '../context/historyScopeContext';
import { NextGameSlotContext } from '../context/nextGameContext';
import { useTopBar } from '../context/topBarContext';
import { Banner, HubButton } from '../ui';
import TablePortraits from './TablePortraits';
import { FollowScreen, NextGamePicker } from './NextGame';

// Wraps every in-room screen so connection problems and the way out are always
// reachable, whatever phase the game is in.
//
// One copy for every game. It used to be a `shell()` function hand-copied into
// all seven OnlineGame.jsx files, and the copies had already drifted: AniTag's
// showed the room code on phones (the others hid it on precisely the device most
// likely to be handed to somebody who has to type it in) and capped the
// disconnect banners at two (the others stacked one per dropped player over the
// screen's own header). Both fixes are the behaviour here, for every game.
//
// What it puts where:
// - HubButton — leaving to the hub leaves the room. The room itself survives
//   while anyone else is still in it, so rejoining with the same name and code
//   picks the game back up; the last one out deletes it (useRoomCore's
//   leaveRoom).
// - The room code and Leave go into the top bar's right slot. Leave stays in
//   the room's flow (back to the join screen); Hub leaves the game entirely.
//   `codeInPage` drops the bar's code while the screen draws its own: the
//   lobby's banner carries a big `RoomCode` chip, the one a host reads aloud,
//   and the same five characters twice on one screen read as two codes. Past
//   the lobby the bar's small one is the only one, for a late joiner to ask.
// - The banners sit just under the bar, centred, over the screen.
// - Next game, same table (shared/utils/handoff.js). `nextGame` marks a FINAL
//   results screen, which then carries the host's picker (ResultsLayout draws
//   it, through NextGameSlotContext). Once a pick is in, every device but the
//   host's shows FollowScreen in place of whatever the room was on, whatever
//   the view, and moves on by itself when the new room's code lands.
export default function RoomShell({ room, onExit, codeInPage = false, nextGame = false, children }) {
  const bar = useTopBar();
  // Results are recorded on each player's own device (useRecordResult).
  const historyScope = useMemo(() => ({ onlyId: room.myPlayerId ?? null }), [room.myPlayerId]);
  const next = room.handoff?.next ?? null;
  const following = next != null && next.by !== room.myPlayerId;

  const handleLeave = () => {
    if (!window.confirm('Leave this room? You can rejoin with the same name and room code while anyone is still in it.')) return;
    room.leaveRoom();
  };

  const handleExitToHub = () => {
    room.leaveRoom();
    onExit();
  };

  const roomControls = (
    <>
      {!codeInPage && (
        <span
          className="rounded-pop-sm border-2 border-dashed border-line-loud px-2 py-1 font-display text-sm
            font-bold tracking-[0.2em] text-fg-strong"
          title="Room code"
        >
          <span className="sr-only">Room code </span>
          {room.roomCode}
        </span>
      )}
      <button
        type="button"
        onClick={handleLeave}
        className="focus-pop h-10 rounded-pop-sm border-2 border-ink bg-surface px-3 font-display text-sm
          font-bold uppercase tracking-wider text-fg-strong transition-colors hover:bg-ink hover:text-paper"
      >
        Leave
      </button>
    </>
  );

  return (
    <div className="relative">
      <HubButton
        onClick={handleExitToHub}
        confirm="Leave this room and return to the hub? You can rejoin with the same name and room code while anyone is still in it."
      />
      {bar
        ? bar.right && createPortal(roomControls, bar.right)
        // No bar (a game mounted on its own, as in a component test): the
        // controls place themselves where the bar's right end would be.
        : <div className="fixed top-2 right-2 z-40 flex items-center gap-2">{roomControls}</div>}

      <div className="fixed top-16 left-1/2 z-40 flex w-[calc(100%-1.5rem)] max-w-md
        -translate-x-1/2 flex-col gap-2">
        {room.syncError && (
          <Banner tone="danger" onDismiss={room.dismissSyncError} className="shadow-pop-sm">
            {room.syncError}
          </Banner>
        )}
        {/* Says out loud why the round has paused, and for how much longer, so
            a dropped player doesn't just look like a frozen game.
            CAPPED AT TWO: this is a fixed overlay sitting on top of the screen's
            own header, so an unbounded stack of them covers the thing the table
            is trying to read. Three people dropping at once is one fact anyway. */}
        {room.dropping.slice(0, 2).map(({ player, remainingMs }) => (
          <Banner key={player.id} tone="warning" className="shadow-pop-sm">
            {player.name} disconnected — waiting {Math.ceil(remainingMs / 1000)}s…
          </Banner>
        ))}
        {room.dropping.length > 2 && (
          <Banner tone="warning" className="shadow-pop-sm">
            …and {room.dropping.length - 2} more disconnected.
          </Banner>
        )}
      </div>
      {/* The table's faces for every in-room screen — turn strip, results — in
          the room's own seat order (useRoomCore's roster; AniGuess keeps its
          roster under gameSession). The lobby's slots share out their own. */}
      <HistoryScopeContext.Provider value={historyScope}>
        <TablePortraits players={room.players ?? room.gameSession?.players}>
          {following ? <FollowScreen room={room} next={next} /> : (
            <NextGameSlotContext.Provider value={nextGame ? <NextGamePicker room={room} /> : null}>
              {children}
            </NextGameSlotContext.Provider>
          )}
        </TablePortraits>
      </HistoryScopeContext.Provider>
    </div>
  );
}
