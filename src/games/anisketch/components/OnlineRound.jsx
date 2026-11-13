import { Button, Card, TimerBar } from '../../../shared/ui';
import ChoosePanel from './ChoosePanel';
import DrawingBoard from './DrawingBoard';
import { GuessBar, GuessFeed } from './Guesses';
import SketchCanvas from './SketchCanvas';
import TurnFrame from './TurnFrame';
import TurnReveal from './TurnReveal';

// One turn on one phone. Who you are only changes what the screen lets you
// do: the drawer picks, then draws with the toolbar (the character's name in
// their own header — nobody else sees this phone); everyone else watches the
// drawing grow and types guesses. The feed is the same for all.
export default function OnlineRound({ room }) {
  const { game, amDrawer, sketch } = room;
  const players = room.seatedPlayers;
  const me = room.myPlayerId;
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const drawerName = nameOf(game.drawer);
  const frameProps = { game, players, youId: me, departedIds: room.departedIds };

  if (game.phase === 'choosing') {
    if (amDrawer) {
      return (
        <TurnFrame {...frameProps} title="Pick What to Draw" hint="One of these, off your own list. The clock starts when you pick.">
          <ChoosePanel choices={room.choices} onChoose={room.choose} />
        </TurnFrame>
      );
    }
    return (
      <TurnFrame {...frameProps} title={`${drawerName} Is Choosing`} hint="Get ready to guess.">
        <Card padding="lg" className="text-center"><p className="text-fg-body">{drawerName} is picking a character to draw…</p></Card>
      </TurnFrame>
    );
  }

  const clock = <TimerBar secondsLeft={room.clock.secondsLeft} fraction={room.clock.fraction} label="Drawing time" />;

  if (game.phase === 'drawing') {
    if (amDrawer) {
      return (
        <TurnFrame
          {...frameProps}
          title="Draw!"
          hint={room.character ? `Draw ${room.character.name}. No letters, no words.` : 'No letters, no words.'}
          clock={clock}
        >
          <DrawingBoard key={game.turn} sketch={sketch} />
          <GuessFeed game={game} players={players} youId={me} />
          <Button variant="secondary" fullWidth onClick={room.giveUp}>Give up</Button>
        </TurnFrame>
      );
    }
    const mine = game.got?.[me];
    const waiting = game.guesses.some((g) => g.by === me && g.verdict === 'pending');
    return (
      <TurnFrame
        {...frameProps}
        title="Guess the Drawing"
        hint={`${drawerName} is drawing someone from their list. Type who.`}
        clock={clock}
        impact={mine ? 'correct' : null}
        impactKey={`${game.turn}`}
      >
        <SketchCanvas strokes={sketch.strokes} label={`${drawerName}’s drawing`} className="mb-3" />
        {mine
          ? <p className="mb-4 text-center font-display text-lg font-bold uppercase text-fg-strong">You got it — +{mine.points}</p>
          : <GuessBar onGuess={room.guess} waiting={waiting} />}
        <GuessFeed game={game} players={players} youId={me} />
      </TurnFrame>
    );
  }

  // Revealed.
  const last = game.turn + 1 >= game.turns;
  return (
    <TurnFrame {...frameProps} title={game.void ? 'Round Void' : 'It Was…'}>
      <TurnReveal game={game} players={players} strokes={sketch.strokes} youId={me}>
        <Button variant="primary" size="lg" fullWidth onClick={room.next}>
          {last ? 'See results' : 'Next turn'}
        </Button>
      </TurnReveal>
    </TurnFrame>
  );
}
