// The `draw` action: one stroke across AniSketch's drawing pad
// (`[data-sketch="pad"]`), given as points at fractions of its box —
// `{ draw: [[0.2, 0.3], [0.6, 0.5]], why }`. The pad is SVG, not <canvas>, so
// jsdom can be drawn on; jsdom lays nothing out, so every point lands at the
// box's corner and a stroke is a dot there — still a stroke, which is what
// the bots need to exercise (the drawing's sync, undo, the stroke count). The
// browser layer draws the real line with the mouse (browser/harness.js).
export function drawStroke(root, points, fireEvent) {
  const pad = root.querySelector('[data-sketch="pad"]');
  if (!pad || !points?.length) return false;
  const box = pad.getBoundingClientRect();
  const at = ([x, y]) => ({ clientX: box.left + x * box.width, clientY: box.top + y * box.height, pointerId: 1, button: 0 });
  const [first, ...rest] = points;
  fireEvent.pointerDown(pad, at(first));
  for (const p of rest) fireEvent.pointerMove(pad, at(p));
  fireEvent.pointerUp(pad, at(points.at(-1)));
  return true;
}
