import { Card, Mark } from '../../../shared/ui';
import { Portrait } from './ChoosePanel';
import SketchCanvas from './SketchCanvas';

/**
 * The turn told back: the drawing beside who it was, then who named it and
 * what each scored. A void turn (the drawer left with the only copy of the
 * answer) says so instead. Right/wrong is a Mark, never colour alone.
 */
export default function TurnReveal({ game, players, strokes, youId = null, children }) {
  const nameOf = (id) => (id === youId ? 'You' : players.find((p) => p.id === id)?.name ?? 'Someone');
  const drawer = nameOf(game.drawer);
  const c = game.reveal;
  const got = Object.entries(game.got ?? {}).sort((a, b) => b[1].points - a[1].points);
  const guessers = game.order.filter((id) => id !== game.drawer && players.some((p) => p.id === id));
  const missed = guessers.filter((id) => !game.got?.[id]);

  return (
    <>
      <div className="mb-4 grid grid-cols-[3fr_2fr] gap-3">
        <SketchCanvas strokes={strokes} label={`${drawer}’s drawing`} />
        <div className="flex flex-col border-2 border-ink bg-surface">
          {c ? <Portrait character={c} /> : <div className="aspect-square bg-surface-2" />}
          <div className="px-2 py-1.5">
            <span className="block font-bold leading-tight text-fg-strong [overflow-wrap:anywhere]">
              {c?.name ?? (game.void ? 'Nobody knows' : '…')}
            </span>
            {c?.series && <span className="block text-xs text-fg-helper [overflow-wrap:anywhere]">{c.series}</span>}
          </div>
        </div>
      </div>
      <Card padding="lg">
        {game.void && (
          <p className="mb-4 text-center text-fg-body">{drawer} left before the end — only their phone knew who it was.</p>
        )}
        {game.gaveUp && <p className="mb-4 text-center text-fg-body">{drawer} gave up on this one.</p>}
        {(got.length > 0 || missed.length > 0) && (
          <ul className="mb-5 divide-y-2 divide-ink border-y-2 border-ink" aria-label="Who named it">
            {got.map(([id, g]) => (
              <li key={id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 font-bold text-fg-strong">{nameOf(id)}</span>
                <span className="text-sm text-fg-helper">{g.left}s left</span>
                <Mark yes label="Named it" />
                <span className="w-10 text-right font-display font-bold text-pop-amber">+{g.points}</span>
              </li>
            ))}
            {missed.map((id) => (
              <li key={id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 font-bold text-fg-strong">{nameOf(id)}</span>
                <Mark yes={false} label="Missed" />
                <span className="w-10 text-right font-display font-bold text-pop-amber">+0</span>
              </li>
            ))}
          </ul>
        )}
        {children}
      </Card>
    </>
  );
}
