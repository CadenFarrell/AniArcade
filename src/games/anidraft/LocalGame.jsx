import { useState } from 'react';
import DraftSetup from './components/DraftSetup';
import LocalRound from './components/LocalRound';
import { HubButton } from '../../shared/ui';
import TablePortraits from '../../shared/components/TablePortraits';

// Single-device play: setup, then the round, whose own last screen is the
// results. A thin router, like every other game's LocalGame. Not resumable —
// the Hub button says so.
export default function LocalGame({ onExit, onBack }) {
  const [game, setGame] = useState(null); // { players, settings, n }

  // `n` remounts the round on "play again", so its hook starts a fresh game.
  const start = ({ players, settings }) => setGame((g) => ({ players, settings, n: (g?.n ?? 0) + 1 }));

  return (
    <TablePortraits players={game?.players}>
      <>
        <HubButton
          onClick={onExit}
          confirm={game ? 'Return to the hub? This game will be lost.' : null}
        />
        {game ? (
          <LocalRound
            key={game.n}
            players={game.players}
            settings={game.settings}
            onPlayAgain={() => start(game)}
            onBack={() => setGame(null)}
          />
        ) : (
          <DraftSetup onStart={start} onBack={onBack} />
        )}
      </>
    </TablePortraits>
  );
}
