import ResultImpact from '../../../shared/components/ResultImpact';
import { Splash } from '../../../shared/components/Results';
import { KANA } from '../../../shared/ui/kanaText';
import { Button, Screen } from '../../../shared/ui';

const ORDINALS = { 1: '1st', 2: '2nd', 3: '3rd' };

// A solve, as the results screens' splash in miniature: the solver wearing their
// face, their place stamped across it, the points in the score ink. The impact
// frame lands first (and plays `correct`), so the splash's own thud stays quiet.
//
// `mine` is online-only: the impact frame (and its sound) is the guesser's own
// result, so only their phone flashes it; local play's one device always does.
export default function CorrectGuessScreen({ lastLocked, lockedPositions, onContinue, mine = true }) {
  const tied = lockedPositions.filter(
    (lp) => lp.turnsUsed === lastLocked.turnsUsed && lp.playerId !== lastLocked.playerId
  ).length > 0;

  const place = ORDINALS[lastLocked.position] ?? `#${lastLocked.position}`;

  return (
    <Screen center width="md">
      <ResultImpact result={mine ? 'correct' : null} eventKey={`${lastLocked.playerId}:${lastLocked.turnsUsed}`} />
      <h2
        className="mb-5 text-center font-display text-4xl font-bold uppercase leading-none tracking-wide
          text-fg-strong [overflow-wrap:anywhere] sm:text-5xl"
      >
        {lastLocked.name} got it!
      </h2>

      <Splash
        players={[{ id: lastLocked.playerId, name: lastLocked.name }]}
        stamp={tied ? `${place} · tied` : place}
        kana={KANA.hit}
        kicker="Solved"
        title={lastLocked.name}
        score={`+${lastLocked.points} points`}
        quiet
      >
        in {lastLocked.turnsUsed} turns
      </Splash>

      <Button variant="primary" size="xl" fullWidth onClick={onContinue}>
        Continue Game →
      </Button>
    </Screen>
  );
}
