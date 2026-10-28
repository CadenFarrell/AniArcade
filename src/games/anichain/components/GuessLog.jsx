import { Mark } from '../../../shared/ui';

// Every guess this turn, newest first, under the word it was a guess on — the
// table watching each other miss is half the fun of a chain. A guess the
// judge has not reached yet says so rather than showing a mark it has not
// earned; a pass is listed quietly so the window's "waiting on" is legible.
export default function GuessLog({ game, players, youId = null }) {
  const nameOf = (id) => (youId && id === youId ? 'You' : players.find((p) => p.id === id)?.name ?? 'Someone');
  const shown = game.guesses.filter((g) => g.verdict !== 'late').slice().reverse();
  if (!shown.length) return null;
  return (
    <section aria-label="Guesses" className="mb-5">
      <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-fg-helper">Guesses</h3>
      <ol className="border-2 border-ink bg-surface">
        {shown.map((g) => (
          <li key={`${g.by}@${g.n}`} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-0">
            <span className="w-14 shrink-0 font-display text-xs font-bold uppercase tracking-wider text-fg-helper">
              Word {g.n}
            </span>
            <span className="min-w-0 flex-1 truncate text-fg-body">
              <span className="font-bold text-fg-strong">{nameOf(g.by)}</span>
              {g.verdict === 'pass' ? ' passed' : `: ${g.text}`}
            </span>
            {g.verdict === 'right' && <Mark yes label="Right" />}
            {g.verdict === 'wrong' && <Mark yes={false} label="Wrong" />}
            {g.verdict === 'pending' && <span className="shrink-0 text-sm text-fg-helper">checking…</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
