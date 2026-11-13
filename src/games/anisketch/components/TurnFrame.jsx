import PlayerRow from '../../../shared/components/PlayerRow';
import RoundHeader from '../../../shared/components/RoundHeader';
import ResultImpact from '../../../shared/components/ResultImpact';
import { Backdrop, Screen } from '../../../shared/ui';

/**
 * What every AniSketch turn screen sits in, on any device: the table as a row
 * of faces (the drawer under NOW), the turn's heading with its tab, and an
 * optional clock inside the header. `impact` lands a right/wrong
 * (ResultImpact) once per `impactKey`.
 *
 * The headings are what the bots and tests read: "Pick What to Draw",
 * "<name> Is Choosing", "Ready to Draw", "Draw!", "Guess the Drawing",
 * "It Was…", "Round Void".
 */
export default function TurnFrame({
  game, players, youId = null, departedIds = [], title, hint, clock = null, impact = null, impactKey = null, children,
}) {
  const live = ['choosing', 'drawing'].includes(game.phase);
  return (
    <>
      <Backdrop />
      <ResultImpact result={impact} eventKey={impact ? impactKey : null} />
      <Screen width="md">
        <PlayerRow
          players={players}
          youId={youId}
          activeId={live ? game.drawer : null}
          dimIds={departedIds}
          label="Scores"
          score={(p) => String(game.scores?.[p.id] ?? 0)}
          status={(p) => {
            if (departedIds.includes(p.id)) return <Tag>left</Tag>;
            if (p.id === game.drawer && live) return <Tag>drawing</Tag>;
            if (game.got?.[p.id]) return <Tag>+{game.got[p.id].points}</Tag>;
            return null;
          }}
        />
        <RoundHeader title={title} tag={`Turn ${game.turn + 1}/${game.turns}`} hint={hint}>
          {clock}
        </RoundHeader>
        {children}
      </Screen>
    </>
  );
}

function Tag({ children }) {
  return <span className="font-display text-[10px] font-bold uppercase tracking-wider text-fg-helper">{children}</span>;
}
