import { useDraftRoom } from './hooks/useDraftRoom';
import RoomSetup from '../../shared/components/RoomSetup';
import RoomShell from '../../shared/components/RoomShell';
import WaitingScreen from '../../shared/components/WaitingScreen';
import { useSoundCue } from '../../shared/hooks/useSoundCue';
import { countCharacters } from '../../shared/utils/profileStats';
import { HubButton } from '../../shared/ui';
import OnlineLobby from './components/OnlineLobby';
import OnlineRound from './components/OnlineRound';
import AniDraftResults from './components/AniDraftResults';
import { currentPicker } from './rules';
import descriptor from './index';

// The online view-router, the same shell as every other game's: RoomShell for
// the way out, the code and the connection banners, and room.view choosing
// the screen. Every phone draws the same OnlineRound; who you are only
// changes what it lets you press.
export default function OnlineGame({ onBack, onExit }) {
  const room = useDraftRoom();
  const { game } = room;
  const me = room.myPlayerId;

  // My pick coming round, once per pick.
  const draft = room.view === 'round' && game?.phase === 'draft' ? game : null;
  useSoundCue('turn', draft && currentPicker(draft) === me ? `${draft.round}:${draft.picks.length}` : null);
  // A role turned over: the same moment on every phone.
  const reveal = room.view === 'round' && game?.phase === 'reveal' && game.shown > 0 ? game : null;
  useSoundCue('reveal', reveal ? `${reveal.round}:${reveal.shown}` : null);

  if (!room.roomCode) {
    return (
      <>
        <HubButton onClick={onExit} />
        <RoomSetup game={descriptor} room={room} onBack={onBack} tone="magenta" stat={(p) => `${countCharacters(p)} characters`} />
      </>
    );
  }

  const shell = (children, opts) => <RoomShell room={room} onExit={onExit} {...opts}>{children}</RoomShell>;

  if (!room.view) return shell(<WaitingScreen title="Loading room…" />);
  if (room.view === 'lobby') return shell(<OnlineLobby room={room} />, { codeInPage: true });
  if (!game) return shell(<WaitingScreen title="Loading…" />);

  if (room.view === 'results' || game.phase === 'finished') {
    return shell(
      <AniDraftResults
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
