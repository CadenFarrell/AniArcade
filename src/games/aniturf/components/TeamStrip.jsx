import PlayerRow from '../../../shared/components/PlayerRow';
import { Icon } from '../../../shared/ui';
import { TEAM_STYLE } from './teamStyle';

// Both teams as rows of faces, each under a header in its own ink and
// texture: how many squares it holds, which way it crosses, and an ON TURN tab
// on the team whose go it is. The clue-giver wears the crown; during a clue
// they are NOW (PlayerRow's whose-turn frame), since the whole table is waiting
// on that one person.
export default function TeamStrip({ game, players, youId = null, departedIds = [] }) {
  const byId = new Map(players.map((p) => [p.id, p]));
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      {['red', 'blue'].map((team) => {
        const s = TEAM_STYLE[team];
        const members = (game.teams[team] ?? []).map((id) => byId.get(id)).filter(Boolean);
        const held = game.marks.filter((m) => m === team).length;
        const onTurn = game.phase !== 'plant' && game.phase !== 'over' && game.turn === team;
        const giver = game.clueGivers[team];
        return (
          <section key={team} aria-label={`${s.name} team`} className="border-2 border-ink bg-surface">
            <header className={`relative flex items-center gap-2 border-b-2 border-ink px-3 py-1.5 text-paper ${s.fill}`}>
              <span aria-hidden="true" className={`absolute inset-0 ${s.texture}`} />
              {/* On a solid patch of the team's ink: paper text over the
                  texture's paper lines fell to ~3.4:1 where it crossed them,
                  and axe cannot measure text over a background image. */}
              <span className={`relative flex items-baseline gap-2 px-1.5 ${s.fill}`}>
                <span className="font-display text-lg font-bold uppercase tracking-wide">{s.name}</span>
                <span className="text-xs font-bold">{held} square{held === 1 ? '' : 's'} · {s.goal}</span>
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
              activeId={onTurn && game.phase === 'clue' ? giver : null}
              youId={youId}
              dimIds={departedIds}
              status={(p) => (p.id === giver ? (
                <span className="flex items-center gap-1 text-pop-amber">
                  <Icon name="crown" label="Clue-giver" />
                </span>
              ) : null)}
              className="mb-0! pb-2"
            />
          </section>
        );
      })}
    </div>
  );
}
