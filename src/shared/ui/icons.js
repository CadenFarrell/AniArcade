// The arcade's icons, as data rather than JSX — one small hand-built ink set
// that replaced the emoji. Emoji were the last thing on screen still drawn by
// somebody else: every platform paints them in its own glossy colour style, so
// on a page of black ink they were the one part that looked pasted in, and they
// had spread to ~450 places, most of them decorating a label that already said
// the same thing in words.
//
// So most of the emoji were DELETED, not replaced. An icon survives only where
// it carries something the words around it do not: a yes/no mark, a status in a
// row of players (locked in, out, waiting, buzzed), a lives count, an icon-only
// button. Before adding one, ask whether the label already says it.
//
// Geometry is data for gameIcons.js's old reason (it was the tile art before the
// prints): a .js module can be checked by a plain .test.js under node, and a
// name Icon cannot find renders NOTHING — `icons.test.js` checks every
// <Icon name="…"> written in src against this map.
//
// 24×24, ink style: round-capped 2.25 strokes and solid fills, no colour of its
// own. `paint` is 'stroke' or 'fill', and Icon.jsx turns it into stroke-current
// / fill-current — the ONE place the app uses currentColor, deliberately: an
// inline icon is part of the text it sits in, so it has to follow that text's
// colour through every button variant, hover and disabled state. Standalone art
// (ArcadeMark, the mute glyph) still paints with token classes.

export const VIEWBOX = '0 0 24 24';

export const ICON_TAGS = ['path', 'circle', 'rect'];

const s = (d, w) => ({ tag: 'path', paint: 'stroke', d, ...(w ? { w } : {}) });
const f = (d, extra = {}) => ({ tag: 'path', paint: 'fill', d, ...extra });

