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
export default function Board({ deal, game, canPick, onPick }) {
  const columns = deal?.categories ?? [];
  const template = { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` };

  return (
    <div className="grid gap-1.5 sm:gap-2" style={template}>
      {columns.map((col) => (
        <div
          key={`h-${col.id}`}
          className="flex min-h-14 items-center justify-center rounded-pop-sm border-2 border-line-strong
            bg-surface-2 px-1 py-2 text-center font-display text-[0.65rem] font-extrabold uppercase
            leading-tight tracking-wide text-fg-strong sm:text-xs"
        >
          {col.title}
        </div>
      ))}
      {Array.from({ length: ROWS }, (_, row) => columns.map((col, c) => {
        const key = cellKey(c, row);
        const spent = Boolean(game?.used?.[key]);
        const value = col.clues[row]?.value;
        if (spent) {
          return <div key={key} aria-hidden="true" className="min-h-14 rounded-pop-sm border-2 border-line bg-canvas sm:min-h-16" />;
        }
        return (
          <button
            key={key}
            type="button"
            disabled={!canPick}
            onClick={() => onPick(key)}
            aria-label={`${col.title} for ${value}`}
            className="focus-pop min-h-14 rounded-pop-sm border-2 border-pop-red/70 bg-surface font-display
              text-base font-extrabold text-pop-amber transition-colors enabled:hover:border-pop-red
              enabled:hover:bg-pop-red/15 disabled:cursor-default sm:min-h-16 sm:text-2xl"
          >
            {value}
          </button>
        );
      }))}
    </div>
  );
}
