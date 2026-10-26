import { whenLabel } from '../shared/utils/history';
import { PlaceMark } from '../shared/ui';

// One finished game as a row: the place mark, the game and who it was with, and
// when. The record strip's last few and the record screen's full log are the
// same row, so a game reads the same in both.
export default function RecordLine({ entry, games }) {
  const game = games.find((g) => g.id === entry.game);
  return (
    <li className="flex items-center gap-3 border-b border-line py-2 last:border-0">
      <span className="w-8 shrink-0 text-center text-lg">
        {entry.place ? <PlaceMark place={entry.place} /> : <span className="text-fg-subtle">–</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-bold uppercase leading-tight tracking-wide text-fg-strong">
          {game?.title ?? entry.game}
          {entry.won && <span className="ml-2 text-xs text-pop-amber">Won</span>}
        </span>
        <span className="block truncate text-sm text-fg-helper">
          {entry.with.length ? `with ${entry.with.join(', ')}` : 'on your own'}
        </span>
      </span>
      <span className="shrink-0 text-xs text-fg-subtle">{whenLabel(entry.at)}</span>
    </li>
  );
}
