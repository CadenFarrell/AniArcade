import { useStagger } from '../../../shared/hooks/useStagger';
import { ROWS, cellKey } from '../clues';

// The grid. Columns are categories, rows climb in value. A spent cell stays in
// place as an empty slot rather than collapsing, because the board's shape is
// how a table reads what is left.
//
// Every live cell is a real <button> — the whole keyboard story, and the reason
// a non-picker sees the same grid disabled rather than a different screen: the
// board is the scoreboard of what has been played, and everyone wants to read it.
//
// The column count comes in at run time, so the template is an inline style:
// Tailwind only emits `grid-cols-N` for an N it can find spelled out in source.
//
// Drawn in INK, never in AniQuiz's crimson: red is the game's colour on the hub
// only, and in a round red means wrong (see aniquiz/CLAUDE.md) — a board ruled
// in it read as a board of mistakes. Headers are ink blocks, live cells are
// paper panels that press like buttons (btn-pop), spent cells keep their place
// as hatched, empty slots.
export default function Board({ deal, game, canPick, onPick }) {
  const columns = deal?.categories ?? [];
  const template = { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` };
  // A fresh board lands a column at a time, header then values, the way a game
  // show lays out its board. Only a fresh one — after every clue the board
  // comes back, and re-running the show each time would be a wait, not a
  // flourish. The cells are real buttons from the first frame (useStagger's
  // rule), so a quick pick is never refused.
  const fresh = Object.keys(game?.used ?? {}).length === 0;
  const stagger = useStagger({ count: fresh ? columns.length : 0, stepMs: 140, key: game?.round ?? 'board' });
  const land = fresh && !stagger.skipped;
  const at = (c, row) => (land ? { animationDelay: `${stagger.delay(c) + row * 45}ms` } : undefined);

  return (
    <div className="grid gap-1.5 sm:gap-2" style={template} {...stagger.rootProps}>
      {columns.map((col, c) => (
        <div
          key={`h-${col.id}`}
          style={at(c, 0)}
          className={`${land ? 'reveal-row' : ''} flex min-h-14 items-center justify-center rounded-pop-sm border-2 border-ink bg-ink px-1 py-2
            text-center font-display text-[0.65rem] font-bold uppercase leading-tight tracking-wide text-paper
            sm:text-xs`}
        >
          {col.title}
        </div>
      ))}
      {Array.from({ length: ROWS }, (_, row) => columns.map((col, c) => {
        const key = cellKey(c, row);
        const spent = Boolean(game?.used?.[key]);
        const value = col.clues[row]?.value;
        if (spent) {
          return (
            <div
              key={key}
              aria-hidden="true"
              className="hatch min-h-14 rounded-pop-sm border-2 border-dashed border-line-strong [--hatch:var(--color-line)] sm:min-h-16"
            />
          );
        }
        return (
          <button
            key={key}
            type="button"
            disabled={!canPick}
            onClick={() => onPick(key)}
            aria-label={`${col.title} for ${value}`}
            style={at(c, row + 1)}
            className={`${land ? 'reveal-row' : ''} btn-pop focus-pop min-h-14 rounded-pop-sm! border-ink bg-surface text-base text-pop-amber
              tabular-nums enabled:hover:bg-surface-2 disabled:cursor-default disabled:shadow-none sm:min-h-16
              sm:text-2xl`}
          >
            {value}
          </button>
        );
      }))}
    </div>
  );
}
