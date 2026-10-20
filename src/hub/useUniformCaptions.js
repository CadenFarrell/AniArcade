import { useLayoutEffect, useRef } from 'react';

// Every caption box on the board is as tall as the tallest one needs to be.
// Names wrap rather than truncate, so a long show title made one box three
// lines and its neighbour one, and a row of boxes at seven different heights
// read as clutter rather than as one page's captions.
//
// No CSS layout can do this: the boxes sit in separate grid cells (and rows),
// and how tall each needs to be depends on where its text wraps at the
// current width. So the board measures: each box's body carries
// `data-caption-body`, and the tallest body's NATURAL height — the sum of its
// lines, never the body's own height, which already carries the shared minimum
// and would stop the value ever shrinking — goes into `--caption-h` on the
// board, which every body uses as its min-height.
//
// Measured in a layout effect so the first paint already has equal boxes, then
// again whenever the board's width changes (wrapping moves) and once the web
// fonts finish loading (a fallback font wraps differently). Where there is no
// ResizeObserver — jsdom — it measures once and stops, which is harmless.
export function useUniformCaptions(deps) {
  const boardRef = useRef(null);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return undefined;
    const measure = () => {
      let tallest = 0;
      for (const body of board.querySelectorAll('[data-caption-body]')) {
        let h = 0;
        for (const line of body.children) h += line.offsetHeight;
        tallest = Math.max(tallest, h);
      }
      if (tallest) board.style.setProperty('--caption-h', `${tallest}px`);
      else board.style.removeProperty('--caption-h');
    };
    measure();
    let live = true;
    document.fonts?.ready?.then(() => live && measure());
    if (typeof ResizeObserver === 'undefined') return () => { live = false; };
    const ro = new ResizeObserver(measure);
    ro.observe(board);
    return () => {
      live = false;
      ro.disconnect();
    };
    // The caller says when the captions' CONTENT changed (a new draw); width
    // and font changes are caught above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return boardRef;
}
