import { Icon } from '../shared/ui';

// The main profile's play record, from the hub's top bar. It was a card under
// the board (the record strip), but the menu page is for the games: everything
// else lives in the bar's corners, beside the profile it belongs to. So it only
// shows with a main profile — with none, there is nobody whose record it is —
// and a friend's record still opens from their row in the profile picker.
//
// Icon-only, styled as Mute and How to play beside it: a quiet glyph in the bar,
// not a block competing with the profile pill. The trophy is the one the
// picker's rows wear, so both ways in look the same. Its name is the words —
// and those words are what the playtest bots refuse (playtest/core/generic.js),
// since the record is a page with no game on it.
export default function RecordButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Your record"
      title="Your record"
      className="focus-pop grid h-10 w-10 place-items-center rounded-pop-sm text-xl text-fg-icon
        transition-colors hover:bg-wash hover:text-fg-strong"
    >
      <Icon name="trophy" />
    </button>
  );
}
