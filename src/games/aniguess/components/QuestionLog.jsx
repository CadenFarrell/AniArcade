import { Card, Icon, Mark } from '../../../shared/ui';

// The running history of a turn. Was pasted verbatim into GameScreen,
// OnlineGameScreen and OnlineAnswererView — three copies that had already
// drifted (only the local one rendered 'timer' entries at all).
//
// Numbered, with each answer as a stamped mark rather than a coloured word:
// "— No" in red sat beside the brand's own red with nothing but hue to tell
// them apart, and lime/red is the pair a red-green colour-blind player cannot
// separate. The ✓/✗ shape carries it now; the colour only agrees.
export default function QuestionLog({ title, entries = [] }) {
  return (
    <Card title={title} padding="sm" className="max-h-72 overflow-y-auto">
      {entries.length === 0 ? (
        <p className="text-center text-base text-fg-subtle">No questions yet</p>
      ) : (
        <ol>
          {entries.map((entry, i) => (
            <li key={entry.id} className="flex items-start gap-3 border-b border-line-soft py-2 last:border-0">
              <span className="w-7 shrink-0 pt-0.5 font-display text-xs font-bold tabular-nums text-fg-subtle">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-base text-fg-strong">
                {entry.type === 'question' && entry.text}
                {entry.type === 'guess' && (
                  <>
                    <Icon name={entry.correct ? 'target' : 'miss'} /> {entry.text}
                  </>
                )}
                {entry.type === 'timer' && (
                  <span className="text-pop-amber"><Icon name="clock" /> {entry.text}</span>
                )}
              </span>
              {entry.type === 'question' && entry.answer && (
                <Mark yes={entry.answer === 'Yes'} label={entry.answer} />
              )}
              {entry.type === 'guess' && <Mark yes={entry.correct} label={entry.correct ? 'Right' : 'Wrong'} />}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
