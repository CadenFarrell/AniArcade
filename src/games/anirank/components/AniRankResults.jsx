import { useState } from 'react';
import { READER_BONUS, bestReaders, explainBoard, truthFor } from '../rules';
import { useCeremonyTiming } from '../../../shared/context/ceremonyContext';
import { getAxis, isOpinion } from '../axes';
import { computeRankedPlayers } from '../../../shared/utils/ranking';
import { railTone } from '../utils/rail';
import ResultsLayout, { Splash } from '../../../shared/components/Results';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Badge, Banner, Button, Card, Icon, PlaceMark } from '../../../shared/ui';
import { KANA } from '../../../shared/ui/kanaText';
import { useSoundCue } from '../../../shared/hooks/useSoundCue';
import descriptor from '../index';

// The reveal. Shows the answer key once, then each player's board against it —
// on a fact axis the `value` is deliberately never rendered before this screen.
//
// Three shapes over one layout, because the only thing that really differs is
// where the answer key came from and whether it is worth points:
//
//   fact + scoring     the true order, then everyone against it
//   opinion + scoring  the subject's own board, then everyone's guess at it
//   scoring off        every board side by side, no key and no points
//
// The board is drawn as a slopegraph: the player's ranking down the left, the
// real ranking down the right, one line per card between them. That is not a
// decoration, it is the score — two lines cross exactly when those two cards are
// the wrong way round, which is precisely what scoreBoard's Kendall tau counts.
// So the number of crossings IS the number of points lost, and the picture needs
// no key to read: parallel lines mean you nailed it, a knot means you didn't.
//
// Every earlier attempt failed by encoding the answer as a NUMBER inside a cell
// whose POSITION meant something else — a card's true rank printed in the slot
// you put it in, so "1 next to 6" looked like a claim that ranks 1 and 6 are
// neighbours. Two coordinate systems in one square. The slopegraph gives each
// its own column and joins them with a line, so there is nothing left to decode.
export default function AniRankResults({
  players, boards, deck, axis: axisSpec, subjectId, scoring = true, totalScores,
  roundScores = null, departedIds = [], onPlayAgain, playAgainLabel = 'Play again',
  // The match's way out early, beside the next round (null on its last round
  // and for an online guest), and the "Round 2 of 3" tag.
  onEndMatch = null, matchTag = null,
  // onBack is local-only: online "again" returns to the lobby, and there is no
  // local setup to go back to. Screen omits the row when it is undefined.
  onBack,
}) {
  const axis = getAxis(axisSpec);
  const opinion = isOpinion(axis);
  const subject = players.find((p) => p.id === subjectId) ?? null;
  // Which player's board is expanded. One at a time: two open diagrams is twenty
  // rows, which is the scrolling the summary tangle exists to avoid.
  const [openId, setOpenId] = useState(null);

  // Rebuilt from the same helper the scoring used, so nothing drawn below can
  // disagree with the points awarded. Null when there is nothing to score
  // against — an unscored round, or a subject who never finished their board.
  const truth = scoring ? truthFor({ deck, boards, subjectId }, { opinion }) : null;
  const scored = Boolean(truth);

  // The subject is never scored against the answer key, because they ARE it —
  // doing so returns a flawless board every time, which reads as praise for a
  // round they did not play. Passing null is what explainBoard reads as "no key".
  const isSubject = (id) => opinion && id === subjectId;
  const details = Object.fromEntries(players.map((p) => (
    [p.id, explainBoard(boards?.[p.id], deck, isSubject(p.id) ? null : truth)]
  )));

  // One shared ranking helper across the arcade, so ties behave the same way
  // here as they do on AniGuess's leaderboard.
  const ranked = scored ? computeRankedPlayers(players, totalScores) : players;

  // The headline names the best board OF THIS ROUND, not the leader: online
  // `totalScores` is the running room total, so the player in front may not be
  // the one who just played well. Ties share the billing rather than the first
  // name winning on alphabetical order.
  const contenders = players.filter((p) => !isSubject(p.id));
  const best = contenders.reduce((n, p) => Math.max(n, details[p.id].concordant), -1);
  const winners = contenders.filter((p) => details[p.id].concordant === best);
  const headline = scored && winners.length ? {
    perfect: details[winners[0].id].perfect,
    detail: details[winners[0].id],
    names: winners.map((p) => p.name),
  } : null;

  // History is recorded once per MATCH, on AniRankFinal — this screen is the
  // stop between rounds now (play-history rule: final results only).

  // Who read the subject best (rules.bestReaders), from the guess scores alone,
  // so the bonus is said beside the board that earned it.
  const guessScores = Object.fromEntries(contenders.map((p) => [p.id, details[p.id].concordant]));
  const readers = opinion && scored ? bestReaders(guessScores, subjectId) : [];

  // The order coming out. A scored round's splash stamps with its own thud; an
  // unscored one has no splash, so it gets the plain reveal instead of silence.
  useSoundCue('reveal', headline ? null : 'unscored');

  return (
    <ResultsLayout
      game={descriptor}
      title="Results"
      subtitle={[`${axis.label}${opinion && subject ? ` · as ${subject.name} would` : ''}`, matchTag].filter(Boolean).join(' · ')}
      players={players}
      // The real order lands as a countdown, #10 up to #1, then the best board
      // is unveiled: the order coming out is the moment the round was for.
      ceremony={scored ? { rows: truth.length, order: 'reverse' } : null}
      onBack={onBack}
      backLabel="← Back to setup"
      // The splash names the best board OF THIS ROUND (see `headline`), wearing
      // that player's portrait. A perfect board is the rarest thing this game
      // produces — 45 of 45 comparisons — so it alone gets the "Perfect" stamp;
      // a merely-best board is the ordinary outcome of every round.
      splash={headline && (
        <Splash
          players={winners}
          stamp={headline.perfect ? 'Perfect' : winners.length > 1 ? 'Tied' : 'Best board'}
          kana={winners.length > 1 && !headline.perfect ? KANA.draw : KANA.winner}
          kicker={headline.perfect ? 'Got it perfect' : 'Best board this round'}
          title={headline.names.join(' & ')}
          score={`${headline.detail.concordant} / ${headline.detail.comparisons}`}
        >
          comparisons right
        </Splash>
      )}
      bar={(
        <StartBar width="md" status={axis.label} ready>
          {onEndMatch && <Button variant="secondary" size="lg" onClick={onEndMatch}>End match</Button>}
          {onPlayAgain && <Button variant="primary" size="lg" onClick={onPlayAgain}>{playAgainLabel}</Button>}
        </StartBar>
      )}
    >
      {scored && (
        <Card
          title={opinion
            ? `${subject ? `${subject.name}’s` : 'The subject’s'} actual order`
            : 'The real order'}
          padding="lg"
          className="mb-6"
        >
          <ol className="flex flex-col gap-1.5">
            {truth.map((item, i) => (
              <TruthRow key={item.id} index={i}>
                <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-pop-sm
                  bg-pop-lime font-display text-sm font-black text-paper">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-base font-extrabold text-fg-strong">
                  {item.title}
                </span>
                {/* Only a fact axis has a number to show — an opinion round's
                    key is a person's taste, which has no units. */}
                {!opinion && item.value != null && (
                  <Badge tone="neutral">{axis.format(item.value)}</Badge>
                )}
              </TruthRow>
            ))}
          </ol>
        </Card>
      )}

      {!scored && (
        <Banner tone="warning" className="mb-6">
          {scoring
            ? 'No answer key this round — the subject never finished their board.'
            : 'No points this round. Compare, argue, move on.'}
        </Banner>
      )}

      <AfterSplash>
      <Card title={scored ? 'Scores' : 'Everyone’s boards'} padding="lg" className="mb-6">
        {/* The one thing worth stating, because it turns the picture into the
            arithmetic: crossings are not a metaphor for mistakes, they are
            individually the points that were lost. */}
        {scored && (
          <p className="-mt-1 mb-4 text-sm leading-snug text-fg-subtle">
            Every line runs from where you put a show to where it belonged.
            Lines that <strong className="font-bold text-fg-body">cross</strong> are the
            pairs you had the wrong way round — one point each. On an opened board,{' '}
            <Icon name="check" className="text-fg-body" /> means a show is in its
            right slot and <strong className="font-bold text-fg-body">×2</strong> means two
            others ended up on the wrong side of it — a show can have both.
          </p>
        )}

        {ranked.map((p) => {
          const gone = departedIds.includes(p.id);
          const subj = isSubject(p.id);
          const detail = details[p.id];
          const judged = scored && !subj;
          const open = openId === p.id;
          const delta = roundScores?.[p.id];
          return (
            <div key={p.id} className={`mb-6 last:mb-0 ${gone ? 'opacity-40' : ''}`}>
              <div className="mb-2 flex items-center gap-2">
                {scored && (
                  <span className="font-display text-lg font-black text-fg-body">
                    <PlaceMark place={p.position} />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-fg-strong">
                  {p.name}{gone && ' · left'}
                </span>
                {subj && <Badge tone="purple">Subject</Badge>}
                {detail.perfect && <Badge tone="lime">Perfect!</Badge>}
                {readers.includes(p.id) && <Badge tone="purple">Best reader +{READER_BONUS}</Badge>}
                {/* Only online, where the amber badge is the running room total
                    and says nothing about the round just played. */}
                {scored && delta != null && <Badge tone="lime">+{delta}</Badge>}
                {scored && <Badge tone="amber">{p.total} pts</Badge>}
              </div>

              {/* Collapsed, a player is still the same picture — just small and
                  stripped of labels. Reusing the drawing rather than inventing
                  a compact encoding is the point: there is no second visual
                  language to learn, and "tangled" reads before any number does.
                  Kept narrow and squarish rather than stretched across the card:
                  ten lines over 600px lie almost flat and read as a barcode,
                  where the same lines over 110px have slope and read as a knot. */}
              <div className="flex items-center gap-3">
                {judged && (
                  <Tangle
                    slots={detail.slots}
                    size={deck.length}
                    className="h-16 w-28 flex-shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  {subj && scored && (
                    // Explained inline, because a score you did not earn by
                    // guessing looks like a bug otherwise.
                    <p className="mb-1 text-sm text-fg-subtle">
                      How predictable you were — the average of everyone&rsquo;s guesses
                    </p>
                  )}
                  {judged && (
                    <p className="text-sm text-fg-helper">
                      <strong className="font-bold text-fg-strong">
                        {detail.concordant} of {detail.comparisons}
                      </strong>{' '}
                      comparisons right · {detail.inversions} crossed
                    </p>
                  )}
                  {/* The disclosure sits under the numbers that say whether it
                      is worth opening. One per player, so it names whose board
                      (sr-only — the card it sits in already says so to the
                      eye), and min-h-6 lifts the bare text-sm line to the 24px
                      tap floor. The triangle is decoration; aria-expanded
                      already says open or shut. */}
                  <button
                    onClick={() => setOpenId(open ? null : p.id)}
                    aria-expanded={open}
                    className="focus-pop mt-0.5 min-h-6 rounded-pop-sm font-display text-sm font-black
                      text-fg-subtle transition-colors hover:text-fg-strong"
                  >
                    <span aria-hidden="true">{open ? '▾ ' : '▸ '}</span>
                    {open ? 'hide board' : 'see board'}
                    <span className="sr-only"> — {p.name}</span>
                  </button>
                </div>
              </div>

              {open && (
                <BoardDiagram detail={detail} axis={axis} size={deck.length} judged={judged} />
              )}
            </div>
          );
        })}
      </Card>
      </AfterSplash>

    </ResultsLayout>
  );
}

// How much blame a card carries before its line goes from amber to red. Two is
// about the point at which a card stops looking like a near miss on a board of
// ten and starts looking like a guess.
const NEAR = 2;

// Per-card blame, not slot distance. A card three slots from home has zero
// conflicts if everything it passed was tied with it, and the old drift-based
// colouring called that a mistake.
const blameHex = (conflicts) => (
  conflicts === 0 ? 'var(--color-pop-lime)'
    : conflicts <= NEAR ? 'var(--color-pop-amber)' : 'var(--color-pop-red)'
);
const blameTone = (conflicts) => (
  conflicts === 0 ? 'border-pop-lime bg-pop-lime/20 text-pop-lime'
    : conflicts <= NEAR ? 'border-pop-amber bg-pop-amber/20 text-pop-amber'
      : 'border-pop-red bg-pop-red/20 text-pop-red'
);

// The diagram's row geometry, in px, kept next to the classes that produce it:
// `h-10` rows in a `gap-1.5` column. The lines have to land on row centres, so
// this is the one place a Tailwind value is also needed as a number — change one
// and change the other.
const ROW_H = 40;
const ROW_GAP = 6;

// The lines themselves, shared by the small summary and the full diagram.
//
// viewBox 0-100 on both axes with preserveAspectRatio="none" so the drawing
// stretches to whatever box it is given: the summary is short and wide, the
// diagram is exactly as tall as its rows. Stretching does not disturb the one
// property that matters — two lines cross iff those cards are inverted — because
// crossings survive any monotonic scaling of either axis. non-scaling-stroke
// keeps the strokes an even weight through that stretch.
//
// `rows` switches the vertical mapping. Beside a real column the centres have to
// account for the gaps between rows, or the lines drift several pixels off the
// rows they point at by the bottom of the board; the summary band has no rows to
// line up with, so it spaces them evenly.
//
// No `w-full` here on purpose: the caller sets the width, and a base width class
// would silently fight the one passed in — two Tailwind classes setting the same
// property are resolved by stylesheet order, not by call order.
function Tangle({ slots, size, rows = false, className = '' }) {
  const n = Math.max(size, 1);
  const total = rows ? n * ROW_H + (n - 1) * ROW_GAP : n;
  const mid = (i) => ((rows ? i * (ROW_H + ROW_GAP) + ROW_H / 2 : i + 0.5) / total) * 100;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className}
    >
      {slots.map((slot, i) => (
        slot.item && slot.trueSlot != null && (
          <line
            key={i}
            x1="0"
            y1={mid(i)}
            x2="100"
            y2={mid(slot.trueSlot - 1)}
            stroke={blameHex(slot.conflicts)}
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )
      ))}
    </svg>
  );
}

