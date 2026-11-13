// Every option AniSketch remembers between sessions, at its literal default —
// and the schema useGamePrefs validates a saved blob against. Setup and the
// lobby offer the same set through one AniSketchSettings card.
//
//   laps: 1            — times round the table (shared/utils/match.js): every
//                        player draws equally often at any table size, and
//                        once round is already a game of four to eight
//                        drawings.
//   drawSeconds: 80    — the drawing clock. Long enough to get hair, eyes and
//                        one telling prop down; short enough that a stuck
//                        table is not waiting a minute and a half.
//   choices: 3         — characters the drawer picks from, all off their own
//                        list. One is a lottery (a character you cannot draw);
//                        three lets you pass on the one with no telling hair.
//   sharedFirst: true  — "Characters others know first": the offer leans
//                        toward characters someone else at the table also has
//                        on their list, since a drawing nobody could know is a
//                        turn nobody scores. A lean, never a filter
//                        (deal.js).
export const DEFAULT_PREFS = {
  laps: 1,
  drawSeconds: 80,
  choices: 3,
  sharedFirst: true,
};

export const DRAW_SECONDS = [60, 80, 100, 120];
export const CHOICES_RANGE = { min: 2, max: 4 };

/** A saved blob's values back into range: a stray number never reaches the rules. */
export function cleanPrefs(prefs) {
  const p = { ...DEFAULT_PREFS, ...prefs };
  return {
    ...p,
    drawSeconds: DRAW_SECONDS.includes(p.drawSeconds) ? p.drawSeconds : DEFAULT_PREFS.drawSeconds,
    choices: Math.min(CHOICES_RANGE.max, Math.max(CHOICES_RANGE.min, Math.round(Number(p.choices) || DEFAULT_PREFS.choices))),
  };
}
