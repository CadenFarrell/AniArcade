import { Card } from '../../../shared/ui';

// The four options, to read along with — for everyone watching another
// player's turn online. Nothing here is a control: a watcher who could tap one
// would look like they were answering, and the clue is not theirs.
export default function OptionsList({ options, className = '' }) {
  if (!options?.length) return null;
  return (
    <Card padding="sm" className={className}>
      <ol className="grid gap-2 sm:grid-cols-2">
        {options.map((o, i) => (
          <li key={o} className="border-2 border-ink bg-surface-2 px-3 py-2 font-display text-lg font-bold text-fg-strong">
            <span className="mr-2 text-fg-subtle">{String.fromCharCode(65 + i)}</span>{o}
          </li>
        ))}
      </ol>
    </Card>
  );
}
