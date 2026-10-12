import { standings } from '../rules';
import { getPositionEmoji } from '../../../shared/utils/ranking';
import { Backdrop, Button, Card, CardRow, Screen, Wordmark } from '../../../shared/ui';

// Final standings. Scores can be negative — a lost wager is the only way — so
// they are printed signed rather than assumed positive.
export default function QuizResults({ players, scores, departedIds = [], onPlayAgain, onBack, againLabel = '🔁 Play again' }) {
  const ranked = standings(players, scores);
  return (
    <>
      <Backdrop />
      <Screen center width="md" onBack={onBack} backLabel="← Back to setup">
        <Wordmark tone="red" size="md" level={2} className="mb-8">
          🏆 Final Scores
        </Wordmark>
        <Card padding="sm" className="mb-8">
          {ranked.map((p) => {
            const left = departedIds.includes(p.id);
            return (
              <CardRow key={p.id} className={left ? 'opacity-50' : ''}>
                <span className="w-10 text-2xl">{getPositionEmoji(p.position)}</span>
                <span className="min-w-0 flex-1 truncate text-left font-display text-lg font-extrabold text-white">
                  {p.name}
                  {left && <span className="ml-2 text-sm font-bold text-fg-helper">left</span>}
                </span>
                <span className={`font-display text-xl font-extrabold tabular-nums ${p.total < 0 ? 'text-pop-red' : 'text-pop-amber'}`}>
                  {p.total < 0 ? `−${Math.abs(p.total).toLocaleString()}` : p.total.toLocaleString()}
                </span>
              </CardRow>
            );
          })}
        </Card>
        {onPlayAgain && (
          <Button variant="success" size="xl" fullWidth onClick={onPlayAgain}>
            {againLabel}
          </Button>
        )}
      </Screen>
    </>
  );
}
