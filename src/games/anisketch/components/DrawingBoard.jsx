import { useState } from 'react';
import SketchCanvas from './SketchCanvas';
import Toolbar from './Toolbar';

/**
 * The drawer's pad and pen together. The pen (ink, size) is this component's
 * own state: it is the drawer's hand, not the game's, and resets with the
 * turn because the caller keys the board per turn.
 */
export default function DrawingBoard({ sketch }) {
  const [ink, setInk] = useState(0);
  const [size, setSize] = useState(1);
  return (
    <>
      <SketchCanvas
        strokes={sketch.strokes}
        ink={ink}
        size={size}
        onBegin={sketch.begin}
        onExtend={sketch.extend}
        onEnd={sketch.end}
        label="Your drawing"
        className="mb-3"
      />
      <Toolbar
        ink={ink}
        size={size}
        onInk={setInk}
        onSize={setSize}
        onUndo={sketch.undo}
        onClear={sketch.clear}
        canUndo={sketch.strokes.length > 0}
      />
    </>
  );
}
