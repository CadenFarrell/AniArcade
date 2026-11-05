import { useState } from 'react';
import AniTagSetup from './components/AniTagSetup';
import LocalSession from './components/LocalSession';
import AniTagResults from './components/AniTagResults';
import { HubButton } from '../../shared/ui';
import TablePortraits from '../../shared/components/TablePortraits';

// Single-device pass-and-play. A thin view-router, the same shape as
// src/games/wavelength/LocalGame.jsx: it holds a `view` string and hands the
// work to dumb screens from components/.
export default function LocalGame({ onExit, onBack }) {
  const [view, setView] = useState('setup'); // setup | playing | results
  // { players, rounds, proposalCap, categoryPool, categorySource, customCategories }
  const [game, setGame] = useState(null);
  const [totals, setTotals] = useState({});
  // The session's round lines, for the final screen's awards.
  const [log, setLog] = useState([]);
  // Bumped per session so LocalSession remounts and re-deals rather than reusing
  // a hook whose lazy initializers have already run.
  const [sessionKey, setSessionKey] = useState(0);

  const start = (settings) => {
    setGame(settings);
    setTotals({});
    setLog([]);
    setSessionKey((k) => k + 1);
    setView('playing');
  };

  const body = () => {
    if (view === 'playing' && game) {
      return (
        <LocalSession
          key={sessionKey}
          players={game.players}
          rounds={game.rounds}
          proposalCap={game.proposalCap}
          categoryPool={game.categoryPool}
          categorySource={game.categorySource}
          customCategories={game.customCategories}
          onFinish={(totalScores, lines = []) => { setTotals(totalScores); setLog(lines); setView('results'); }}
          onQuit={() => { setGame(null); setView('setup'); }}
        />
      );
    }

    if (view === 'results' && game) {
      return (
        <AniTagResults
          players={game.players}
          totalScores={totals}
          log={log}
          onPlayAgain={() => start(game)}
          onBack={() => { setGame(null); setView('setup'); }}
        />
      );
    }

    return <AniTagSetup onStart={start} onBack={onBack} />;
  };

  // Every local screen sits under one fixed "Hub" button rather than carrying
  // its own way out, so the exit never moves between views.
  // Faces shared out once for the whole table (see TablePortraits), so the turn
  // strip, the pass-the-device panel and the results all match the setup slots.
  return (
    <TablePortraits players={game?.players}>
      <>
        <HubButton
          onClick={onExit}
          confirm={view === 'playing' ? 'The session will be lost.' : null}
        />
        {body()}
      </>
    </TablePortraits>
  );
}
