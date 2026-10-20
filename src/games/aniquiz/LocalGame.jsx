import { useState } from 'react';
import QuizSetup from './components/QuizSetup';
import LocalRound from './components/LocalRound';
import { buildDeal } from './deal';
import { useFactPack } from '../../shared/hooks/useFactPack';
import { HubButton } from '../../shared/ui';
import TablePortraits from '../../shared/components/TablePortraits';

// Single-device play: setup, then the round, whose own last screen is the
// results. A thin router, like every other game's LocalGame.
//
// Not resumable, unlike AniTune's. A board is a long game, and a parked one is
// worth having — but a resumed round would need the deal and every answer so
// far written to localStorage on the same origin whose quota the profiles
// already strain, and that is a decision to take on its own rather than as a
// side effect of shipping the game. The Hub button says so instead.
export default function LocalGame({ onExit, onBack }) {
  const pack = useFactPack();
  const [game, setGame] = useState(null); // { players, settings, deal, n }
  const [error, setError] = useState(null);

  const start = ({ players, settings }) => {
    const res = buildDeal(pack.pack, players, settings);
    if (res.error) { setError(res.error); return; }
    setError(null);
    // `n` remounts the round on "play again", so its hook deals a fresh game
    // instead of keeping the finished one's state.
    setGame((g) => ({ players, settings, deal: res.deal, n: (g?.n ?? 0) + 1 }));
  };

  // Faces shared out once for the whole table (see TablePortraits), so the turn
  // strip, the pass-the-device panel and the results all match the setup slots.
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
            deal={game.deal}
            settings={game.settings}
            pack={pack.pack}
            onPlayAgain={() => start(game)}
            onBack={() => setGame(null)}
          />
        ) : (
          <QuizSetup pack={pack} onStart={start} error={error} onBack={onBack} />
        )}
      </>
    </TablePortraits>
  );
}
