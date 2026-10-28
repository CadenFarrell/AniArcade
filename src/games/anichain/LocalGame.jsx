import { useState } from 'react';
import ChainSetup from './components/ChainSetup';
import LocalRound from './components/LocalRound';
import { useFactPack } from '../../shared/hooks/useFactPack';
import { HubButton } from '../../shared/ui';
import TablePortraits from '../../shared/components/TablePortraits';

// Single-device play: setup, then the round, whose own last screen is the
// results. A thin router, like every other game's LocalGame. Not resumable —
// the Hub button says so.
export default function LocalGame({ onExit, onBack }) {
  const pack = useFactPack();
  const [game, setGame] = useState(null); // { players, settings, teams, n }

  // `n` remounts the round on "play again", so its hook starts a fresh game.
  const start = ({ players, settings, teams }) => setGame((g) => ({ players, settings, teams, n: (g?.n ?? 0) + 1 }));

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
            teams={game.teams}
            pack={pack.pack}
            onPlayAgain={() => start(game)}
            onBack={() => setGame(null)}
          />
        ) : (
          <ChainSetup pack={pack} onStart={start} onBack={onBack} />
        )}
      </>
    </TablePortraits>
  );
}
