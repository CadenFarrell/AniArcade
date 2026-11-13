import { describe, expect, it } from 'vitest';
import {
  CHUNK_POINTS, ERASER, INKS, MAX_STROKES, PAPER, VIEW, decodePoints, encodePoints, inkOf, keepPoint, parseStrokes,
  pathFor, roomForStroke, strokeKey, toView, widthOf,
} from './sketch';

describe('the drawing space', () => {
  it('maps a pointer inside the box to VIEW, clamped to its edges', () => {
    const rect = { left: 10, top: 20, width: 200, height: 150 };
    expect(toView(110, 95, rect)).toEqual([500, 375]);
    expect(toView(-50, 999, rect)).toEqual([0, VIEW.h]);
  });

  it('drops a point too close to the last one', () => {
    expect(keepPoint([], [1, 1])).toBe(true);
    expect(keepPoint([100, 100], [102, 101])).toBe(false);
    expect(keepPoint([100, 100], [104, 100])).toBe(true);
  });

  it('paints the eraser in the paper colour, twice as wide', () => {
    expect(inkOf(0)).toBe(INKS[0].value);
    expect(inkOf(ERASER)).toBe(PAPER);
    expect(widthOf(ERASER, 1)).toBe(2 * widthOf(0, 1));
  });
});

describe('the stroke format', () => {
  it('round-trips points through a chunk string, dropping a torn tail', () => {
    expect(decodePoints(encodePoints([1, 2, 3, 4]))).toEqual([1, 2, 3, 4]);
    expect(decodePoints('1,2,3')).toEqual([1, 2]);
    expect(decodePoints('1,2,x,4')).toEqual([1, 2]);
    expect(decodePoints(null)).toEqual([]);
  });

  it('keeps a full chunk inside the rules’ 1200 characters', () => {
    const worst = Array.from({ length: CHUNK_POINTS * 2 }, () => 1000);
    expect(encodePoints(worst).length).toBeLessThanOrEqual(1200);
  });

  it('reads strokes in order from what RTDB returns, chunks as an array or an object', () => {
    const raw = {
      s10: { c: 2, w: 0, p: { 0: '5,5' } },
      s2: { c: 1, w: 2, p: ['1,2,3,4', '5,6'] },
      junk: { c: 1 },
      s3: { c: 0, w: 1 },
    };
    expect(parseStrokes(raw)).toEqual([
      { i: 2, c: 1, w: 2, pts: [1, 2, 3, 4, 5, 6] },
      { i: 3, c: 0, w: 1, pts: [] },
      { i: 10, c: 2, w: 0, pts: [5, 5] },
    ]);
    expect(strokeKey(7)).toBe('s7');
  });

  it('draws a dot for a single point and a line for more', () => {
    expect(pathFor([5, 6])).toBe('M5 6l0 0.01');
    expect(pathFor([1, 2, 3, 4])).toBe('M1 2L3 4');
    expect(pathFor([])).toBe('');
  });

  it('stops taking strokes at the cap', () => {
    const strokes = Array.from({ length: MAX_STROKES }, () => ({ pts: [1, 1] }));
    expect(roomForStroke(strokes)).toBe(false);
    expect(roomForStroke(strokes.slice(1))).toBe(true);
  });
});
