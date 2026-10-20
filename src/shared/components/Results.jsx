import { useMemo } from 'react';
import { accentBg } from '../ui/accents';
import { KANA } from '../ui/kanaText';
import { splitTitle } from '../utils/splitTitle';
import { portraitsFor } from '../utils/portrait';
import {
  TablePortraitsContext, usePlayerPortrait, useTablePortraits,
} from '../context/tablePortraitsContext';
import { Backdrop, Card, Kana, PlaceMark, Screen } from '../ui';
import Portrait from './Portrait';
import { useSoundCue } from '../hooks/useSoundCue';

// The frame every results screen shares — the final standings of every game and
// the stops between rounds (AniGuess's "Round 2 Done!", AniTag's round end).
// Same idea as SetupLayout, the other end of the same game: a banner in the
// game's ink, a splash panel for whoever the screen is about, the standings, the
// game's own recap below them, and the replay pinned to the bottom of the
// viewport (`bar`, a StartBar) so it is one tap however long the recap runs —
// AniRank's and AniFake's run several screens tall.
//
// It replaced seven hand-built screens that ended every game on the same
// wordmark-and-list, with the colour swapped. The finish is the moment a table
// looks at the screen together, and the one most worth making feel like this
// game rather than a form that happened to have scores in it.
//
// `players` is the whole table in seat order, the order the setup screen sat
// them in, so the portraits shared out here (portraitsFor) are the same faces
// the slots wore — the winner is the character they sat down as.

export default function ResultsLayout({
  game, title, subtitle, players, onBack, backLabel, splash, bar, children,
}) {
  // The game's own share-out when it provides one (TablePortraits), so the
  // results wear exactly the faces the turn strip did; this screen's own
  // otherwise — a results screen mounted alone, in a test.
  const outer = useTablePortraits();
  const own = useMemo(() => (outer ? null : portraitsFor(players ?? [])), [outer, players]);
  return (
    <TablePortraitsContext.Provider value={outer ?? own}>
      <Backdrop />
      {/* pb-36 clears the pinned bar, as on the setup screens. */}
      <Screen width="md" onBack={onBack} backLabel={backLabel} className="pb-36!">
        <ResultsBanner game={game} title={title} subtitle={subtitle} />
        {splash}
        {children}
      </Screen>
      {bar}
    </TablePortraitsContext.Provider>
  );
}

// The setup banner turned round: there the game's name is the heading, here the
// screen's is ("Final Scores", "Reveal") and the game's name shrinks to the line
// above it. The screen title being the page's FIRST heading is load-bearing —
// the playtest bots tell a results screen by it (strategies/anifake.js waits for
// "Reveal", anirank.js for "Results"), and so does a screen reader landing here.
//
// No opacity on any text: paper on a game ink only just clears 4.5:1 for some
// accents, and the hub tile's faded "ANI" is what axe flagged.
function ResultsBanner({ game, title, subtitle }) {
  const name = splitTitle(game.title);
  return (
    <header
      className={`relative mb-6 overflow-hidden border-2 border-ink px-5 py-4 text-paper shadow-pop sm:px-7
        ${accentBg(game.accent)}`}
    >
      <p className="flex items-baseline gap-1.5 font-display font-bold uppercase leading-none">
        {name.prefix && <span className="text-xs tracking-[0.35em]">{name.prefix}</span>}
        <span className="text-base tracking-[0.2em]">{name.word}</span>
        <Kana className="ml-auto text-[11px]">{KANA.results}</Kana>
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none tracking-wide sm:text-5xl">
        {title}
      </h1>
      {subtitle && <p className="mt-1.5 text-sm leading-snug">{subtitle}</p>}
    </header>
  );
}

/**
 * The headline panel: whoever this screen is about — the winner, the round's
 * leader, AniFake's fake — wearing their portrait, with a stamp across it.
 *
 * `players` is one or more (a tie shares the panel rather than the first name
 * winning on seat order); `kicker` is a small line above the name, `score` the
 * number in the score colour, and children the detail under it.
 */
