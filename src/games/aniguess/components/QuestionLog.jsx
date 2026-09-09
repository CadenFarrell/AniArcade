import { Card } from '../../../shared/ui';

// The running history of a turn. Was pasted verbatim into GameScreen,
// OnlineGameScreen and OnlineAnswererView — three copies that had already
// drifted (only the local one rendered 'timer' entries at all).
export default function QuestionLog({ title, entries = [] }) {
  return (
    <Card title={title} padding="sm" className="max-h-72 overflow-y-auto">
      {entries.length === 0 ? (
        <p className="text-center text-base text-fg-subtle">No questions yet</p>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="border-b border-line-soft py-2 text-base last:border-0">
            {entry.type === 'question' && (
              <span className="text-fg-strong">
                ❓ {entry.text}
                {entry.answer && (
                  <strong className={entry.answer === 'Yes' ? 'text-pop-lime' : 'text-pop-red'}>
                    {' '}— {entry.answer}
                  </strong>
                )}
              </span>
            )}
            {entry.type === 'guess' && (
              <span className={entry.correct ? 'text-pop-lime' : 'text-pop-red'}>
                🎯 {entry.text} {entry.correct ? '✅' : '❌'}
              </span>
            )}
            {entry.type === 'timer' && <span className="text-pop-amber">{entry.text}</span>}
          </div>
        ))
      )}
    </Card>
  );
}
