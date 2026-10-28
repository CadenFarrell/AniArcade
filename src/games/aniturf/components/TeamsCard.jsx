import SharedTeamsCard from '../../../shared/components/teams/TeamsCard';
import { Icon } from '../../../shared/ui';
import { TEAM_STYLE } from './teamStyle';

// AniTurf's teams card: the shared one (shared/components/teams/TeamsCard.jsx)
// with the crown — each team's clue-giver — and which way each team crosses.
// Shared by local setup (`canEdit` on every row) and the online lobby (each
// player moves only themselves; only the host hands out crowns).
export default function TeamsCard({ teams, givers, players, canMove = () => true, canCrown = true, onMove, onCrown, youId = null }) {
  return (
    <SharedTeamsCard
      teams={teams}
      players={players}
      canMove={canMove}
      onMove={onMove}
      youId={youId}
      givers={givers}
      canCrown={canCrown}
      onCrown={onCrown}
      subtitle={(team) => `crosses ${TEAM_STYLE[team].goal}`}
      note={<><Icon name="crown" /> gives the clues and alone sees the team&apos;s key. Each team needs two players.</>}
    />
  );
}
