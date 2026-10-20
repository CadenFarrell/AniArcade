import { accentBg } from '../ui/accents';
import { splitTitle } from '../utils/splitTitle';
import { Backdrop, Kana, Screen } from '../ui';

// The frame every setup screen and online lobby shares: a slim banner in the
// game's colour, players on the left and settings on the right (stacked on a
// phone), and a Start bar pinned to the bottom of the viewport.
//
// It replaced fourteen hand-built single columns that read as forms: a
// wordmark, an "Add player" button, a list, two tall settings cards, and Start
// at the very bottom — below the fold on every phone, so the one button the
// screen exists for was the one a player had to scroll to find, and the reason
// it was disabled sat somewhere above it. The banner is the cover page
// (ModePicker) at a fraction of its height, so every screen of a game is
// visibly that game.
//
// Content stays each screen's own: `left` (players, their warnings), `right`
// (settings), `start` (the bar). The layout owns only placement.
export default function SetupLayout({ game, tagline, onBack, aside, left, right, start }) {
  return (
    <>
      <Backdrop />
      {/* pb-36 clears the pinned Start bar so the last setting can scroll
          above it rather than sit permanently underneath. */}
      <Screen width="lg" onBack={onBack} className="pb-36!">
        <GameBanner game={game} tagline={tagline} aside={aside} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-8">
          <div className="min-w-0">{left}</div>
          <div className="min-w-0">{right}</div>
        </div>
      </Screen>
      {start}
    </>
  );
}

// The cover page's banner, slimmed to a header: game ink, kana, the split
// ANI / WORD title and the tagline. `aside` sits on the right of it — the
// lobby's room code, AniGuess's leaderboard button. Exported for screens that
// need the banner without the two-column frame.
export function GameBanner({ game, tagline, aside }) {
  const title = splitTitle(game.title);
  return (
    <header
      className={`mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-2 border-ink px-5 py-4 text-paper
        shadow-pop sm:px-7 ${accentBg(game.accent)}`}
    >
      {/* min-w-48, not min-w-0: the title has to keep its room, so a lobby's
          room code wraps under it on a phone instead of squeezing in beside it
          and running "GUESS" into "ROOM CODE". */}
      <div className="min-w-48 flex-1">
        {/* Full paper, as on ModePicker's cover: an 80% kana or prefix fell
            under 4.5:1 on the lighter game inks. */}
        {game.kana && <Kana className="block text-[11px]">{game.kana}</Kana>}
        <h1 className="font-display font-bold uppercase leading-none">
          <span className="sr-only">{game.title}</span>
          <span aria-hidden="true" className="flex items-baseline gap-2">
            {title.prefix && <span className="text-sm tracking-[0.35em]">{title.prefix}</span>}
            <span className="text-4xl tracking-wide sm:text-5xl">{title.word}</span>
          </span>
        </h1>
        {tagline && <p className="mt-1.5 text-sm leading-snug">{tagline}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  );
}

// The Start bar: pinned to the bottom of the viewport so Start is never below
// the fold, with one line beside it saying where things stand — "3 players ·
// 120 shows in play" when ready, the reason when not. That line is the point:
// a disabled button with its explanation two screens up is a dead end.
//
// z-30: above the page, below the top bar (z-40) and every modal (z-50), so a
// picker or an import opened from this screen covers it.
//
// The results screens pin their replay here too (shared/components/Results.jsx),
// often two buttons — so the row wraps: on a phone the buttons drop under the
// status line, right-aligned, rather than squeezing it to a word per line.
// `width` matches the screen's column (results screens are one `md` column),
// so the status line starts where the content above it does.
const BAR_WIDTHS = { md: 'max-w-2xl', lg: 'max-w-4xl' };

export function StartBar({ status, ready = false, width = 'lg', children }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-surface/95 backdrop-blur-sm">
      <div className={`mx-auto flex w-full ${BAR_WIDTHS[width]} flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 sm:px-6`}>
        <p
          className={`min-w-40 flex-1 text-sm leading-snug sm:text-base ${ready ? 'text-fg-body' : 'text-fg-helper'}`}
          aria-live="polite"
        >
          {status}
        </p>
        {/* max-w-full lets the group wrap inside itself too: two buttons wider
            than a phone together ("End & See Leaderboard" + "New Round") put
            the second under the first rather than off the edge of the screen. */}
        {children && <div className="ml-auto flex max-w-full shrink-0 flex-wrap justify-end gap-2">{children}</div>}
      </div>
    </div>
  );
}
