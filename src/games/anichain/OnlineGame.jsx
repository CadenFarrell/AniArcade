import { useChainRoom } from './hooks/useChainRoom';
import { useFactPack } from '../../shared/hooks/useFactPack';
import RoomSetup from '../../shared/components/RoomSetup';
import RoomShell from '../../shared/components/RoomShell';
import WaitingScreen from '../../shared/components/WaitingScreen';
import { useSoundCue } from '../../shared/hooks/useSoundCue';
import { countCharacters } from '../../shared/utils/profileStats';
import { HubButton } from '../../shared/ui';
import OnlineLobby from './components/OnlineLobby';
import OnlineRound from './components/OnlineRound';
import AniChainResults from './components/AniChainResults';
import { nextGiver, turnNo } from './rules';
import descriptor from './index';

// The online view-router, the same shell as every other game's: RoomShell for
// the way out, the code and the connection banners, and room.view choosing
// the screen. Every phone draws the same OnlineRound; who you are only
// changes its bottom bar.
export default function OnlineGame({ onBack, onExit }) {
  const pack = useFactPack();
  const room = useChainRoom(pack.pack);
  const { game } = room;
  const me = room.myPlayerId;

  // My go coming round — my word to add — once per word.
  const chain = room.view === 'round' && game?.phase === 'chain' ? game : null;
  useSoundCue('turn', chain && nextGiver(chain) === me && chain.chain.length < chain.cap ? `${turnNo(chain)}:${chain.chain.length}` : null);
  // A turn landing that is not mine to celebrate: the reveal sound (mine plays
  // through ResultImpact, with the frame).
  const over = room.view === 'round' && game?.phase === 'over' ? game : null;
  useSoundCue('reveal', over && over.result?.by !== me ? `${turnNo(over)}` : null);

  if (!room.roomCode) {
    return (
      <>
        <HubButton onClick={onExit} />
        <RoomSetup game={descriptor} room={room} onBack={onBack} tone="violet" stat={(p) => `${countCharacters(p)} characters`} />
      </>
    );
  }

  const shell = (children, opts) => <RoomShell room={room} onExit={onExit} {...opts}>{children}</RoomShell>;

  if (!room.view) return shell(<WaitingScreen title="Loading room…" />);
  if (room.view === 'lobby') return shell(<OnlineLobby room={room} pack={pack} />, { codeInPage: true });
  if (!game) return shell(<WaitingScreen title="Loading…" />);

  if (room.view === 'results' || game.phase === 'finished') {
    return shell(
      <AniChainResults
        game={game}
        players={room.seatedPlayers}
        departedIds={room.departedIds}
        onPlayAgain={room.isHost ? room.returnToLobby : null}
        againLabel="Back to lobby"
      />,
      // The final results: the host may take the table on to another game.
      { nextGame: true },
    );
  }

  return shell(<OnlineRound room={room} />);
}
