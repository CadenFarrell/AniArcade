import { useCallback, useState } from 'react';
import AniTurfSetup from './components/AniTurfSetup';
import LocalRound from './components/LocalRound';
import AniTurfResults from './components/AniTurfResults';
import { drawBoard } from './utils/board';
import { CELLS, applyWin, pickStartTeam, rotateGivers } from './rules';
import { HubButton } from '../../shared/ui';
import TablePortraits from '../../shared/components/TablePortraits';

// Single-device pass-and-play: a thin view-router holding a `view` string,
// the same shape as every game's LocalGame.
export default function LocalGame({ onExit, onBack }) {
  const [view, setView] = useState('setup'); // setup | round | results
  const [error, setError] = useState(null);
  // What setup chose — players, teams, crowns, settings — kept whole so Play
  // again can deal the next game and "Change teams" can reopen setup as it was.
  const [table, setTable] = useState(null);
  const [setup, setSetup] = useState(null); // the round's own inputs, board included
  const [finished, setFinished] = useState(null);
  const [totals, setTotals] = useState({});
  // Bumped per game so LocalRound remounts and deals fresh keys rather than
  // reusing a hook whose lazy initializer has already run.
  const [roundKey, setRoundKey] = useState(0);

  const start = (chosen) => {
    setError(null);
    const { board, enough, available } = drawBoard(chosen.players, { sharedOnly: chosen.sharedOnly });
    if (!enough) {
      // Setup already gates on this; reaching here means the roster changed
      // under it, so say the number rather than failing silently.
      setError(`Only ${available} characters to draw from — the board needs ${CELLS}.`);
      return;
    }
    setTable(chosen);
    setSetup({
      board,
      teams: chosen.teams,
      clueGivers: chosen.clueGivers,
      traps: chosen.traps,
      startTeam: pickStartTeam(),
    });
    setFinished(null);
    setRoundKey((k) => k + 1);
    setView('round');
  };

  const handleFinish = useCallback((game) => {
    setFinished(game);
    setTotals((t) => applyWin(t, game));
    setView('results');
  }, []);

  const body = () => {
    if (view === 'round' && setup) {
      return <LocalRound key={roundKey} setup={setup} players={table.players} onFinish={handleFinish} />;
    }
    if (view === 'results' && finished) {
      return (
        <AniTurfResults
          game={finished}
          players={table.players}
          totalScores={totals}
          // Same teams, the next clue-giver on each, a fresh board and keys.
          onPlayAgain={() => start({ ...table, clueGivers: rotateGivers(table.teams, table.clueGivers) })}
          onChangeTeams={() => setView('setup')}
        />
      );
    }
    return (
      <AniTurfSetup
        // Remounted from `table` on the way back, so the couch and its teams
        // are still seated; the totals carry on, as Play again's do.
        initial={table}
        onStart={start}
        error={error}
        onBack={onBack}
      />
    );
  };

  return (
    <TablePortraits players={view === 'setup' ? null : table?.players}>
      <>
        <HubButton
          onClick={onExit}
          confirm={view === 'round' ? 'Return to the hub? The game will be lost.' : null}
        />
        {body()}
      </>
    </TablePortraits>
  );
}
