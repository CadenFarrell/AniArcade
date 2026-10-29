import { Avatar, Card } from '../../../shared/ui';
import { roleOf } from '../roles';
import { teamSlots } from '../rules';

// One team's five roles, in role order: the role's name and hint, and the
// character drafted into it or an empty slot. Above the board it is the
// picker's own sheet: what they still need is the whole decision.
export function TeamSheet({ game, playerId, title, className = '' }) {
  const slots = teamSlots(game, playerId);
  return (
    <Card title={title} padding="sm" className={`mb-5 ${className}`}>
      <ol className="divide-y-2 divide-line">
        {game.roles.map((roleId, i) => {
          const role = roleOf(roleId);
          const card = slots[i];
          return (
            // A round's roles are distinct, and their place is their identity.
            <li key={roleId} className="flex items-center gap-3 px-1 py-2">
              {card ? <Avatar src={card.imageUrl} alt="" size="sm" /> : <EmptySlot />}
              <div className="min-w-0 flex-1">
                <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-fg-helper">{role.name}</p>
                {card ? (
                  <p className="truncate text-base font-bold text-fg-strong">{card.name}</p>
                ) : (
                  <p className="text-sm text-fg-helper">{role.hint || 'Empty'}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// Every team at a glance, under the board: one row a team, a small face per
// role, so a picker can see who is short of a Final Boss without scrolling
// through five sheets. Names, never colour, tell the teams apart.
export function AllTeams({ game, players, youId = null, activeId = null }) {
  return (
    <Card title="Every Team" padding="sm" className="mb-5">
      <ul className="divide-y-2 divide-line">
        {game.order.map((id) => {
          const name = id === youId ? 'You' : players.find((p) => p.id === id)?.name ?? 'Someone';
          const slots = teamSlots(game, id);
          return (
            <li key={id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 py-2">
              <p className="w-24 shrink-0 truncate font-display text-sm font-bold uppercase tracking-wide text-fg-strong">
                {name}
                {id === activeId && <span className="sr-only"> (picking)</span>}
              </p>
              <ol className="flex gap-1.5" aria-label={`${name}’s team`}>
                {slots.map((card, i) => (
                  <li key={game.roles[i] ?? i} title={card ? `${roleOf(game.roles[i]).name}: ${card.name}` : roleOf(game.roles[i]).name}>
                    {card ? (
                      <>
                        <Avatar src={card.imageUrl} alt="" size="sm" className="h-9! w-9!" />
                        <span className="sr-only">{roleOf(game.roles[i]).name}: {card.name}</span>
                      </>
                    ) : (
                      <>
                        <EmptySlot small />
                        <span className="sr-only">{roleOf(game.roles[i]).name}: empty</span>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function EmptySlot({ small = false }) {
  return (
    <span
      aria-hidden="true"
      className={`${small ? 'h-9 w-9' : 'h-12 w-12'} shrink-0 rounded-pop-sm border-2 border-dashed border-ink bg-surface-2`}
    />
  );
}
