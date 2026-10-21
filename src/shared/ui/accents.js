// A game descriptor's `accent` as its solid fill class. Literal strings, because
// Tailwind only generates the classes it can read in source. Shared by the hub
// tile's title bar and the game's cover page (ModePicker), which are meant to
// read as the same object: the tile you tapped, opened.
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
