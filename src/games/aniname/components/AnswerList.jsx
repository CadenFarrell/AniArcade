import { Icon, Mark } from '../../../shared/ui';

// The names given so far, newest last, each with its verdict. Right and wrong
// are Marks (✓/✗ with the word), never colour alone; a name the arcade does
// not know reads "Table decides", and a repeat says so. The name shown is the
// one on record when the judge recognised it ("Kakashi" → Kakashi Hatake), with
// what was typed beside it when they differ.
//
// `onJudge(index, accept)` turns each pending row into the table's two buttons
// ("Accept “x”" / "Reject “x”", which the bots press); without it pending rows
// just wait. Online they are votes: `votes` ({ judges, me }) prints each
// pending row's count and marks this phone's own vote as pressed, and a vote
// may be changed until the majority decides.
//
// `onChallenge(index)` gives the namer a "Challenge “x”" button on a name the
// arcade marked wrong (not one the table rejected), sending it to the table.
export default function AnswerList({ answers, onJudge = null, onChallenge = null, votes = null }) {
  if (!answers?.length) return null;
  return (
    <ol className="mb-5 divide-y-2 divide-ink border-y-2 border-ink" aria-label="Answers">
      {answers.map((a, i) => (
        // Keyed by position: the list only ever grows, and two rows can share text.
        <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
          <span className="w-6 shrink-0 font-display text-sm font-bold text-fg-helper">{i + 1}.</span>
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <span className="font-bold text-fg-strong">{a.label || a.text}</span>
            {a.label && a.text && a.label.toLowerCase() !== a.text.toLowerCase() && (
              <span className="text-sm text-fg-helper"> — “{a.text}”</span>
            )}
            {a.why && a.verdict === 'wrong' && a.why !== 'blank' && (
              <span className="block text-xs text-fg-helper">{a.why}</span>
            )}
            {a.verdict === 'pending' && a.why === 'challenged' && (
              <span className="block text-xs text-fg-helper">Challenged</span>
            )}
            {a.verdict === 'pending' && votes && votes.judges.length > 1 && (
              <span className="block text-xs text-fg-helper">
                {votes.judges.filter((id) => a.votes?.[id] != null).length} of {votes.judges.length} voted
              </span>
            )}
          </span>
          <Verdict answer={a} />
          {a.verdict === 'wrong' && a.why !== 'table said no' && onChallenge && (
            <button
              type="button"
              aria-label={`Challenge “${a.label || a.text}”`}
              onClick={() => onChallenge(i)}
              className="btn-pop focus-pop border-ink bg-surface px-3 py-1.5 text-sm text-fg-strong"
            >
              Challenge
            </button>
          )}
          {a.verdict === 'pending' && onJudge && (
            <span className="flex w-full gap-2 sm:w-auto">
              <button
                type="button"
                aria-label={`Accept “${a.label || a.text}”`}
                aria-pressed={votes ? a.votes?.[votes.me] === true : undefined}
                onClick={() => onJudge(i, true)}
                className="btn-pop focus-pop flex-1 border-ink bg-pop-lime px-3 py-1.5 text-sm text-paper sm:flex-none"
              >
                <Icon name="check" /> Accept
              </button>
              <button
                type="button"
                aria-label={`Reject “${a.label || a.text}”`}
                aria-pressed={votes ? a.votes?.[votes.me] === false : undefined}
                onClick={() => onJudge(i, false)}
                className="btn-pop focus-pop flex-1 border-ink bg-pop-red px-3 py-1.5 text-sm text-paper sm:flex-none"
              >
                <Icon name="cross" /> Reject
              </button>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function Verdict({ answer }) {
  if (answer.verdict === 'right') return <Mark yes label={answer.why === 'table' ? 'Accepted' : 'Right'} />;
  if (answer.verdict === 'wrong') return <Mark yes={false} label={answer.why === 'table said no' ? 'Rejected' : 'Wrong'} />;
  const word = answer.verdict === 'repeat' ? 'Repeat' : 'Table decides';
  return (
    <span className="shrink-0 border-2 border-ink bg-surface px-1.5 py-0.5 font-display text-xs font-bold uppercase tracking-wider text-fg-strong">
      {word}
    </span>
  );
}
