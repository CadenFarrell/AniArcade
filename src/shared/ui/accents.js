// A game descriptor's `accent` as its solid fill class. Literal strings, because
// Tailwind only generates the classes it can read in source. Shared by the hub
// tile's title bar and the game's cover page (ModePicker), which are meant to
// read as the same object: the tile you tapped, opened. The menus' backdrop
// carries the same ink through `accentVar` below.
export const ACCENT_BG = {
  pink: 'bg-pop-pink',
  purple: 'bg-pop-purple',
  lime: 'bg-pop-lime',
  amber: 'bg-pop-amber',
  blue: 'bg-pop-blue',
  teal: 'bg-pop-teal',
  red: 'bg-pop-red',
  plum: 'bg-pop-plum',
};

export const accentBg = (accent) => ACCENT_BG[accent] ?? ACCENT_BG.pink;

// The same ink as a CSS value, for a texture that takes its colour from a custom
// property (`--lines`, `--tone`, `--slash`) — Backdrop's cover variant. Looked up
// rather than built from the name, so an unknown accent falls back to pink
// instead of producing `var(--color-pop-undefined)`, which paints nothing.
export const ACCENT_VAR = {
  pink: 'var(--color-pop-pink)',
  purple: 'var(--color-pop-purple)',
  lime: 'var(--color-pop-lime)',
  amber: 'var(--color-pop-amber)',
  blue: 'var(--color-pop-blue)',
  teal: 'var(--color-pop-teal)',
  red: 'var(--color-pop-red)',
  plum: 'var(--color-pop-plum)',
};

export const accentVar = (accent) => ACCENT_VAR[accent] ?? ACCENT_VAR.pink;
