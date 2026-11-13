// The drawing itself: the palette, the pen sizes, and the stroke format that
// travels through the room. Pure — the canvas (components/SketchCanvas.jsx)
// and both sketch hooks (hooks/useSketch.js) are built on it.
//
// **Coordinates are integers in one fixed 4:3 space (VIEW), never pixels.**
// A phone and a laptop draw the same picture from the same numbers, and an
// integer under four digits is the cheapest thing RTDB can carry: a point is
// "123,456," — eight characters.
//
// **A stroke travels in chunks**, `p/{0,1,2…}`, each a string of points
// ("x,y,x,y"). The drawer's device sends the points it has every
// FLUSH_MS while the pen is down, so the guessers watch the line grow; a chunk
// is appended, never rewritten, so a slow write never sends the same points
// twice. The caps here are also in database.rules.json, so a hand-made write
// cannot grow a turn past them.

/** The drawing space: 4:3, so every screen frames the drawing the same way. */
export const VIEW = { w: 1000, h: 750 };

/**
 * The drawing inks. Content colours, not UI accents — they paint a character's
 * hair and eyes, which is how most anime characters are recognised, so they
 * are picked for hair: black, brown, blonde, red, blue, pink. Each carries its
 * name, which is the swatch's accessible name.
 */
export const INKS = [
  { name: 'Black', value: '#141414' },
  { name: 'Brown', value: '#7a4a24' },
  { name: 'Yellow', value: '#e5b820' },
  { name: 'Red', value: '#c42222' },
  { name: 'Blue', value: '#2160c4' },
  { name: 'Pink', value: '#e86fa0' },
];
/** The eraser is a stroke in the paper colour: undo still takes it back whole. */
export const ERASER = INKS.length;
/** The paper the drawing is on, and what the eraser paints. Matches --color-surface. */
export const PAPER = '#faf8f3';
export const inkOf = (c) => (c === ERASER ? PAPER : INKS[c]?.value ?? INKS[0].value);

/** Pen sizes, as stroke widths in VIEW units, small to large. The eraser is twice as wide. */
export const SIZES = [
  { name: 'Small', width: 6 },
  { name: 'Medium', width: 14 },
  { name: 'Large', width: 28 },
];
export const widthOf = (c, w) => (SIZES[w]?.width ?? SIZES[1].width) * (c === ERASER ? 2 : 1);

/** How often a drawing pen's new points go out. */
export const FLUSH_MS = 250;
/** A turn's caps, kept in database.rules.json too. */
export const MAX_STROKES = 300;
export const MAX_POINTS = 20000;
/** Points in one chunk: at most 9 characters each, inside the rules' 1200. */
export const CHUNK_POINTS = 120;
/** Points closer than this to the last one are dropped: they add bytes, not shape. */
const MIN_STEP = 4;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** A pointer position inside `rect` (the canvas's box) as a VIEW point. */
export function toView(clientX, clientY, rect) {
  const x = rect.width ? ((clientX - rect.left) / rect.width) * VIEW.w : 0;
  const y = rect.height ? ((clientY - rect.top) / rect.height) * VIEW.h : 0;
  return [Math.round(clamp(x, 0, VIEW.w)), Math.round(clamp(y, 0, VIEW.h))];
}

/** Whether `pt` is far enough from the stroke's last point to keep. */
export function keepPoint(pts, pt) {
  if (pts.length < 2) return true;
  const dx = pt[0] - pts[pts.length - 2];
  const dy = pt[1] - pts[pts.length - 1];
  return dx * dx + dy * dy >= MIN_STEP * MIN_STEP;
}

/** A flat [x, y, x, y…] list as a chunk string, and back. */
export const encodePoints = (pts) => pts.join(',');
export function decodePoints(text) {
  if (typeof text !== 'string' || !text) return [];
  const out = [];
  for (const part of text.split(',')) {
    const n = Number(part);
    if (!Number.isFinite(n)) return out.length % 2 ? out.slice(0, -1) : out;
    out.push(n);
  }
  return out.length % 2 ? out.slice(0, -1) : out;
}

/** A stroke's key in the room: `s0`, `s1`… so they sort, and the rules can match them. */
export const strokeKey = (i) => `s${i}`;
const strokeIndex = (key) => (/^s\d{1,3}$/.test(key) ? Number(key.slice(1)) : -1);

/**
 * A turn's strokes as stored (`{ s0: { c, w, p: { 0: "…", 1: "…" } } }`, any
 * part of which RTDB may hand back as an array or drop when empty) as
 * `[{ i, c, w, pts }]` in drawing order. Anything malformed is skipped.
 */
export function parseStrokes(raw) {
  if (!raw || typeof raw !== 'object') return [];
  const out = [];
  for (const [key, s] of Object.entries(raw)) {
    const i = strokeIndex(key);
    if (i < 0 || !s || typeof s !== 'object') continue;
    const chunks = s.p && typeof s.p === 'object'
      ? Object.keys(s.p).filter((k) => /^\d+$/.test(k)).sort((a, b) => a - b).map((k) => s.p[k])
      : [];
    const pts = chunks.flatMap(decodePoints);
    out.push({ i, c: Number.isInteger(s.c) ? s.c : 0, w: Number.isInteger(s.w) ? s.w : 1, pts });
  }
  return out.sort((a, b) => a.i - b.i);
}

/** An SVG path for a stroke's points. A single point is a dot: a zero-length line with round caps. */
export function pathFor(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0]} ${pts[1]}`;
  if (pts.length === 2) return `${d}l0 0.01`;
  for (let i = 2; i < pts.length; i += 2) d += `L${pts[i]} ${pts[i + 1]}`;
  return d;
}

/** Points drawn so far this turn, for the caps. */
export const pointCount = (strokes) => strokes.reduce((n, s) => n + s.pts.length / 2, 0);

/** Whether the turn may take another stroke. */
export const roomForStroke = (strokes) => strokes.length < MAX_STROKES && pointCount(strokes) < MAX_POINTS;
