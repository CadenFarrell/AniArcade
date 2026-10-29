import { useState } from 'react';
import RoundHeader from '../../../shared/components/RoundHeader';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Button, Card } from '../../../shared/ui';
import { roleOf } from '../roles';
import { ROLES_PER_ROUND, teamSlots } from '../rules';
import CardFace from './CardFace';

// One voter's whole ballot: a row a role, each offering every OTHER team's
// pick for it, and one "Cast votes" for all five — on one device a single pass
// of the phone per voter, not five. Your own team is not on it at all, rather
// than shown and refused: there is nothing to decide about it.
//
// Each role row is a radiogroup named by the role, select-then-cast like
// AniOut's card grid, so a slip costs nothing until "Cast votes". Options are
// named "<character> as <role>" — the drafter's name is visible text beside
// it — which is what the bots press. The choice is marked by an ink bar and a
// VOTE tab, never colour alone.
export default function Ballot({ game, players, voter, onCast, title = 'Your Vote' }) {
  const [choices, setChoices] = useState(() => Array(ROLES_PER_ROUND).fill(null));
  const others = game.order.filter((id) => id !== voter);
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const done = choices.filter(Boolean).length;
  const choose = (i, id) => setChoices((c) => c.map((v, j) => (j === i ? id : v)));

  return (
    <>
      <RoundHeader
        title={title}
        tag={`Round ${game.round + 1}/${game.rounds}`}
        hint="Pick the best character for each role. Your own team isn’t on the ballot."
      />
      {game.roles.map((roleId, i) => {
        const role = roleOf(roleId);
        return (
          <Card key={roleId} title={role.name} padding="sm" className="mb-4">
            {role.hint && <p className="-mt-1 mb-2 px-1 text-sm text-fg-helper">{role.hint}</p>}
            <div role="radiogroup" aria-label={role.name} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {others.map((id) => {
                const card = teamSlots(game, id)[i];
                const on = choices[i] === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${card?.name ?? 'Nobody'} as ${role.name}`}
                    onClick={() => choose(i, id)}
                    className={`btn-pop focus-pop relative flex flex-col overflow-hidden rounded-none! p-0! text-left
                      ${on ? 'border-ink bg-ink text-paper' : 'border-ink bg-surface text-fg-strong'}`}
                  >
                    <CardFace card={card} className="border-b-2 border-ink" />
                    {on && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-0 border-b-2 border-r-2 border-ink bg-pop-magenta px-1.5 py-0.5
                          font-display text-xs font-bold uppercase tracking-[0.2em] text-paper"
                      >
                        Vote
                      </span>
                    )}
                    <span className="block px-1.5 py-1.5">
                      <span className="block text-sm font-bold leading-tight [overflow-wrap:anywhere]">{card?.name ?? '—'}</span>
                      <span className={`block font-display text-xs font-bold uppercase tracking-wide ${on ? '' : 'text-fg-helper'}`}>
                        {nameOf(id)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
      <StartBar
        width="md"
        status={done < ROLES_PER_ROUND ? `${done} of ${ROLES_PER_ROUND} roles voted.` : 'All five voted — cast them.'}
        ready={done === ROLES_PER_ROUND}
      >
        <Button variant="primary" size="lg" disabled={done < ROLES_PER_ROUND} onClick={() => onCast(choices)}>
          Cast votes
        </Button>
      </StartBar>
    </>
  );
}
