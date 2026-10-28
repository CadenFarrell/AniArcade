import { useMemo } from 'react';
import { useOutRoom } from './hooks/useOutRoom';
import { useFactPack } from '../../shared/hooks/useFactPack';
import RoomSetup from '../../shared/components/RoomSetup';
import RoomShell from '../../shared/components/RoomShell';
import WaitingScreen from '../../shared/components/WaitingScreen';
import { useSoundCue } from '../../shared/hooks/useSoundCue';
import { countCharacters } from '../../shared/utils/profileStats';
import { HubButton } from '../../shared/ui';
import OnlineLobby from './components/OnlineLobby';
import OutRound from './components/OutRound';
import AniOutResults from './components/AniOutResults';
import descriptor from './index';

// The online view-router, the same shell as every other game's: RoomShell for
// the way out, the code and the connection banners, and room.view choosing
// the screen. Every phone draws the same OutRound; each picks for its own seat
// until it has locked in.
export default function OnlineGame({ onBack, onExit }) {
  const room = useOutRoom();
  const pack = useFactPack();
  // Seated players only — someone who joined the room but not this game has
  // no score and no pick to wait for.
  const order = room.game?.order;
  const table = useMemo(
    () => (order ? room.players.filter((p) => order.includes(p.id)) : []),
    [room.players, order],
  );

  // The cards arriving: a new round on every phone, once per round.
  const me = room.myPlayerId;
  const game = room.view === 'round' ? room.game : null;
  useSoundCue('turn', game?.phase === 'picking' ? `${game.round}` : null);

  if (!room.roomCode) {
    return (
      <>
        <HubButton onClick={onExit} />
        <RoomSetup game={descriptor} room={room} onBack={onBack} tone="moss" stat={(p) => `${countCharacters(p)} characters`} />
      </>
    );
  }

  const shell = (children, opts) => <RoomShell room={room} onExit={onExit} {...opts}>{children}</RoomShell>;

  if (!room.view) return shell(<WaitingScreen title="Loading room…" />);
  if (room.view === 'lobby') return shell(<OnlineLobby room={room} pack={pack} />, { codeInPage: true });

  const { deal } = room;
  const current = room.game;
  if (!current || !deal) return shell(<WaitingScreen title="Loading…" />);

  if (room.view === 'results' || current.phase === 'finished') {
    return shell(
      <AniOutResults
        players={table}
        scores={current.scores}
        departedIds={room.departedIds}
        onPlayAgain={room.isHost ? room.returnToLobby : null}
        againLabel="Back to lobby"
      />,
      // The final results: the host may take the table on to another game.
      { nextGame: true },
    );
  }

  const seated = current.order.includes(me);
  return shell(
    <OutRound
      game={current}
      deal={deal}
      players={table}
      departedIds={room.departedIds}
      youId={me}
      pickerId={seated && current.phase === 'picking' && !current.picks?.[me] ? me : null}
      onPick={room.pick}
      onNext={room.next}
    />,
  );
}
