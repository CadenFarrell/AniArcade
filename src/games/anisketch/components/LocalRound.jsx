import { useEffect, useState } from 'react';
import Handoff from '../../../shared/components/Handoff';
import { useSoundCue } from '../../../shared/hooks/useSoundCue';
import { Button, TimerBar } from '../../../shared/ui';
import { useLocalSketch } from '../hooks/useSketch';
import { useSketchRound } from '../hooks/useSketchRound';
import { guessersLeft } from '../rules';
import AniSketchResults from './AniSketchResults';
import ChoosePanel, { Portrait } from './ChoosePanel';
import DrawingBoard from './DrawingBoard';
import TurnFrame from './TurnFrame';
import TurnReveal from './TurnReveal';

// One device, two jobs: hidden while the drawer picks, then turned round to
// face the table. The drawer gets the device behind a handoff, picks one of
// their characters in private, and only "Start drawing" — pressed once the
// screen faces the table — starts the clock. Then the table shouts and the
// drawer taps whoever named it ("<name> got it"); the moment of the tap sets
// the points. The only local state is `holding`: who has confirmed the device
// is in their hands.
export default function LocalRound({ players, settings, onPlayAgain, onBack }) {
  const round = useSketchRound(players, settings);
  const { game, ids, clock, choices, character } = round;
  const sketch = useLocalSketch(`${game.turn}`);
  const [holding, setHolding] = useState(null);
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const drawer = players.find((p) => p.id === game.drawer);

  useSoundCue('reveal', game.phase === 'revealed' ? `${game.turn}` : null);

  if (game.phase === 'finished') {
    return <AniSketchResults game={game} players={players} onPlayAgain={onPlayAgain} onBack={onBack} />;
  }

  const frame = (props, body) => <TurnFrame game={game} players={players} {...props}>{body}</TurnFrame>;

  if (game.phase === 'choosing') {
    if (holding !== game.drawer) {
      return frame({ title: `${drawer?.name ?? 'Next'} Draws`, hint: 'Pass the device to the drawer.' }, (
        <Handoff
          player={drawer}
          note="Everyone else, look away — only the drawer sees who to draw."
          cta={`I'm ${drawer?.name ?? 'the drawer'} — ready`}
          onReady={() => setHolding(game.drawer)}
        />
      ));
    }
    if (!character) {
      return frame({ title: 'Pick What to Draw', hint: 'One of these, off your own list. Keep it to yourself.' }, (
        <ChoosePanel choices={choices} onChoose={round.choose} />
      ));
    }
    return frame({ title: 'Ready to Draw', hint: 'Remember who it is, then turn the screen to the table.' }, (
      <div className="mx-auto max-w-xs text-center">
        <div className="mb-3 border-2 border-ink bg-surface">
          <Portrait character={character} />
          <p className="px-2 py-2 font-bold text-fg-strong">{character.name}</p>
        </div>
        <p className="mb-4 text-sm text-fg-body">
          The clock starts when you press Start. Tap a name under the drawing when its player shouts it out.
        </p>
        <Button variant="primary" size="lg" fullWidth onClick={round.start}>Start drawing</Button>
      </div>
    ));
  }

  if (game.phase === 'drawing') {
    const waiting = guessersLeft(game, ids);
    return frame({
      title: 'Draw!',
      hint: `${drawer?.name ?? 'The drawer'} draws, everyone shouts. No letters, no words.`,
      clock: <TimerBar secondsLeft={clock.secondsLeft} fraction={clock.fraction} label="Drawing time" />,
    }, (
      <>
        <DrawingBoard key={game.turn} sketch={sketch} />
        <Peek name={character?.name} />
        <section aria-labelledby="anisketch-got-heading" className="mb-4">
          <h3 id="anisketch-got-heading" className="mb-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-fg-helper">
            Who named it?
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {waiting.map((id) => (
              <Button key={id} variant="secondary" onClick={() => round.got(id)}>{`${nameOf(id)} got it`}</Button>
            ))}
          </div>
        </section>
        <Button variant="secondary" fullWidth onClick={round.giveUp}>Give up</Button>
      </>
    ));
  }

  // Revealed. Locally the character goes into the game on the way out (the
  // hook's `next`), so the reveal shows it from the drawer's pick.
  const shown = { ...game, reveal: game.reveal ?? character };
  const last = game.turn + 1 >= game.turns;
  return frame({ title: 'It Was…' }, (
    <TurnReveal game={shown} players={players} strokes={sketch.strokes}>
      <Button variant="primary" size="lg" fullWidth onClick={() => { setHolding(null); round.next(); }}>
        {last ? 'See results' : 'Next turn'}
      </Button>
    </TurnReveal>
  ));
}

// The drawer forgot whose hair that was: two seconds of the name, on a
// screen the table can see, so it is a peek and not a label.
function Peek({ name }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => setOpen(false), 2000);
    return () => clearTimeout(t);
  }, [open]);
  if (!name) return null;
  return (
    <div className="mb-4 flex items-center gap-3">
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} disabled={open}>Peek</Button>
      <span aria-live="polite" className="font-bold text-fg-strong">{open ? name : ''}</span>
    </div>
  );
}
