import { Avatar, Badge, Card, Icon } from '../../../shared/ui';
import { roleOf } from '../roles';
import { lastEntry, winnersOf } from '../rules';

// The round's votes, one role at a time: each role turned over is a card of
// every team's pick for it, most votes first, the winner (or every tied team)
// carrying a crown and "+1". The roles not yet shown stay face down, so the
// table watches the scores move role by role instead of reading them all off
// at once — which is also why the score row above uses revealedScores.
//
// The newest role sits at the top: it is what the table is looking at, and on
// a phone the older ones would otherwise push it below the fold.
export default function RoleReveal({ game, players, youId = null }) {
  const entry = lastEntry(game);
  if (!entry) return null;
  const nameOf = (id) => (id === youId ? 'You' : players.find((p) => p.id === id)?.name ?? 'Someone');
  const shown = entry.roles.slice(0, game.shown).map((roleId, i) => ({ roleId, i })).reverse();

  return (
    <>
      {game.shown < entry.roles.length && (
        <Card padding="md" className="mb-5 text-center">
          <p className="text-base text-fg-body">
            {game.shown === 0
              ? `Every vote is in. ${entry.roles.length} roles to turn over.`
              : `${entry.roles.length - game.shown} role${entry.roles.length - game.shown === 1 ? '' : 's'} still face down.`}
          </p>
        </Card>
      )}
      {shown.map(({ roleId, i }) => {
        const role = roleOf(roleId);
        const counts = entry.tally[i] ?? {};
        const winners = winnersOf(counts, game.order);
        const rows = [...game.order].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));
        return (
          <Card key={roleId} title={role.name} padding="sm" className="mb-4">
            <ol>
              {rows.map((id) => {
                const card = entry.teams[id]?.[i];
                const votes = counts[id] ?? 0;
                const won = winners.includes(id);
                return (
                  <li key={id} className="flex items-center gap-3 border-b border-line px-1 py-2 last:border-0">
                    <Avatar src={card?.imageUrl} alt="" size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-base font-bold uppercase tracking-wide text-fg-strong">
                        {card?.name ?? 'Nobody'}
                      </p>
                      <p className="truncate text-sm text-fg-helper">{nameOf(id)}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-fg-body">
                      {votes} vote{votes === 1 ? '' : 's'}
                    </span>
                    {won && (
                      <Badge tone="amber">
                        <Icon name="crown" /> +1
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ol>
            {winners.length > 1 && <p className="px-1 pt-1 text-sm text-fg-helper">A tie — each scores the point.</p>}
          </Card>
        );
      })}
    </>
  );
}
