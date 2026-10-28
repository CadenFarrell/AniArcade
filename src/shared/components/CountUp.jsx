import { useCountUp } from '../hooks/useCountUp';

/**
 * A number that counts up on screen and is already final for everything that
 * reads it — two copies, and both are load-bearing.
 *
 * The visible copy is aria-hidden and moves: a screen reader would otherwise
 * announce a stream of wrong totals, or only the first. The sr-only copy holds
 * `value` from the first render. The online playtest also reads the numbers on
 * every device's final screen and fails the run if they disagree, and a total
 * caught mid-count on one phone would look exactly like a desync — so the
 * moving copy carries `data-count-up`, which playtest/core/snapshot.js leaves
 * out of its tally.
 *
 * Use it where the number is a RESULT the table must agree on (standings,
 * final totals). A per-round badge that nothing compares can call useCountUp
 * directly and stay one node, the way AniWave's reveal does.
 */
export default function CountUp({ value, from = 0, delayMs = 0, skip = false, format = String, className }) {
  const shown = useCountUp(value, { from, delayMs, skip });
  return (
    <>
      <span aria-hidden="true" data-count-up="" className={className}>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
