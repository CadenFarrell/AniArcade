import { Card, CardRow, Mark } from '../../../shared/ui';
import { useSoundCue } from '../../../shared/hooks/useSoundCue';
import ResultImpact from '../../../shared/components/ResultImpact';
import PlayerFace from '../../../shared/components/PlayerFace';
import { useStagger } from '../../../shared/hooks/useStagger';
import { useStepCues } from '../../../shared/hooks/useStepCues';

// The final's reveal is staged: the answer card is unveiled, then each player's
// wager lands in turn, the way a final is read out — it decides the game, and
// every other clue's all-at-once list made it look like one more clue.
const FINAL_LEAD_MS = 700;
const FINAL_STEP_MS = 650;

// How many "also accepted" names to print before summarising the rest. A
// "name a main character" clue can accept a dozen, and the point of the list
// is to explain why somebody else's answer scored, not to print the cast.
const SHOWN_ALTERNATIVES = 4;

// The answer, then everyone's answer beside it. Each row's delta is read off
// the answer the rules graded (rules.settle stamps it), never recomputed here,
// so the "+400" on screen and the total on the scoreboard are one number.
export default function ClueReveal({ clue, players, answers, required = null, myId = null, staged = false, children }) {
  // The reveal's sound, once as it appears. Online (`myId`) it is MY answer —
  // right, wrong, or the plain reveal when I had no stake in this clue (a Daily
  // Double somebody else wagered); on the one local device it is the table's:
  // anybody right is a cheer, nobody is a miss.
  const mine = myId ? answers?.[myId] : undefined;
  const anyRight = players.some((p) => answers?.[p.id]?.correct);
  const cue = myId
    ? (mine?.correct ? 'correct' : mine ? 'wrong' : 'reveal')
    : (anyRight ? 'correct' : 'wrong');
  // Right or wrong lands as the impact frame (which plays its own sound); the
  // plain reveal, for a clue I had no stake in, is a sound only.
  const impact = cue === 'reveal' ? null : cue;
  const eventKey = clue?.prompt ?? clue?.answer ?? 'clue';
  useSoundCue(impact ? null : cue, eventKey);

  const also = clue?.alsoAccepted ?? [];
  const shown = also.slice(0, SHOWN_ALTERNATIVES);
  const rows = required ? players.filter((p) => required.includes(p.id) || answers?.[p.id]) : players;
  const stagger = useStagger({ count: staged ? rows.length : 0, stepMs: FINAL_STEP_MS, leadMs: FINAL_LEAD_MS, key: eventKey });
  const on = staged && !stagger.skipped;
  useStepCues(
    on ? rows.map((p, i) => ({ atMs: stagger.delay(i), name: answers?.[p.id]?.correct ? 'correct' : 'wrong' })) : [],
    on ? `final:${eventKey}` : null,
    { skip: stagger.skipped },
  );

  return (
    <>
      {/* Staged, the impact frame would land before the rows that explain it,
          so the final lets its rows' own cues carry the result instead. */}
      <ResultImpact result={on ? null : impact} eventKey={eventKey} />
      <div {...(staged ? stagger.rootProps : {})}>
      {/* The answer as a stamped card: the label on an ink tab, the answer in
          display type. Ink, not lime — lime says somebody was RIGHT, and the
          answer is just the answer whether anyone was or not. */}
      <div className={`relative mb-6 border-[3px] border-ink bg-surface px-5 pt-8 pb-5 text-center shadow-pop-sm ${on ? 'curtain-in' : ''}`}>
        <span
          className="absolute -top-[3px] -left-[3px] border-[3px] border-ink bg-ink px-2.5 py-1 font-display text-xs
            font-bold uppercase tracking-[0.15em] text-paper"
        >
          The answer
        </span>
        <p className="font-display text-3xl font-bold uppercase tracking-wide text-fg-strong [overflow-wrap:anywhere]">
          {clue?.answer}
        </p>
        {shown.length > 0 && (
          <p className="mt-2 text-sm text-fg-helper">
            Also accepted: {shown.join(', ')}
            {also.length > shown.length && ` and ${also.length - shown.length} more`}
          </p>
        )}
      </div>

      <Card padding="sm" className="mb-6">
        {rows.map((p, i) => {
          const a = answers?.[p.id];
          const text = a?.text?.trim();
          const delta = a?.delta ?? 0;
          return (
            <CardRow key={p.id} className={on ? 'reveal-row' : ''} style={on ? stagger.style(i) : undefined}>
              <span className="w-20 flex-shrink-0">
                {a ? <Mark yes={a.correct} label={a.correct ? 'right' : 'wrong'} /> : <span className="text-fg-subtle">—</span>}
              </span>
              <PlayerFace player={p} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display font-extrabold text-fg-strong">{p.name}</span>
                <span className="block truncate text-sm text-fg-helper">
                  {!a ? 'no answer' : a.aloud ? (a.correct ? 'said it' : 'missed it') : text || 'passed'}
                </span>
              </span>
              <span
                className={`font-display text-lg font-extrabold tabular-nums
                  ${delta > 0 ? 'text-pop-lime' : delta < 0 ? 'text-pop-red' : 'text-fg-subtle'}`}
              >
                {delta > 0 ? `+${delta.toLocaleString()}` : delta < 0 ? `−${Math.abs(delta).toLocaleString()}` : '0'}
              </span>
            </CardRow>
          );
        })}
      </Card>
      </div>

      {children}
    </>
  );
}
