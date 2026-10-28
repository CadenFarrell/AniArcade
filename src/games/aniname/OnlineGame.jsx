import { useMemo } from 'react';
import { useNameRoom } from './hooks/useNameRoom';
import { useFactPack } from '../../shared/hooks/useFactPack';
import RoomSetup from '../../shared/components/RoomSetup';
import RoomShell from '../../shared/components/RoomShell';
import WaitingScreen from '../../shared/components/WaitingScreen';
import { useSoundCue } from '../../shared/hooks/useSoundCue';
import { countCharacters } from '../../shared/utils/profileStats';
import { HubButton } from '../../shared/ui';
import OnlineLobby from './components/OnlineLobby';
import NameRound from './components/NameRound';
import AniNameResults from './components/AniNameResults';
import descriptor from './index';

// The online view-router, the same shell as every other game's: RoomShell for
// the way out, the code and the connection banners, and room.view choosing
// the screen. Every phone draws the same NameRound; only the seat whose move it
// is gets controls.
export default function OnlineGame({ onBack, onExit }) {
  const pack = useFactPack();
  const room = useNameRoom(pack.pack);
  // Seated players only — someone who joined the room but not this game has
  // no score and no seat in the auction.
  const order = room.game?.order;
  const table = useMemo(
    () => (order ? room.players.filter((p) => order.includes(p.id)) : []),
    [room.players, order],
  );

  // My move coming round — my turn to bid, or my bid won — once per move.
  const me = room.myPlayerId;
  const game = room.view === 'round' ? room.game : null;
  const myTurn = game && ((game.phase === 'bidding' && game.turnId === me) || (game.phase === 'naming' && game.bid?.by === me));
  useSoundCue('turn', myTurn ? `${game.round}:${game.phase}:${game.bid?.n ?? ''}` : null);
  // Someone else's round landing: the reveal sound (mine plays through
  // ResultImpact, with the frame).
  const othersReveal = game?.phase === 'revealed' && game.result && game.result.by !== me;
  useSoundCue('reveal', othersReveal ? `${game.round}` : null);

  if (!room.roomCode) {
    return (
      <>
        <HubButton onClick={onExit} />
        <RoomSetup game={descriptor} room={room} onBack={onBack} tone="umber" stat={(p) => `${countCharacters(p)} characters`} />
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
      <AniNameResults
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

  return shell(
    <NameRound
      game={current}
      deal={deal}
      players={table}
      index={room.index}
      clock={room.clock}
      departedIds={room.departedIds}
      youId={me}
      canActAs={(id) => id === me}
      judgeAs={me}
      onBid={room.bid}
      onPass={room.pass}
      onName={room.name}
      onDone={room.done}
      onJudge={room.judge}
      onNext={room.next}
    />,
  );
}
