import { useConfirm } from '../../../shared/hooks/useConfirm';
import { Button, Icon } from '../../../shared/ui';
import { ERASER, INKS, SIZES } from '../sketch';

/**
 * The drawer's pen: six inks, the eraser, three sizes, Undo and Clear. Every
 * control is a button named in words — "Black", "Eraser", "Medium" — and the
 * chosen ink and size are `aria-pressed`, so the pick is never colour alone:
 * the pressed swatch also takes a thick ink ring and a check.
 *
 * Clear asks first (ConfirmDialog, never the browser's box): it cannot be
 * undone, and it is one tap from Undo.
 */
export default function Toolbar({ ink, size, onInk, onSize, onUndo, onClear, canUndo }) {
  const { ask, dialog } = useConfirm();
  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Ink">
        {INKS.map((c, i) => {
          const on = ink === i;
          return (
            <button
              key={c.name}
              type="button"
              aria-pressed={on}
              aria-label={c.name}
              title={c.name}
              onClick={() => onInk(i)}
              className={`focus-pop grid h-9 w-9 place-items-center rounded-full border-ink text-paper
                ${on ? 'border-[3px] shadow-pop-sm' : 'border-2'}`}
              // A drawing ink is content, not an accent token: the swatch
              // shows exactly what the pen paints (sketch.js INKS).
              style={{ backgroundColor: c.value }}
            >
              {on && <Icon name="check" />}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={ink === ERASER}
          onClick={() => onInk(ERASER)}
          className={`focus-pop ml-1 rounded-pop-sm border-ink px-2.5 py-1.5 font-display text-sm font-bold uppercase tracking-wide
            ${ink === ERASER ? 'border-[3px] bg-ink text-paper' : 'border-2 bg-surface text-fg-strong'}`}
        >
          Eraser
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex gap-1.5" role="group" aria-label="Pen size">
          {SIZES.map((s, i) => {
            const on = size === i;
            return (
              <button
                key={s.name}
                type="button"
                aria-pressed={on}
                aria-label={s.name}
                onClick={() => onSize(i)}
                className={`focus-pop grid h-9 w-9 place-items-center rounded-pop-sm border-ink
                  ${on ? 'border-[3px] bg-ink' : 'border-2 bg-surface'}`}
              >
                <span
                  aria-hidden="true"
                  className={`block rounded-full ${on ? 'bg-paper' : 'bg-ink'}`}
                  style={{ width: 4 + i * 6, height: 4 + i * 6 }}
                />
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex gap-1.5">
          <Button variant="secondary" size="sm" disabled={!canUndo} onClick={onUndo}>
            <Icon name="refresh" /> Undo
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!canUndo}
            onClick={() => ask({
              title: 'Clear the drawing?',
              message: 'Everything drawn this turn goes. The clock keeps running.',
              confirmLabel: 'Clear it',
              cancelLabel: 'Keep drawing',
              onConfirm: onClear,
            })}
          >
            <Icon name="trash" /> Clear
          </Button>
        </div>
      </div>
      {dialog}
    </div>
  );
}
