// How many tiles across the hub's board runs at each width — chosen from the
// roster's size, not fixed, so the board stays tidy whatever the final count.
//
// It used to be a fixed 2/4/6 ladder, which at 13 games left one tile alone on
// its last row at EVERY width (6+6+1, 4+4+4+1, 2×6+1): the newest game looking
// like an afterthought. A tile size is a range, not a point, so each width gets
// the column counts its tiles can live with (roughly 130–185px at that tier's
// narrowest viewport; the low end is a caption still legible, the high end
// AniList's 230px portrait still sharp), and the count picked is the one that
// leaves the fullest last row. Whatever is left over is centred by the board
// (HubScreen), so a short row sits under the middle rather than hanging off the
// left edge.
//
// A phone is 2 across and nothing else — three would put tiles near 105px, under
// any legible caption — so an odd roster always leaves one tile on a phone's
// last row. That one is centred and is the only lone tile the rule accepts by
// design; boardLayout.test.js fails the registry if a tablet or wider ever
// leaves one.
//
// Tailwind breakpoints: sm 640, md 768, lg 1024, xl 1280.
export const BOARD_TIERS = [
  { tier: 'base', min: 2, max: 2 },
  { tier: 'sm', min: 3, max: 4 },
  { tier: 'md', min: 4, max: 5 },
  { tier: 'lg', min: 5, max: 6 },
  { tier: 'xl', min: 6, max: 7 },
];

// How many tiles sit on the last row of `n` laid `c` across (all n when they fit
// on one row).
export const lastRow = (n, c) => (n % c) || c;

// The column count for one tier: the one whose last row holds the MOST tiles —
// an exact fit wins outright, a lone tile loses to anything else — and on a tie
// the more columns, since fewer rows keeps the board above a laptop's fold.
// The most tiles, not the fewest empty slots: 13 at 3 or 4 across both leave a
// lone tile, and fewest-empty would pick 3 for it, five rows for nothing.
// A roster smaller than the tier's minimum is one row of exactly that many.
export function columnsFor(n, { min, max }) {
  if (n <= 0) return min;
  if (n < min) return n;
  let best = min;
  for (let c = min; c <= Math.min(max, n); c += 1) {
    if (lastRow(n, c) >= lastRow(n, best)) best = c;
  }
  return best;
}

// { base, sm, md, lg, xl } for a roster of `n` games.
export function boardColumns(n) {
  return Object.fromEntries(BOARD_TIERS.map((t) => [t.tier, columnsFor(n, t)]));
}
