import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onValue, ref, remove, set } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import {
  CHUNK_POINTS, FLUSH_MS, MAX_POINTS, encodePoints, keepPoint, parseStrokes, pointCount, roomForStroke, strokeKey,
} from '../sketch';

// The drawing, in two persistence layers with one shape — the same split as
// every game's round hooks:
//
//   { strokes, begin(c, w, pt), extend(pt), end(), undo(), clear() }
//
// `strokes` is `[{ i, c, w, pts }]` in drawing order (sketch.js), what the
// canvas paints. Both reset when `turnKey` changes: a new turn is a blank page.

/** One device: the drawing is just state. */
export function useLocalSketch(turnKey) {
  const [page, setPage] = useState({ turnKey, strokes: [] });
  // A new turn is a new page — adjusted while rendering, not in an effect, so
  // the old drawing never paints for a frame under the next drawer's name.
  if (page.turnKey !== turnKey) setPage({ turnKey, strokes: [] });
  const strokes = page.turnKey === turnKey ? page.strokes : [];

  const edit = useCallback((fn) => setPage((p) => ({ ...p, strokes: fn(p.strokes) })), []);
  return {
    strokes,
    begin: useCallback((c, w, pt) => edit((list) => (roomForStroke(list)
      ? [...list, { i: (list.at(-1)?.i ?? -1) + 1, c, w, pts: [...pt], open: true }]
      : list)), [edit]),
    extend: useCallback((pt) => edit((list) => {
      const last = list.at(-1);
      if (!last?.open || !keepPoint(last.pts, pt) || pointCount(list) >= MAX_POINTS) return list;
      return [...list.slice(0, -1), { ...last, pts: [...last.pts, ...pt] }];
    }), [edit]),
    end: useCallback(() => edit((list) => list.map((s) => (s.open ? { i: s.i, c: s.c, w: s.w, pts: s.pts } : s))), [edit]),
    undo: useCallback(() => edit((list) => list.slice(0, -1)), [edit]),
    clear: useCallback(() => edit(() => []), [edit]),
  };
}

/**
 * The room: strokes under `rooms/{code}/sketch/{turnKey}/s{i}`, a sibling of
 * state/ so the four-a-second writes never re-fire every member's whole-room
 * subscription. Everyone subscribes to the turn's node; only the drawer
 * writes (`amDrawer`), and the rules cap what a write may hold.
 *
 * The drawer paints its own pen from local points, never from the echo: a
 * stroke is written as `{ c, w }` when the pen goes down, and its points go
 * out every FLUSH_MS as numbered chunks (`p/0`, `p/1`…), each sent once. The
 * guessers see the line grow a quarter-second at a time.
 */
export function useRoomSketch(roomCode, turnKey, amDrawer, onError) {
  const [remote, setRemote] = useState({ turnKey: null, strokes: [] });
  // The pen that is down: `{ i, c, w, pts, sent, chunk }`. A ref for the
  // flush timer, mirrored into state for painting.
  const penRef = useRef(null);
  const [pen, setPen] = useState(null);
  const path = roomCode && turnKey ? `rooms/${roomCode}/sketch/${turnKey}` : null;

  useEffect(() => {
    if (!path) return undefined;
    const db = getFirebaseDb();
    const unsub = onValue(
      ref(db, path),
      (snap) => setRemote({ turnKey, strokes: parseStrokes(snap.val()) }),
      () => setRemote({ turnKey, strokes: [] }),
    );
    return () => { unsub(); penRef.current = null; setPen(null); };
  }, [path, turnKey]);

  const fail = useCallback((e) => onError?.(e?.message || 'Could not send the drawing — check your connection.'), [onError]);

  // Sends whatever the pen has drawn since the last flush, as whole chunks.
  const flush = useCallback(() => {
    const p = penRef.current;
    if (!p || !path || p.pts.length <= p.sent) return;
    const db = getFirebaseDb();
    while (p.sent < p.pts.length) {
      const slice = p.pts.slice(p.sent, p.sent + CHUNK_POINTS * 2);
      set(ref(db, `${path}/${strokeKey(p.i)}/p/${p.chunk}`), encodePoints(slice)).catch(fail);
      p.sent += slice.length;
      p.chunk += 1;
    }
  }, [path, fail]);

  // One timer per pen-down, not one per point.
  const penDown = pen != null;
  useEffect(() => {
    if (!penDown) return undefined;
    const id = setInterval(flush, FLUSH_MS);
    return () => clearInterval(id);
  }, [penDown, flush]);

  const strokes = useMemo(() => (remote.turnKey === turnKey ? remote.strokes : []), [remote, turnKey]);
  const strokesRef = useRef(strokes);
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);

  const begin = useCallback((c, w, pt) => {
    if (!amDrawer || !path || penRef.current || !roomForStroke(strokesRef.current)) return;
    const i = (strokesRef.current.at(-1)?.i ?? -1) + 1;
    penRef.current = { i, c, w, pts: [...pt], sent: 0, chunk: 0 };
    setPen({ i, c, w, pts: [...pt] });
    set(ref(getFirebaseDb(), `${path}/${strokeKey(i)}`), { c, w }).catch(fail);
  }, [amDrawer, path, fail]);

  const extend = useCallback((pt) => {
    const p = penRef.current;
    if (!p || !keepPoint(p.pts, pt) || pointCount(strokesRef.current) + p.pts.length / 2 >= MAX_POINTS) return;
    p.pts.push(...pt);
    setPen({ i: p.i, c: p.c, w: p.w, pts: [...p.pts] });
  }, []);

  const end = useCallback(() => {
    flush();
    penRef.current = null;
    setPen(null);
  }, [flush]);

  const undo = useCallback(() => {
    const last = strokesRef.current.at(-1);
    if (!amDrawer || !path || penRef.current || !last) return;
    remove(ref(getFirebaseDb(), `${path}/${strokeKey(last.i)}`)).catch(fail);
  }, [amDrawer, path, fail]);

  const clear = useCallback(() => {
    if (!amDrawer || !path) return;
    penRef.current = null;
    setPen(null);
    remove(ref(getFirebaseDb(), path)).catch(fail);
  }, [amDrawer, path, fail]);

  // The pen paints from its own points; the echo of the same stroke is
  // replaced by them until it lifts.
  const shown = pen ? [...strokes.filter((s) => s.i !== pen.i), pen] : strokes;
  return { strokes: shown, begin, extend, end, undo, clear };
}
