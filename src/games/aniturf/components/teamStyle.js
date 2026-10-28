import { TEAM_STYLE as SHARED } from '../../../shared/components/teams/teamStyle';

// The shared team look (shared/components/teams/teamStyle.js) plus the one
// thing only AniTurf has: which way each team crosses the board.
export const TEAM_STYLE = {
  red: { ...SHARED.red, goal: 'left to right' },
  blue: { ...SHARED.blue, goal: 'top to bottom' },
};
