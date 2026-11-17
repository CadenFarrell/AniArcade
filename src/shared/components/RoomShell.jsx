import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useCoverGame } from '../context/coverGameContext';
import { HistoryScopeContext } from '../context/historyScopeContext';
import { NextGameSlotContext } from '../context/nextGameContext';
import { useTopBar } from '../context/topBarContext';
import { useConfirm } from '../hooks/useConfirm';
import { Banner, HubButton } from '../ui';
import TablePortraits from './TablePortraits';
import { nightPoints } from '../utils/night';
import { FollowScreen, NextGamePicker } from './NextGame';
import { NightChampion, TonightCard } from './Night';

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
// - Game night (shared/utils/night.js). The same final results screen carries
//   the table's running score above that picker, from its second game on, and
//   the shell is where a finished game becomes a line in it: useRecordResult
//   reports the outcome through the history scope, and the points and the
//   game's name and ink are added here. Once the host ends the night, every
//   device shows NightChampion in place of whatever the room was on.
// Both ways out of a room ask the same question: the room outlives you while
// anyone is still in it (useRoomCore's leaveRoom), so nothing is lost yet.
const LEAVE_ROOM = {
  title: 'Leave the room?',
  message: 'You can rejoin with the same name and room code while anyone is still in it.',
};

export default function RoomShell({ room, onExit, codeInPage = false, nextGame = false, children }) {
  const bar = useTopBar();
  // Results are recorded on each player's own device (useRecordResult), and
  // each device also reports the game to the table's night — the room keeps
  // one line however many report it. The open game's title and ink ride along
  // (CoverGameContext is the hub's; absent in a test, the id stands in).
  const cover = useCoverGame();
  const recordNight = room.handoff?.recordNight ?? null;
  const historyScope = useMemo(() => ({
    onlyId: room.myPlayerId ?? null,
    night: recordNight ? ({ game, table, winnerIds, places }) => {
      const results = nightPoints({ table, winnerIds, places });
      if (!results) return;
      const named = cover?.id === game ? { title: cover.title, accent: cover.accent } : {};
      // Best effort: a night that misses a line is a smaller loss than a
      // results screen that reports an error about something it never showed.
      recordNight({ game, ...named, results }).catch(() => {});
    } : null,
  }), [room.myPlayerId, recordNight, cover]);
  const next = room.handoff?.next ?? null;
  const following = next != null && next.by !== room.myPlayerId;
  // The host called the night: the champion takes the screen, on every device
  // and the host's own. A pick already in flight still wins — the table is
  // mid-move, and the night goes with it.
  const nightOver = !following && Boolean(room.handoff?.night?.ended);
  // Leave asks on the game's pause screen, as Hub does (HubButton): rendered
  // below in the shell, never in the bar's portal, whose backdrop-blur would
  // trap the fixed sheet inside the bar.
  const { ask, dialog } = useConfirm();

  const handleLeave = () => ask({
    kind: 'pause',
    title: LEAVE_ROOM.title,
    message: LEAVE_ROOM.message,
    confirmLabel: 'Leave the room',
    onConfirm: () => room.leaveRoom(),
  });

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
      <HubButton onClick={handleExitToHub} confirm={LEAVE_ROOM} />
      {dialog}
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
          {following && <FollowScreen room={room} next={next} />}
          {nightOver && <NightChampion room={room} />}
          {!following && !nightOver && (
            <NextGameSlotContext.Provider
              value={nextGame ? <><TonightCard room={room} /><NextGamePicker room={room} /></> : null}
            >
              {children}
            </NextGameSlotContext.Provider>
          )}
        </TablePortraits>
      </HistoryScopeContext.Provider>
    </div>
  );
}