export const ICONS = {
  // yes / correct / done
  check: [s('M4.5 12.5l5 5 10-11', 3)],
  // no / wrong / dismiss
  cross: [s('M6 6l12 12M18 6L6 18', 3)],
  warning: [
    s('M12 3.5l9.5 16.5h-19z'),
    s('M12 9.5v4.5', 2.5),
    { tag: 'circle', paint: 'fill', cx: 12, cy: 17, r: 1.35 },
  ],
  // the host / the leader
  crown: [f('M3 18.5h18l-1.5-11-4.5 4L12 5l-3 6.5-4.5-4z')],
  lock: [
    s('M8 10.5V8a4 4 0 0 1 8 0v2.5', 2.5),
    { tag: 'rect', paint: 'fill', x: 5, y: 10.5, width: 14, height: 10, rx: 1.5 },
  ],
  // time ran out
  clock: [
    { tag: 'circle', paint: 'stroke', cx: 12, cy: 12, r: 8.5 },
    s('M12 7.5V12l3 2'),
  ],
  // still to act / waiting on somebody
  hourglass: [
    s('M6.5 3.5h11M6.5 20.5h11'),
    s('M8 3.5c0 4.5 4 5.5 4 8.5s-4 4-4 8.5M16 3.5c0 4.5-4 5.5-4 8.5s4 4 4 8.5'),
    f('M9.25 19.5h5.5c-.6-1.9-2.75-2.6-2.75-3.6 0 1-2.15 1.7-2.75 3.6z'),
  ],
  // a life (AniTune)
  heart: [f('M12 20.5S3.5 15 3.5 9.25A4.25 4.25 0 0 1 12 7a4.25 4.25 0 0 1 8.5 2.25C20.5 15 12 20.5 12 20.5z')],
  // out of lives / out of the game
  skull: [
    s('M12 3.5a7.5 7.5 0 0 0-7.5 7.5c0 2.6 1.3 4.4 3 5.5v3.5h9v-3.5c1.7-1.1 3-2.9 3-5.5A7.5 7.5 0 0 0 12 3.5z', 2),
    { tag: 'circle', paint: 'fill', cx: 9, cy: 11.5, r: 1.75 },
    { tag: 'circle', paint: 'fill', cx: 15, cy: 11.5, r: 1.75 },
    s('M10.5 20v-2.5M13.5 20v-2.5', 1.75),
  ],
  // buzzed in
  bell: [
    s('M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z'),
    s('M10 21a2 2 0 0 0 4 0'),
  ],
  // locked out of this one
  ban: [
    { tag: 'circle', paint: 'stroke', cx: 12, cy: 12, r: 8.5 },
    s('M6 18L18 6'),
  ],
  // writing an answer / a hand-written entry
  pencil: [s('M4 20l1-4.5L15.5 5a2.12 2.12 0 0 1 3 3L8 18.5zM13.5 7l3 3')],
  trash: [s('M4 6.5h16M9.5 6.5V4h5v2.5M6 6.5l1 14h10l1-14M10 10.5v6M14 10.5v6')],
  // import a list
  link: [s('M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1')],
  refresh: [s('M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 3.5V8H15')],
  // drag to reorder
  grip: [
    { tag: 'circle', paint: 'fill', cx: 9, cy: 6, r: 1.75 },
    { tag: 'circle', paint: 'fill', cx: 15, cy: 6, r: 1.75 },
    { tag: 'circle', paint: 'fill', cx: 9, cy: 12, r: 1.75 },
    { tag: 'circle', paint: 'fill', cx: 15, cy: 12, r: 1.75 },
    { tag: 'circle', paint: 'fill', cx: 9, cy: 18, r: 1.75 },
    { tag: 'circle', paint: 'fill', cx: 15, cy: 18, r: 1.75 },
  ],
  // a disclosure; rotate-90 for open
  chevron: [s('M9 5.5l6.5 6.5L9 18.5', 2.5)],
  play: [f('M7 4.5v15l12.5-7.5z')],
  pause: [f('M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z')],
  // a guess (AniGuess's trail): on target, and — slashed — a wrong one
  target: [
    { tag: 'circle', paint: 'stroke', cx: 12, cy: 12, r: 8.5 },
    { tag: 'circle', paint: 'stroke', cx: 12, cy: 12, r: 4.25 },
    { tag: 'circle', paint: 'fill', cx: 12, cy: 12, r: 1.5 },
  ],
  miss: [
    { tag: 'circle', paint: 'stroke', cx: 12, cy: 12, r: 8.5 },
    { tag: 'circle', paint: 'stroke', cx: 12, cy: 12, r: 4.25 },
    s('M4 20L20 4', 2.75),
  ],
  // hidden from you / look away
  'eye-off': [
    s('M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z'),
    { tag: 'circle', paint: 'fill', cx: 12, cy: 12, r: 2.75 },
    s('M4 20L20 4', 2.5),
  ],
  // play online
  globe: [
    { tag: 'circle', paint: 'stroke', cx: 12, cy: 12, r: 8.5 },
    s('M3.5 12h17M12 3.5c-3.2 3.4-3.2 13.6 0 17M12 3.5c3.2 3.4 3.2 13.6 0 17'),
  ],
  // pass the device
  phone: [
    { tag: 'rect', paint: 'stroke', x: 6.5, y: 2.5, width: 11, height: 19, rx: 2 },
    s('M10.5 18.5h3'),
  ],
  headphones: [
    s('M4 15.5V12a8 8 0 0 1 16 0v3.5'),
    { tag: 'rect', paint: 'fill', x: 3, y: 14, width: 4.5, height: 7, rx: 1.25 },
    { tag: 'rect', paint: 'fill', x: 16.5, y: 14, width: 4.5, height: 7, rx: 1.25 },
  ],
  note: [
    s('M9 18V5.5l10-2.5V15.5'),
    { tag: 'circle', paint: 'fill', cx: 6.5, cy: 18, r: 2.75 },
    { tag: 'circle', paint: 'fill', cx: 16.5, cy: 15.5, r: 2.75 },
  ],
  // a tie / a runoff
  scales: [
    s('M12 3.5v16.5M7.5 20h9M4.5 7h15'),
    s('M4.5 7L2 13a2.5 2.5 0 0 0 5 0zM19.5 7L17 13a2.5 2.5 0 0 0 5 0z', 1.75),
  ],
  // AniQuiz's two formats: a category board, and a straight run of questions
  grid: [f('M3.5 3.5h7.5v7.5H3.5zM13 3.5h7.5v7.5H13zM3.5 13h7.5v7.5H3.5zM13 13h7.5v7.5H13z')],
  list: [s('M8.5 6h12M8.5 12h12M8.5 18h12', 2.5), f('M3.5 4.5h3v3h-3zM3.5 10.5h3v3h-3zM3.5 16.5h3v3h-3z')],
  // talk it out
  speech: [s('M4 5h16v10.5h-8.5L7 19.5v-4H4z')],
  // the fake (AniFake) — a domino mask; the eye holes are cut out, not painted,
  // so it reads on any fill
  mask: [
    f(
      'M2.5 9c3-2 6.5-1.5 9.5 0 3-1.5 6.5-2 9.5 0 0 4.5-2.5 7.5-5.5 7.5-2 0-3-1.5-4-3-1 1.5-2 3-4 3-3 0-5.5-3-5.5-7.5z' +
        'M6.25 10.9a2.1 1.5 0 1 0 4.2 0 2.1 1.5 0 1 0-4.2 0zM13.55 10.9a2.1 1.5 0 1 0 4.2 0 2.1 1.5 0 1 0-4.2 0z',
      { fillRule: 'evenodd' },
    ),
  ],
  // the manga impact burst — a hit, a celebration, a Daily Double, a crash
  burst: [
    f('M12 1.5l2.4 5.6 5.7-2.6-2.2 5.9 5.6 2.1-5.6 2.4 2.6 5.7-5.9-2.2L12 22.5l-2.4-5.6-5.7 2.6 2.2-5.9L.5 11.5l5.6-2.4-2.6-5.7 5.9 2.2z'),
  ],
};
