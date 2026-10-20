// Decorative Japanese — see kanaText.js for why it is always hidden from assistive
// tech and why every string must come from there or from a game's `kana`.
//
// `vertical` sets it top-to-bottom the way a manga's own captions run. The
// letter-spacing is on the component because katakana set in a heavy gothic
// with no tracking reads as one black bar at small sizes.
export default function Kana({ vertical = false, className = '', children }) {
  return (
    <span
      aria-hidden="true"
      lang="ja"
      className={`font-kana font-normal tracking-[0.12em] select-none
        ${vertical ? '[writing-mode:vertical-rl]' : ''} ${className}`}
    >
      {children}
    </span>
  );
}
