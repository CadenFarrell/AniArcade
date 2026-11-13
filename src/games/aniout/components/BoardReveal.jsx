import { Card, Mark } from '../../../shared/ui';
import { Face } from './CardGrid';

// A "Groups of four" board revealed — RevealPanel's twin. Each true group as a
// row: what joins them in a sentence, then its four with their show and their
// value for it. Then what each player made of the board. Right/wrong is a Mark
// (✓/✗ with its word), never colour alone.
export default function BoardReveal({ set, game, deal, players, youId = null, children }) {
  const byKey = new Map(set.cards.map((c) => [c.key, c]));
  const who = (p) => (youId && p.id === youId ? 'You' : p.name);
  const rows = players.filter((p) => game.picks?.[p.id]);
  const n = set.groups.length;

  return (
    <>
      <section className="mb-5 grid gap-3" aria-label="The groups">
        {set.groups.map((g) => (
          <div key={g.keys.join('|')} className="border-2 border-ink bg-surface p-2 sm:p-3">
            <p className="mb-2 font-display text-base font-bold uppercase leading-tight tracking-wide text-fg-strong [overflow-wrap:anywhere]">
              {g.sentence}
            </p>
            <ul className="grid grid-cols-4 gap-1.5">
              {g.keys.map((k) => {
                const c = byKey.get(k) ?? { key: k, name: '?' };
                return (
                  <li key={k} className="flex flex-col border-2 border-ink bg-surface">
                    <Face card={c} />
                    <div className="flex flex-1 flex-col px-1 py-1">
                      <span className="text-xs font-bold leading-tight text-fg-strong [overflow-wrap:anywhere]">{c.name}</span>
                      {c.series && <span className="text-[11px] leading-snug text-fg-helper [overflow-wrap:anywhere]">{c.series}</span>}
                      {c.note && (
                        <span className="mt-0.5 font-display text-[11px] font-bold uppercase leading-tight text-fg-body [overflow-wrap:anywhere]">
                          {c.note}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
      <Card padding="lg">
        {rows.length > 0 && (
          <ul className="mb-5 divide-y-2 divide-ink border-y-2 border-ink" aria-label="Sorts">
            {rows.map((p) => {
              const pick = game.picks[p.id];
              const right = pick.groupsRight ?? 0;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
                  <span className="font-bold text-fg-strong">{who(p)}</span>
                  <span className="min-w-0 flex-1 text-fg-body [overflow-wrap:anywhere]">
                    {right} of {n} group{n === 1 ? '' : 's'}
                  </span>
                  <Mark yes={pick.correct} label={pick.correct ? 'Sorted' : 'Not quite'} />
                  {deal.reasonsOn && right > 0 && (
                    <Mark yes={pick.reasonRight} label={`${pick.reasonsRight ?? 0} why`} />
                  )}
                  <span className="w-10 text-right font-display font-bold text-pop-amber">+{pick.delta ?? 0}</span>
                </li>
              );
            })}
          </ul>
        )}
        {children}
      </Card>
    </>
  );
}
