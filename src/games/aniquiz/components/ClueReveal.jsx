import { Card, CardRow } from '../../../shared/ui';

// How many "also accepted" names to print before summarising the rest. A
// "name a main character" clue can accept a dozen, and the point of the list
// is to explain why somebody else's answer scored, not to print the cast.
const SHOWN_ALTERNATIVES = 4;

// The answer, then everyone's answer beside it. Each row's delta is read off
// the answer the rules graded (rules.settle stamps it), never recomputed here,
// so the "+400" on screen and the total on the scoreboard are one number.
export default function ClueReveal({ clue, players, answers, required = null, children }) {
  const also = clue?.alsoAccepted ?? [];
  const shown = also.slice(0, SHOWN_ALTERNATIVES);
  const rows = required ? players.filter((p) => required.includes(p.id) || answers?.[p.id]) : players;

  return (
    <>
      <div className="mb-6 text-center">
        <p className="mb-1 font-display text-xs font-extrabold uppercase tracking-widest text-fg-helper">
          The answer
        </p>
        <p className="font-display text-3xl font-extrabold text-pop-lime">{clue?.answer}</p>
        {shown.length > 0 && (
          <p className="mt-2 text-sm text-fg-helper">
            Also accepted: {shown.join(', ')}
            {also.length > shown.length && ` and ${also.length - shown.length} more`}
          </p>
        )}
      </div>

      <Card padding="sm" className="mb-6">
        {rows.map((p) => {
          const a = answers?.[p.id];
          const text = a?.text?.trim();
          const delta = a?.delta ?? 0;
          return (
            <CardRow key={p.id}>
              <span className="w-6 flex-shrink-0 text-xl" aria-label={a?.correct ? 'right' : 'wrong'}>
                {a ? (a.correct ? '✅' : '❌') : '—'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display font-extrabold text-white">{p.name}</span>
                <span className="block truncate text-sm text-fg-helper">
                  {!a ? 'no answer' : text || 'passed'}
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

      {children}
    </>
  );
}
