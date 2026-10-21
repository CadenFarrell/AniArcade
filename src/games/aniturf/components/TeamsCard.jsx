import PlayerFace from '../../../shared/components/PlayerFace';
import { Card, Icon } from '../../../shared/ui';
import { TEAM_STYLE } from './teamStyle';

// Who plays for which team, and who gives each team's clues: two columns, a
// row per player with their face, a crown to make them the clue-giver and a
// button to send them across. Shared by local setup (`canEdit` on every row)
// and the online lobby (each player moves only themselves; only the host hands
// out crowns — `canMove(p)` and `canCrown`).
//
// The controls keep stable words — "Move <name> to Blue", "Make <name> clue-
// giver" — because the playtest bots and tests press them by name.
export default function TeamsCard({ teams, givers, players, canMove = () => true, canCrown = true, onMove, onCrown, youId = null }) {
  const byId = new Map(players.map((p) => [p.id, p]));
  return (
    <Card title="Teams" padding="lg" className="mb-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        {['red', 'blue'].map((team) => {
          const s = TEAM_STYLE[team];
          const to = team === 'red' ? 'blue' : 'red';
          const members = (teams[team] ?? []).map((id) => byId.get(id)).filter(Boolean);
          return (
            <section key={team} aria-label={`${s.name} team`} className="border-2 border-ink">
              <header className={`relative border-b-2 border-ink px-3 py-1.5 text-paper ${s.fill}`}>
                <span aria-hidden="true" className={`absolute inset-0 ${s.texture}`} />
                {/* A solid patch under the text — see TeamStrip. */}
                <span className={`relative px-1.5 font-display text-lg font-bold uppercase tracking-wide ${s.fill}`}>
                  {s.name} <span className="text-xs tracking-normal normal-case">· {members.length} · crosses {s.goal}</span>
                </span>
              </header>
              <ul>
                {members.map((p) => {
                  const crowned = givers[team] === p.id;
                  return (
                    <li key={p.id} className="flex items-center gap-2 border-b border-line px-2 py-1.5 last:border-0">
                      <PlayerFace player={p} />
                      <span className="min-w-0 flex-1 truncate font-display text-base font-bold uppercase tracking-wide text-fg-strong">
                        {p.id === youId ? `${p.name} (you)` : p.name}
                      </span>
                      <button
                        type="button"
                        aria-label={`Make ${p.name} clue-giver`}
                        aria-pressed={crowned}
                        title={crowned ? 'Clue-giver' : 'Make clue-giver'}
                        disabled={!canCrown}
                        onClick={() => onCrown(team, p.id)}
                        className={`focus-pop grid h-10 w-10 shrink-0 place-items-center border-2 text-lg
                          ${crowned ? 'border-ink bg-pop-amber text-paper' : 'border-line-strong bg-surface text-fg-icon hover:text-fg-strong'}
                          disabled:cursor-default`}
                      >
                        <Icon name="crown" />
                      </button>
                      {canMove(p) && (
                        <button
                          type="button"
                          aria-label={`Move ${p.name} to ${TEAM_STYLE[to].name}`}
                          onClick={() => onMove(p.id, to)}
                          className="focus-pop h-10 shrink-0 border-2 border-ink bg-surface px-2 font-display text-xs font-bold
                            uppercase tracking-wider text-fg-strong hover:bg-surface-2"
                        >
                          To {TEAM_STYLE[to].name}
                        </button>
                      )}
                    </li>
                  );
                })}
                {!members.length && <li className="px-3 py-3 text-sm text-fg-subtle">Nobody yet.</li>}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-fg-helper">
        <Icon name="crown" /> gives the clues and alone sees the team&apos;s key. Each team needs two players.
      </p>
    </Card>
  );
}
