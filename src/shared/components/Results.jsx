import { createContext, useContext, useMemo } from 'react';
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
import { useStagger } from '../hooks/useStagger';
import { useStepCues } from '../hooks/useStepCues';
import CountUp from './CountUp';
import { useNextGameSlot } from '../context/nextGameContext';

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
//
// `ceremony` stages a FINAL screen: pass the number of rows in the Standings
// marked `build`. Those rows land from the bottom place up, each with a tick
// and its score counting up, and only then does the splash unveil the winner
// with its stamp — the room counts down to first place instead of reading it
// off the top of a page. The markup is complete from the first render
// (useStagger's rule), so nothing waits on it, and a press anywhere finishes
// it. Between-round screens leave it off: a stop the table passes through
// every round should not make them sit through a show.

// The timing one ceremony shares between its rows and its splash.
const CeremonyContext = createContext(null);
const ROW_STEP_MS = 280;
const ROW_LEAD_MS = 250;
// The pause between the last row (second place) landing and the winner: the
// beat that makes it a reveal rather than one more row.
const SPLASH_BEAT_MS = 450;

function useCeremony(rows, key) {
  const on = rows != null;
  const count = on ? Math.max(0, rows) : 0;
  const stagger = useStagger({ count, stepMs: ROW_STEP_MS, leadMs: ROW_LEAD_MS, order: 'reverse', key });
  const splashAt = count && !stagger.skipped ? stagger.totalMs + SPLASH_BEAT_MS : 0;
  // A tick as each row lands (bottom place first), the stamp with the winner.
  const steps = on ? [
    ...Array.from({ length: count }, (_, i) => ({ atMs: ROW_LEAD_MS + i * ROW_STEP_MS, name: 'select' })),
    { atMs: count ? ROW_LEAD_MS + (count - 1) * ROW_STEP_MS + SPLASH_BEAT_MS : 0, name: 'stamp' },
  ] : [];
  useStepCues(steps, on ? key : null, { skip: stagger.skipped });
  return on ? { ...stagger, splashAt } : null;
}

