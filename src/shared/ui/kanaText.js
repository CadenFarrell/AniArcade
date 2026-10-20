// Every piece of Japanese the app renders, and the glyphs the kana font has.
//
// Named kanaText.js, NOT kana.js, beside Kana.jsx. On Windows and macOS the
// filesystem is case-insensitive and Vite tries `.js` before `.jsx`, so an
// import of './Kana' resolved to this data module and every screen rendering
// <Kana> crashed on "element type is invalid" — on those machines only.
//
// All of it is decoration — the katakana beside a title, the way both reference
// pages scatter Japanese over the layout — and none of it is ever needed to
// understand a screen, which is why <Kana> is always aria-hidden. A screen reader
// announcing "a-ni-a-a-ke-e-do" before "AniArcade" would be noise.
//
// A .js module rather than inline strings for shared/ui/icons.js's reason: every
// failure here is silent. public/fonts/delagothicone-kana.woff2 is a CUT of the
// font holding only KANA_GLYPHS, and a character outside it does not error — the
// browser quietly draws that one glyph in a system font, mid-word, at a
// different weight. `kanaText.test.js` pins every string below (and every
// game's `kana`) against the set.

export const KANA = {
  arcade: 'アニアーケード', // "AniArcade"
  pickGame: 'ゲームを選べ', // "pick a game"
  start: 'スタート', // "start"
  loading: 'ロード中', // "loading"
  credits: 'クレジット', // "credits"
  error: 'エラー', // "error"
  results: 'リザルト', // "results"
  winner: 'ウィナー', // "winner"
  draw: 'ドロー', // "draw" — a tie for first
  round: 'ラウンド', // "round"
  fake: 'フェイク', // "fake" — AniFake's reveal
  pass: 'パス', // "pass" — the pass-the-device panel
  hit: 'ヒット', // "hit" — a right answer's impact frame
  miss: 'ミス', // "miss" — a wrong one's
};

// The whole katakana block (U+30A0–30FF), so a new game's name never needs the
// font re-cut, plus the four non-katakana characters KANA uses. Anything
// outside the block DOES need a re-cut — kanji are not a block you can take
// whole, the font holds thousands. To re-cut after adding a character here:
// request
//   https://fonts.googleapis.com/css2?family=Dela+Gothic+One&text=<this string, URL-encoded>
// with a browser User-Agent (Google serves woff2 only to one), download the
// fonts.gstatic.com URL in the response over public/fonts/delagothicone-kana.woff2,
// and copy its unicode-range into the @font-face in index.css.

export const KANA_GLYPHS =
  Array.from({ length: 0x30ff - 0x30a0 + 1 }, (_, i) => String.fromCodePoint(0x30a0 + i)).join('') +
  'べを中選';
