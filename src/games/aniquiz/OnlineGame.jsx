import { useQuizRoom } from './hooks/useQuizRoom';
import { useFactPack } from '../../shared/hooks/useFactPack';
import { currentClue, requiredIds, wagerLimit } from './rules';
import RoomSetup from '../../shared/components/RoomSetup';
import descriptor from './index';
import { countShows } from '../../shared/utils/profileStats';
import OnlineLobby from './components/OnlineLobby';
import Board from './components/Board';
import ClueCard from './components/ClueCard';
import AnswerEntry from './components/AnswerEntry';
import ClueReveal from './components/ClueReveal';
import Scoreboard from './components/Scoreboard';
import WagerEntry from './components/WagerEntry';
import QuizResults from './components/QuizResults';
import { categoryFor, nextLabel, stakeLabelFor } from './roundText';
import WaitingScreen from '../../shared/components/WaitingScreen';
import RoomShell from '../../shared/components/RoomShell';
import { useSoundCue } from '../../shared/hooks/useSoundCue';
import { Backdrop, Button, Card, HubButton, Screen, TimerBar } from '../../shared/ui';
import WagerBanner from './components/WagerBanner';

// The online view-router. Same shell as every other game's: the room code and
// a way out pinned to the corners, connection problems in a banner, and
// room.view choosing the screen.
//
// Every player answers on their own device, so there is no handoff here — a
// player who has answered sees who the table is still waiting on, and nobody
// sees an answer until the reveal.
export default function OnlineGame({ onBack, onExit }) {
  const room = useQuizRoom();
  const pack = useFactPack();

  // My pick coming round on the board, once per pick: the count of cells
  // already opened moves on with every clue, so it names this pick.
  const g = room.view === 'lobby' ? null : room.game ?? null;
  useSoundCue(
    'turn',
    g?.phase === 'board' && g.pickerId === room.myPlayerId && g.order?.length > 1
      ? Object.keys(g.used ?? {}).length
      : null,
  );

  if (!room.roomCode) {
    return (
      <>
        <HubButton onClick={onExit} />
        <RoomSetup game={descriptor} room={room} onBack={onBack} tone="red" stat={(p) => `${countShows(p)} shows`} />
      </>
    );
  }


  // Every in-room screen goes through RoomShell: the way out, the room code and
  // Leave in the top bar, and the connection banners.
  const shell = (children, opts) => <RoomShell room={room} onExit={onExit} {...opts}>{children}</RoomShell>;

  if (!room.view) return shell(<WaitingScreen title="Loading room…" />);
  if (room.view === 'lobby') return shell(<OnlineLobby room={room} pack={pack} />, { codeInPage: true });

  const { game, deal } = room;
  if (!game || !deal) return shell(<WaitingScreen title="Loading…" />);

  // Seated players only — someone who joined the room but not this game has no
  // score and no seat in the rotation.
  const seated = room.players.filter((p) => game.order.includes(p.id));

  if (room.view === 'results' || game.phase === 'finished') {
    return shell(
      <QuizResults
        players={seated}
        scores={game.scores}
        departedIds={room.departedIds}
        onPlayAgain={room.isHost ? room.returnToLobby : null}
      />,
      // The final results: the host may take the table on to another game.
      { nextGame: true },
    );
  }

  const me = room.myPlayerId;
  const nameOf = (id) => room.players.find((p) => p.id === id)?.name ?? '';
  const clue = currentClue(game, deal);
  const category = categoryFor(game, deal);
  const required = requiredIds(game, room.activeIds);
  const iMustAct = required.includes(me);
  const waitingOn = (done) => required.filter((id) => !done(id)).map(nameOf);
  const clueKey = `${game.round}:${game.cell ?? game.index}`;

  const timer = game.phase === 'answering' && game.deadlineAt != null && (
    <TimerBar className="mb-4" secondsLeft={room.clock.secondsLeft} fraction={room.clock.fraction} label="Time to answer" />
  );

  const waiting = (names) => (
    <Card padding="lg" className="text-center">
      <p className="mb-1 font-display text-xl font-extrabold text-fg-strong">Locked in</p>
      {names.length > 0 && <p className="text-fg-helper">Waiting for {names.join(', ')}…</p>}
    </Card>
  );

  let body;
  if (game.phase === 'board') {
    const mine = game.pickerId === me;
    body = (
      <>
        <h2 className="mb-4 text-center font-display text-2xl font-bold uppercase tracking-wide text-fg-strong sm:text-3xl">
          {mine ? 'Your pick — choose a clue' : `${nameOf(game.pickerId)} is picking…`}
        </h2>
        <Board deal={deal} game={game} canPick={mine} onPick={room.pick} />
      </>
    );
  } else if (game.phase === 'wager') {
    const finalRound = game.round === 'final';
    const placed = game.wagers?.[me] != null;
    body = (
      <>
        <WagerBanner finalRound={finalRound} category={category} />
        {iMustAct && !placed && (
          <Card padding="lg">
            <p className="mb-4 text-center font-display text-xl font-extrabold text-fg-strong">Your wager</p>
            <WagerEntry key={clueKey} limit={wagerLimit(game, me)} onWager={room.wager} />
          </Card>
        )}
        {iMustAct && placed && waiting(waitingOn((id) => game.wagers?.[id] != null))}
        {!iMustAct && (
          <Card padding="lg" className="text-center">
            <p className="text-lg text-fg-body">
              {game.solo ? `${nameOf(game.solo)} found the Daily Double and is placing a wager…` : 'Waiting for wagers…'}
            </p>
          </Card>
        )}
      </>
    );
  } else if (game.phase === 'answering') {
    const answered = Boolean(game.answers?.[me]);
    body = (
      <>
        <ClueCard clue={clue} category={category} stakeLabel={stakeLabelFor(game, deal)} className="mb-6" />
        {timer}
        {iMustAct && !answered && (
          <AnswerEntry key={clueKey} clue={clue} options={clue?.options} pack={pack.pack} onSubmit={room.answer} />
        )}
        {iMustAct && answered && waiting(waitingOn((id) => game.answers?.[id]))}
        {!iMustAct && (
          <Card padding="lg" className="text-center">
            <p className="text-lg text-fg-body">
              {game.solo ? `${nameOf(game.solo)} is answering the Daily Double…` : 'You sat this one out.'}
            </p>
          </Card>
        )}
        {/* The host's escape for an untimed clue somebody has stopped
            answering. A timed clue ends itself, so it never needs this. */}
        {room.isHost && game.deadlineAt == null && Object.keys(game.answers ?? {}).length > 0 && (
          <Button variant="neutral" size="md" fullWidth className="mt-4" onClick={room.revealNow}>
            Reveal now
          </Button>
        )}
      </>
    );
  } else {
    body = (
      <>
        <ClueCard clue={clue} category={category} stakeLabel={stakeLabelFor(game, deal)} className="mb-6" />
        <ClueReveal
          clue={clue}
          players={seated}
          answers={game.answers}
          required={required}
          myId={me}
          staged={game.round === 'final'}
        >
          <Button variant="primary" size="lg" fullWidth onClick={room.next}>
            {nextLabel(game, deal)}
          </Button>
        </ClueReveal>
      </>
    );
  }

  return shell(
    <>
      <Backdrop />
      <Screen width={game.phase === 'board' ? 'lg' : 'md'}>
        <Scoreboard
          players={seated}
          scores={game.scores}
          highlightId={game.phase === 'board' ? game.pickerId : game.solo}
          departedIds={room.departedIds}
          youId={me}
        />
        {body}
      </Screen>
    </>,
  );
}
