import PlayerRow from '../../../shared/components/PlayerRow';
import { TEAM_STYLE } from '../../../shared/components/teams/teamStyle';
import { Icon } from '../../../shared/ui';
import { isTeamShape } from '../rules';

// The table, mid-game. A pair game is one row of faces with each player's
// score; the team shapes are two rows, each under a header in the team's ink
// and texture with the team's total. Either way the givers wear the speech
// mark and whoever's word is next is NOW (PlayerRow's whose-turn frame).
export default function TableScores({ game, players, youId = null, departedIds = [], activeId = null }) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const status = (p) => {
    if (departedIds.includes(p.id)) return <Tag>left</Tag>;
    if (game.givers.includes(p.id) && (game.phase === 'deal' || game.phase === 'chain')) {
      return (
        <span className="flex items-center gap-1 text-fg-helper">
          <Icon name="speech" label="Clue-giver" />
        </span>
      );
    }
    return null;
  };

  if (!isTeamShape(game.shape)) {
    return (
      <PlayerRow
        players={game.order.map((id) => byId.get(id)).filter(Boolean)}
        activeId={activeId}
        youId={youId}
        dimIds={departedIds}
        label="Scores"
        score={(p) => String(game.scores?.[p.id] ?? 0)}
        status={status}
      />
    );
  }

  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      {['red', 'blue'].map((team) => {
        const s = TEAM_STYLE[team];
        const members = (game.teams?.[team] ?? []).map((id) => byId.get(id)).filter(Boolean);
        const total = game.teamScores?.[team] ?? 0;
        const onTurn = game.shape === 'teams' && game.team === team && game.phase !== 'finished';
        return (
          <section key={team} aria-label={`${s.name} team`} className="border-2 border-ink bg-surface">
            <header className={`relative flex items-center gap-2 border-b-2 border-ink px-3 py-1.5 text-paper ${s.fill}`}>
              <span aria-hidden="true" className={`absolute inset-0 ${s.texture}`} />
              {/* On a solid patch of the team's ink: text over the texture's
                  paper lines is not something axe can measure. */}
              <span className={`relative flex items-baseline gap-2 px-1.5 ${s.fill}`}>
                <span className="font-display text-lg font-bold uppercase tracking-wide">{s.name}</span>
                <span className="text-xs font-bold">{total} pt{total === 1 ? '' : 's'}</span>
              </span>
              {onTurn && (
                <span
                  className="relative ml-auto border-2 border-ink bg-surface px-1.5 font-display text-[10px] font-bold
                    uppercase tracking-[0.2em] text-fg-strong"
                >
                  On turn
                </span>
              )}
            </header>
            <PlayerRow
              players={members}
              label={`${s.name} team`}
              activeId={activeId}
              youId={youId}
              dimIds={departedIds}
              status={status}
              className="mb-0! pb-2"
            />
          </section>
        );
      })}
    </div>
  );
}

function Tag({ children }) {
  return (
    <span className="font-display text-[10px] font-bold uppercase tracking-wider text-fg-helper">{children}</span>
  );
}
