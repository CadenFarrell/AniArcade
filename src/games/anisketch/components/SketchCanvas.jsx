import { useRef } from 'react';
import { PAPER, VIEW, inkOf, pathFor, toView, widthOf } from '../sketch';

/**
 * The drawing, as SVG rather than `<canvas>`: every stroke is a `<path>` in
 * one 4:3 coordinate space (sketch.js's VIEW), so it scales to any screen from
 * the same numbers, and jsdom — which has no canvas — can draw on it and read
 * it back, so the component tests and the playtest bots play real turns.
 *
 * With `onBegin` it is the drawer's pad: pointer events, captured so a line
 * leaving the box keeps drawing, and `touch-action: none` so a finger draws
 * instead of scrolling the page. Without, it is the guessers' view of the same
 * picture. `ink` and `size` are the pen the toolbar holds.
 *
 * Drawing is pointer-only by nature; the picture is described by its label
 * ("Drawing, 12 strokes"), and every other control on the screen is a button.
 */
export default function SketchCanvas({ strokes, ink = 0, size = 1, onBegin, onExtend, onEnd, label = 'Drawing', className = '' }) {
  const box = useRef(null);
  const down = useRef(false);
  const drawing = Boolean(onBegin);
  const at = (e) => toView(e.clientX, e.clientY, box.current.getBoundingClientRect());

  const handlers = drawing ? {
    onPointerDown: (e) => {
      if (e.button != null && e.button > 0) return;
      e.preventDefault();
      down.current = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      onBegin(ink, size, at(e));
    },
    onPointerMove: (e) => {
      if (!down.current) return;
      // A fast pen arrives as several samples per frame; each is a point.
      const samples = e.nativeEvent?.getCoalescedEvents?.() ?? [];
      for (const s of samples.length ? samples : [e]) onExtend(at(s));
    },
    onPointerUp: () => { if (down.current) { down.current = false; onEnd(); } },
    onPointerCancel: () => { if (down.current) { down.current = false; onEnd(); } },
  } : {};

  return (
    <div className={`border-2 border-ink bg-surface shadow-pop-sm ${className}`}>
      <svg
        ref={box}
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        role="img"
        aria-label={`${label}, ${strokes.length} stroke${strokes.length === 1 ? '' : 's'}`}
        data-sketch={drawing ? 'pad' : 'view'}
        className={`block aspect-[4/3] w-full ${drawing ? 'cursor-crosshair touch-none select-none' : ''}`}
        {...handlers}
      >
        <rect width={VIEW.w} height={VIEW.h} fill={PAPER} />
        {strokes.map((s) => (
          <path
            key={s.i}
            d={pathFor(s.pts)}
            fill="none"
            stroke={inkOf(s.c)}
            strokeWidth={widthOf(s.c, s.w)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  );
}
