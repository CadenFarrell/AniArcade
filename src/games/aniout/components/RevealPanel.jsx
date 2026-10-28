import { Card, Mark } from '../../../shared/ui';
import CardGrid from './CardGrid';

// The reveal: the grid again with the odd one stamped and every card's show and
// value printed, the connection in a sentence, then what each player picked.
// Right/wrong is a Mark (a ✓/✗ shape with its word), never colour alone.
// `youId` names this device's player "You" online.
export default function RevealPanel({ set, game, deal, players, youId = null, children }) {
  const odd = set.cards.find((c) => c.key === set.odd);
  const nameOfCard = (key) => set.cards.find((c) => c.key === key)?.name ?? 'nobody';
  const who = (p) => (youId && p.id === youId ? 'You' : p.name);
  const rows = players.filter((p) => game.picks?.[p.id]);

  return (
    <>
      <CardGrid cards={set.cards} oddKey={set.odd} />
      <Card padding="lg">
        <p className="text-center font-display text-2xl font-bold uppercase leading-tight tracking-wide text-fg-strong [overflow-wrap:anywhere]">
          {set.sentence}
        </p>
        <p className="mb-4 text-center text-fg-body">…except {odd?.name ?? 'one'}.</p>
        {rows.length > 0 && (
          <ul className="mb-5 divide-y-2 divide-ink border-y-2 border-ink" aria-label="Picks">
            {rows.map((p) => {
              const pick = game.picks[p.id];
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
                  <span className="font-bold text-fg-strong">{who(p)}</span>
                  <span className="min-w-0 flex-1 text-fg-body [overflow-wrap:anywhere]">picked {nameOfCard(pick.card)}</span>
                  <Mark yes={pick.correct} label={pick.correct ? 'Right' : 'Wrong'} />
                  {deal.reasonsOn && pick.correct && (
                    <Mark yes={pick.reasonRight} label={pick.reasonRight ? 'Reason' : 'Not why'} />
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
