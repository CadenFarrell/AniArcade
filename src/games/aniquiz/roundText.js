import { parseCell } from './clues';
import { QUIZ, cellsLeft, currentClue, isDailyDouble } from './rules';

// The words both round screens (LocalRound, OnlineGame) put around a clue, so
// the two cannot drift on what a clue is called or what Next says. A .js file
// rather than beside the components, so it stays testable and fast refresh
// keeps working on the screens that import it.

/** The heading over the clue on screen: its column, or the quiz/final's own topic. */
export function categoryFor(game, deal) {
  if (game?.round === 'final' || deal?.format === QUIZ) return currentClue(game, deal)?.categoryTitle ?? null;
  const at = parseCell(game?.cell);
  return at ? deal?.categories?.[at.col]?.title ?? null : null;
}

/** What the clue card prints where the value goes. */
export function stakeLabelFor(game, deal) {
  if (game?.round === 'final') return 'Final';
  if (isDailyDouble(game, deal)) {
    const w = game.wagers?.[game.solo];
    return w != null ? `Daily Double · ${w.toLocaleString()}` : 'Daily Double';
  }
  return currentClue(game, deal)?.value ?? '';
}

/** The label for the button past a revealed clue — says where it goes. */
export function nextLabel(game, deal) {
  if (game?.round === 'final') return 'See results →';
  if (deal?.format === QUIZ) {
    return game.index + 1 >= (deal.questions?.length ?? 0) ? 'See results →' : 'Next question →';
  }
  if (cellsLeft(game, deal) > 0) return 'Back to the board →';
  return deal?.final ? 'On to the final →' : 'See results →';
}
