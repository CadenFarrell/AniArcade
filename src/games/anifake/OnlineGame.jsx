import { useMemo } from 'react';
import { useAniFakeRoom } from './hooks/useAniFakeRoom';
import { eligibleCharacters } from './utils/pool';
import RoomSetup from '../../shared/components/RoomSetup';
import { countCharacters } from '../../shared/utils/profileStats';
import OnlineLobby from './components/OnlineLobby';
import CardCheck from './components/CardCheck';
import ClueRound from './components/ClueRound';
import VoteScreen from './components/VoteScreen';
import StealScreen from './components/StealScreen';
import AniFakeResults from './components/AniFakeResults';
import WaitingScreen from '../../shared/components/WaitingScreen';
import { MAX_DEALS } from './rules';
import RoomShell from '../../shared/components/RoomShell';
import { HubButton } from '../../shared/ui';
import { useSoundCue } from '../../shared/hooks/useSoundCue';


// The online view-router. Same shape as src/games/anirank/OnlineGame.jsx: a
// shell() wraps every in-room screen with the room code, a way out and the
// sync-error banner, and room.view picks the screen.
export default function OnlineGame({ onBack, onExit }) {
  const room = useAniFakeRoom();

  // What the caught fake's search box offers. Over the FULL roster, not
  // room.activePlayers: the pool was dealt from the roster as it stood at
  // startGame, so filtering to who is still here could drop the very list the
  // secret came from. Hoisted above the early returns because the screen that
  // needs it is behind three of them.
  const searchable = useMemo(
    () => eligibleCharacters(room.players, { sharedOnly: false }),
    [room.players]
  );

  // My clue coming round (once per clue: the count of clues given names the
  // moment), and the accusation landing on the fake — the steal screen is the
  // first any phone learns the vote caught them, so every phone stings.
  useSoundCue(
    'turn',
    room.view === 'clues' && room.isMyTurn ? `${room.lap}:${room.clues?.length ?? 0}` : null,
  );
  useSoundCue('reveal', room.view === 'steal' ? `steal:${room.caught}` : null);

  if (!room.roomCode) {
    return (
      <>
        <HubButton onClick={onExit} />
        <RoomSetup
          room={room}
          onBack={onBack}
          tone="teal"
          stat={(p) => `${countCharacters(p)} characters`}
        />
      </>
    );
  }



  // Leaving from inside a round's own screens leaves the room too, exactly as
  // the bar's Hub does (RoomShell owns that one).
  const handleExitToHub = () => {
    room.leaveRoom();
    onExit();
  };

  // Every in-room screen goes through RoomShell: the way out, the room code and
  // Leave in the top bar, and the connection banners.
  const shell = (children, opts) => <RoomShell room={room} onExit={onExit} {...opts}>{children}</RoomShell>;

  if (!room.view) return shell(<WaitingScreen title="Loading room…" />);

  if (room.view === 'lobby') return shell(<OnlineLobby room={room} />, { codeInPage: true });

  if (room.view === 'check' && room.game) {
    return shell(
      <CardCheck
        card={room.card}
        phase={room.checkPhase}
        responded={room.myCheckResponse}
        pendingNames={room.checkPendingNames}
        dealNumber={room.dealNumber}
        maxDeals={MAX_DEALS}
        onConfirm={() => room.respondToCheck(false)}
        onRedeal={() => room.respondToCheck(true)}
      />
    );
  }

  if (room.view === 'clues' && room.game) {
    return shell(
      <ClueRound
        clues={room.clues}
        players={room.seatedPlayers}
        speaker={room.speaker}
        isMyTurn={room.isMyTurn}
        card={room.card}
        wordLimit={room.wordLimit}
        lap={room.lap}
        laps={room.laps}
        onSubmit={room.submitClue}
        onQuit={handleExitToHub}
      />
    );
  }

  if (room.view === 'vote' && room.game) {
    return shell(
      <VoteScreen
        players={room.seatedPlayers}
        voter={room.seatedPlayers.find((p) => p.id === room.myPlayerId) ?? null}
        voted={room.votedIds}
        // The players the ballot is genuinely waiting on, so a closed tab does
        // not leave the count stuck one short of a total nobody will reach.
        voterIds={room.activeIds}
        departedIds={room.departedIds}
        clues={room.clues}
        myVote={room.myVote}
        isRunoff={room.isRunoff}
        runoffCandidates={room.runoffCandidates}
        onVote={room.castVote}
      />
    );
  }

  if (room.view === 'steal' && room.game) {
    // Only the accused reaches this with a steal to make; everyone else gets
    // the waiting half of the same screen. Reaching this view at all means the
    // accused WAS the fake — their own device is the only one that could have
    // set it — so naming them here gives nothing away that the next screen
    // won't.
    const isMine = Boolean(room.card?.isFake);
    const accused = room.players.find((p) => p.id === room.caught);
    return shell(
      <StealScreen
        isMine={isMine}
        fakeName={accused?.name ?? 'The fake'}
        options={searchable}
        onSteal={room.submitSteal}
      />
    );
  }

  if (room.view === 'reveal') {
    // The publish window: every device is writing its own card into the round
    // right now, and the answer is only reconstructible once they land.
    return shell(<WaitingScreen title="Turning the cards over…" />);
  }

  if (room.view === 'results' && room.game) {
    return shell(
      <AniFakeResults
        players={room.seatedPlayers}
        game={room.game}
        fakeId={room.fakeId}
        secret={room.secret}
        fakeCard={room.fakeCard}
        roundScores={room.roundScores}
        totalScores={room.totalScores}
        departedIds={room.departedIds}
        onPlayAgain={room.returnToLobby}
        playAgainLabel="Back to lobby"
      />
    );
  }

  return shell(<WaitingScreen title="Loading…" />);
}
