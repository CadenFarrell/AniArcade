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
//
// The panel is the CHARACTER they turned out to be, in full colour, when the
// lock carries one (rules.characterCard) — "I was Levi all along?!" is the
// moment the round builds to, and it used to go unpictured. It falls back to
// the player's own face where the character is unknown (a lock written before
// this, or an online timeout the guesser's own device locked).
//
// `lastLocked.unsolved` is the other ending: out of final chances, or given
// up. Same screen, a miss frame instead of the hit, no place and no points.
export default function CorrectGuessScreen({ lastLocked, lockedPositions, onContinue, mine = true }) {
  const unsolved = Boolean(lastLocked.unsolved);
  const tied = !unsolved && lockedPositions.filter(
    (lp) => !lp.unsolved && lp.turnsUsed === lastLocked.turnsUsed && lp.playerId !== lastLocked.playerId
  ).length > 0;

  const place = ORDINALS[lastLocked.position] ?? `#${lastLocked.position}`;
  const ch = lastLocked.character;
  const turns = `${lastLocked.turnsUsed} ${lastLocked.turnsUsed === 1 ? 'turn' : 'turns'}`;

  return (
    <Screen center width="md">
      <ResultImpact
        result={mine ? (unsolved ? 'wrong' : 'correct') : null}
        eventKey={`${lastLocked.playerId}:${lastLocked.turnsUsed}:${unsolved ? 'out' : 'in'}`}
      />
      <h2
        className="mb-5 text-center font-display text-4xl font-bold uppercase leading-none tracking-wide
          text-fg-strong [overflow-wrap:anywhere] sm:text-5xl"
      >
        {unsolved ? `${lastLocked.name} is out` : `${lastLocked.name} got it!`}
      </h2>

      <Splash
        players={[{ id: lastLocked.playerId, name: lastLocked.name }]}
        // Full colour, CharacterReveal's rule: this is a character, not a
        // player's inked face.
        art={ch?.imageUrl ? (
          <img
            src={ch.imageUrl}
            alt=""
            decoding="async"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover object-[50%_15%]"
          />
        ) : null}
        stamp={unsolved ? 'Unsolved' : tied ? `${place} · tied` : place}
        kana={unsolved ? KANA.miss : KANA.hit}
        kicker={ch ? `${lastLocked.name} was` : (unsolved ? 'Out of the round' : 'Solved')}
        title={ch?.name ?? lastLocked.name}
        score={unsolved ? 'No points' : `+${lastLocked.points} points`}
        quiet
      >
        {ch?.series && <p className="text-fg-helper">from {ch.series}</p>}
        <p>{unsolved ? `after ${turns}` : `in ${turns}`}</p>
      </Splash>

      <Button variant="primary" size="xl" fullWidth onClick={onContinue}>
        Continue Game →
      </Button>
    </Screen>
  );
}
