import { WIPE_MS } from './useWipe';

// The slash that crosses the screen between the title, the hub and a game — the
// cut between two manga panels. An ink slab with a vermilion edge, skewed, swept
// left to right once (`panel-wipe` in index.css); useWipe swaps the screen while
// it covers everything.
//
// It catches pointer events for its half-second on purpose: a tap landing on
// the half-replaced screen underneath would act on a screen the player can no
// longer see.
export default function PanelWipe() {
  return (
    <div aria-hidden="true" data-wipe="" className="pointer-events-auto fixed inset-0 z-[60] overflow-hidden">
      <div
        className="panel-wipe absolute inset-y-0 -left-[25%] w-[150%] border-r-[18px] border-pop-pink bg-ink"
        style={{ '--wipe-ms': `${WIPE_MS}ms` }}
      >
        <div className="speed-lines absolute inset-0 opacity-20 [--lines:var(--color-paper)]" />
      </div>
    </div>
  );
}