export function Splash({ players = [], stamp, kana, kicker, title, score, quiet = false, children }) {
  const faces = players.slice(0, 4);
  const names = title ?? players.map((p) => p.name).join(' & ');
  // The stamp lands with a thud, on every phone: the result is the one moment
  // the whole table is looking at the same thing. `quiet` where the moment has
  // a sound of its own already (AniGuess's solve lands with `correct`).
  useSoundCue(quiet ? null : 'stamp', stamp ? `${stamp}:${names}` : null);
  return (
    <section
      aria-label={[stamp, names].filter(Boolean).join(': ')}
      className="mb-6 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] overflow-hidden border-2 border-ink bg-surface
        shadow-pop"
    >
      <div aria-hidden="true" className="flex min-h-48 border-r-2 border-ink bg-surface-2 sm:min-h-60">
        {faces.length ? faces.map((p) => <SplashFace key={p.id} player={p} />) : (
          <div className="relative isolate flex-1 overflow-hidden">
            <span className="halftone absolute inset-0 opacity-40" />
          </div>
        )}
      </div>
      <div className="relative flex min-w-0 flex-col justify-center gap-2 p-4 sm:p-6">
        {/* Screentone in the far corner, fading out — the panel's one texture,
            away from the text it would otherwise sit under. */}
        <span
          aria-hidden="true"
          className="halftone pointer-events-none absolute top-0 right-0 h-28 w-28 opacity-30
            [mask-image:radial-gradient(circle_at_top_right,#000,transparent_70%)]"
        />
        {kana && <Kana className="text-xs text-fg-subtle">{kana}</Kana>}
        {stamp && <Stamp>{stamp}</Stamp>}
        {kicker && (
          <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-fg-helper">{kicker}</p>
        )}
        <p
          className="font-display text-3xl font-bold uppercase leading-[0.95] tracking-wide text-fg-strong
            [overflow-wrap:anywhere] sm:text-5xl"
        >
          {names}
        </p>
        {score != null && (
          <p className="font-display text-2xl font-bold tabular-nums text-pop-amber sm:text-3xl">{score}</p>
        )}
        {children && <div className="text-sm leading-snug text-fg-body sm:text-base">{children}</div>}
      </div>
    </section>
  );
}

function SplashFace({ player }) {
  const portrait = usePlayerPortrait(player);
  return (
    <div className="relative isolate flex-1 overflow-hidden border-l-2 border-ink first:border-l-0">
      <Portrait portrait={portrait} name={player.name} initialClass="text-6xl" />
    </div>
  );
}

// A hanko-style stamp, in the brand red: the one mark on the page that is
// decoration rather than meaning, which is the brand ink's job. It slams down
// as the page turns (stamp-in — a scale, no fade), and under reduced motion
// simply is there.
function Stamp({ children }) {
  return (
    <span
      className="stamp-in inline-block self-start -rotate-6 border-[3px] border-pop-pink px-2.5 py-0.5
        font-display text-lg font-bold uppercase leading-tight tracking-[0.2em] text-pop-pink sm:text-xl"
    >
      {children}
    </span>
  );
}

/**
 * The table, ranked: place, face, name, and the score in its own column. Each
 * game passes its own `score(p)` formatting (AniQuiz signs a negative, AniTune
 * prints decimals) and `extra(p)` for anything a row carries besides — lives, a
 * round's +points. A player in `departedIds` stays, dimmed and tagged, so the
 * result does not read as though they played it out — the FACE dims, not the
 * row: an opacity over the name took it under 4.5:1 (axe flagged it on
 * AniFake's online reveal), and a departed player's name and score are still
 * results somebody reads.
 */
export function Standings({
  title = 'Standings', ranked, score, extra, departedIds = [], scoreClass = 'text-pop-amber', className = '',
}) {
  if (!ranked.length) return null;
  return (
    <Card title={title} padding="sm" className={`mb-6 ${className}`}>
      <ol>
        {ranked.map((p) => (
          <StandingRow
            key={p.id}
            player={p}
            left={departedIds.includes(p.id)}
            score={score ? score(p) : p.total}
            extra={extra?.(p)}
            scoreClass={typeof scoreClass === 'function' ? scoreClass(p) : scoreClass}
          />
        ))}
      </ol>
    </Card>
  );
}

function StandingRow({ player, left, score, extra, scoreClass }) {
  const portrait = usePlayerPortrait(player);
  return (
    <li className="flex items-center gap-3 border-b border-line px-1 py-2.5 last:border-0">
      <span className="w-9 shrink-0 text-center text-xl">
        {player.position != null && <PlaceMark place={player.position} />}
      </span>
      <span
        aria-hidden="true"
        className={`relative isolate h-11 w-11 shrink-0 overflow-hidden border-2 border-ink bg-surface-2
          ${left ? 'opacity-40' : ''}`}
      >
        <Portrait portrait={portrait} name={player.name} initialClass="text-xl" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate font-display text-lg font-bold uppercase leading-tight tracking-wide
            ${left ? 'text-fg-subtle' : 'text-fg-strong'}`}
        >
          {player.name}
        </span>
        {left && <span className="block text-sm font-bold text-fg-helper">left</span>}
      </span>
      {extra}
      <span className={`shrink-0 font-display text-xl font-bold tabular-nums ${scoreClass}`}>{score}</span>
    </li>
  );
}