// One player's board in full: their ranking on the left, the real ranking on the
// right, the lines between them in the middle.
//
// The right-hand column is numbers only, deliberately. The titled answer key is
// already its own card above, and two columns of anime titles cannot both be
// legible in the ~300px a 390px phone leaves inside a Card — so the left column
// keeps the titles and the right keeps the ranking.
function BoardDiagram({ detail, axis, size, judged }) {
  // Fixed row height, because the SVG maps row centres by proportion: if a row
  // grew (a wrapped title) the lines would land between rows instead of on them.
  const row = 'h-10 flex items-center';
  return (
    <div className="mt-3">
      {/* Both axis words sit beside the REAL ORDER column, top and bottom. They
          describe the answer key, not the player's board, and putting one at
          each far corner made them read as a caption for whichever column they
          happened to be nearest. */}
      <div className="mb-1.5 flex items-baseline justify-between gap-2 font-display text-xs
        font-black tracking-widest text-fg-disabled">
        <span className="truncate">YOUR ORDER</span>
        {judged && <span className="flex-shrink-0">▲ #1 {axis.topLabel}</span>}
      </div>

      {/* Tight gaps and a narrow gutter, because every pixel here comes out of
          the title column — which is down to ~140px on a 390px phone. */}
      <div className="flex items-stretch gap-1.5">
        <ol className="flex min-w-0 flex-1 flex-col gap-1.5">
          {detail.slots.map((slot, i) => (
            <li key={i} className={`${row} gap-2`}>
              <span
                aria-hidden="true"
                className={`h-full w-1.5 flex-shrink-0 rounded-full ${railTone(i, size)}`}
              />
              <div className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-pop-sm border-2
                px-2.5 ${row}
                ${slot.item && judged
                  ? blameTone(slot.conflicts)
                  : 'border-line-strong bg-surface-2 text-fg-strong'}`}
              >
                <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-pop-sm
                  bg-wash-strong font-display text-xs font-black">
                  {i + 1}
                </span>
                <span className={`min-w-0 flex-1 truncate font-display text-sm font-extrabold
                  ${slot.item ? 'text-fg-strong' : 'text-fg-subtle'}`}
                >
                  {slot.item?.title ?? '—'}
                </span>
                {/* Placement and blame, stated separately, because the row's tint
                    answers "how tangled is this card" while the eye reads it as
                    "did I put this in the right place" — and those genuinely
                    differ. A card can sit in its correct slot and still be inside
                    somebody else's mistake: an inversion is a fact about TWO
                    cards, so both ends carry it and neither can be called
                    innocent. Charlotte landed at #6 where it belonged, with one
                    older show above it and one newer below, and went amber. Left
                    unlabelled that reads as a wrong answer. */}
                {slot.item && judged && (
                  <span className="flex flex-shrink-0 items-center gap-1.5 font-display text-xs
                    font-black">
                    {slot.inPlace && <Icon name="check" label="Sitting in its right slot" />}
                    {slot.conflicts > 0 && (
                      <span title={`On the wrong side of ${slot.conflicts} other`}>
                        ×{slot.conflicts}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>

        {judged && (
          <>
            <Tangle slots={detail.slots} size={size} rows className="w-11 flex-shrink-0" />
            <ol className="flex flex-shrink-0 flex-col gap-1.5">
              {Array.from({ length: size }, (_, i) => (
                <li key={i} className={row}>
                  <span className="grid h-8 w-8 place-items-center rounded-pop-sm bg-wash
                    font-display text-sm font-black text-fg-body">
                    {i + 1}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      {judged && (
        <div className="mt-1.5 flex items-baseline justify-end font-display text-xs font-black
          tracking-widest text-fg-disabled">
          <span className="flex-shrink-0">▼ #{size} {axis.bottomLabel}</span>
        </div>
      )}

      {/* The list is the accessible copy of the drawing: the SVG is aria-hidden,
          so every card states in words where it went and what it cost. */}
      {judged && (
        <ul className="sr-only">
          {detail.slots.filter((s) => s.item).map((slot, i) => (
            <li key={i}>
              {slot.item.title}: you placed it {slot.slot + 1}, it belonged at {slot.trueSlot}.
              {slot.conflicts === 0
                ? ' Not the wrong way round against anything.'
                : ` The wrong way round against ${slot.conflicts} other ${
                  slot.conflicts === 1 ? 'show' : 'shows'}.`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// One row of the real order, landing in the countdown when the screen is staged
// (ResultsLayout's ceremony, bottom first).
function TruthRow({ index, children }) {
  const staged = useCeremonyTiming();
  return (
    <li className={`flex items-center gap-3 ${staged ? 'reveal-row' : ''}`} style={staged?.style(index)}>
      {children}
    </li>
  );
}

// Everyone's boards, once the best one is out: the tangles would give the
// headline away before the countdown reached it.
function AfterSplash({ children }) {
  const staged = useCeremonyTiming();
  return <div className={staged ? 'reveal-row' : ''} style={staged?.after(500)}>{children}</div>;
}