export default function ResultsLayout({
  game, title, subtitle, players, onBack, backLabel, splash, bar, children, ceremony = null,
}) {
  // The game's own share-out when it provides one (TablePortraits), so the
  // results wear exactly the faces the turn strip did; this screen's own
  // otherwise — a results screen mounted alone, in a test.
  const outer = useTablePortraits();
  const own = useMemo(() => (outer ? null : portraitsFor(players ?? [])), [outer, players]);
  // An online room's final results carry the "Next game" panel under the
  // recap (shared/context/nextGameContext.js); null everywhere else.
  const nextGame = useNextGameSlot();
  const staged = useCeremony(ceremony, `${game.id}:${title}`);
  return (
    <TablePortraitsContext.Provider value={outer ?? own}>
      <Backdrop />
      {/* pb-36 clears the pinned bar, as on the setup screens. */}
      <Screen width="md" onBack={onBack} backLabel={backLabel} className="pb-36!">
        <ResultsBanner game={game} title={title} subtitle={subtitle} />
        <CeremonyContext.Provider value={staged}>
          <div {...(staged?.rootProps ?? {})}>
            {splash}
            {children}
          </div>
        </CeremonyContext.Provider>
        {nextGame}
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
export function Splash({
  players = [], stamp, kana, kicker, title, score, quiet = false, art = null, children,
}) {
  const faces = players.slice(0, 4);
  const names = title ?? players.map((p) => p.name).join(' & ');
  // Inside a ceremony the splash is the LAST thing to land, and the
  // ceremony's own cues sound its stamp on that beat.
  const staged = useContext(CeremonyContext);
  // The stamp lands with a thud, on every phone: the result is the one moment
  // the whole table is looking at the same thing. `quiet` where the moment has
  // a sound of its own already (AniGuess's solve lands with `correct`).
  useSoundCue(quiet || staged ? null : 'stamp', stamp ? `${stamp}:${names}` : null);
  const at = staged?.splashAt ?? 0;
  return (
    <section
      aria-label={[stamp, names].filter(Boolean).join(': ')}
      style={at ? { animationDelay: `${at}ms` } : undefined}
      className={`mb-6 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] overflow-hidden border-2 border-ink bg-surface
        shadow-pop ${staged ? 'curtain-in' : ''}`}
    >
      <div aria-hidden="true" className="flex min-h-48 border-r-2 border-ink bg-surface-2 sm:min-h-60">
        {/* `art` replaces the faces with a picture the moment is about —
            AniGuess's solve shows the character you turned out to be, which
            is the punchline; your own face beside it would be a second
            character competing with it. */}
        {art ? (
          <div className="relative isolate flex-1 overflow-hidden">{art}</div>
        ) : faces.length ? faces.map((p) => <SplashFace key={p.id} player={p} />) : (
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
        {stamp && <Stamp delayMs={at}>{stamp}</Stamp>}
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
function Stamp({ delayMs = 0, children }) {
  return (
    <span
      // Staged: it slams down as the curtain finishes, not under it.
      style={delayMs ? { animationDelay: `${delayMs + 380}ms` } : undefined}
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
 *
 * `build` marks the one Standings a ceremony stages (see ResultsLayout): its
 * rows land bottom place first and each total counts up — from `previous[id]`
 * where the game knows where a player stood before the last round, else from 0.
 * The count runs on `p.total` and goes through `score` for its look, so a
 * formatter must read the total off the player it is handed.
 */
export function Standings({
  title = 'Standings', ranked, score, extra, departedIds = [], scoreClass = 'text-pop-amber', className = '',
  build = false, previous = null,
}) {
  const ceremony = useContext(CeremonyContext);
  const staged = build ? ceremony : null;
  if (!ranked.length) return null;
  const look = (p) => (score ? score(p) : p.total);
  return (
    <Card title={title} padding="sm" className={`mb-6 ${className}`}>
      <ol>
        {ranked.map((p, i) => (
          <StandingRow
            key={p.id}
            player={p}
            left={departedIds.includes(p.id)}
            score={staged && typeof p.total === 'number' ? (
              <CountUp
                value={p.total}
                from={previous?.[p.id] ?? 0}
                delayMs={staged.delay(i)}
                skip={staged.skipped}
                format={(n) => look({ ...p, total: n })}
              />
            ) : look(p)}
            extra={extra?.(p)}
            scoreClass={typeof scoreClass === 'function' ? scoreClass(p) : scoreClass}
            style={staged?.style(i)}
            staged={!!staged}
          />
        ))}
      </ol>
    </Card>
  );
}

function StandingRow({ player, left, score, extra, scoreClass, style, staged }) {
  const portrait = usePlayerPortrait(player);
  return (
    <li
      style={style}
      className={`flex items-center gap-3 border-b border-line px-1 py-2.5 last:border-0 ${staged ? 'reveal-row' : ''}`}
    >
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

/**
 * A final screen's superlatives: up to three, each a face, a title in display
 * caps and the line that earned it ("Fastest finger — 1.2s on Gurenge"). Each
 * game derives its own in a pure module from what the match already recorded,
 * so an award is a fact about the game, never a pat on the back for everyone.
 * An empty list draws nothing.
 */
export function Awards({ awards = [], className = '' }) {
  const shown = awards.filter(Boolean).slice(0, 3);
  if (!shown.length) return null;
  return (
    <Card title="Awards" padding="sm" className={`mb-6 ${className}`}>
      <ul>
        {shown.map((a) => <AwardRow key={a.title} award={a} />)}
      </ul>
    </Card>
  );
}

function AwardRow({ award }) {
  const portrait = usePlayerPortrait(award.player);
  return (
    <li className="flex items-center gap-3 border-b border-line px-1 py-2.5 last:border-0">
      <span
        aria-hidden="true"
        className="relative isolate h-11 w-11 shrink-0 overflow-hidden border-2 border-ink bg-surface-2"
      >
        <Portrait portrait={portrait} name={award.player?.name ?? ''} initialClass="text-xl" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-bold uppercase tracking-[0.2em] text-pop-amber">
          {award.title}
        </span>
        <span className="block truncate font-display text-lg font-bold uppercase leading-tight tracking-wide text-fg-strong">
          {award.player?.name}
        </span>
        {award.detail && <span className="block text-sm text-fg-helper">{award.detail}</span>}
      </span>
    </li>
  );
}
