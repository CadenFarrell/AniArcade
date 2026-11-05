import { useState } from 'react';
import PeekSetup from './components/PeekSetup';
import LocalRound from './components/LocalRound';
import { dealGame, dealtKeys } from './deal';
import { readRecentDeals, rememberDealt } from '../../shared/utils/recentDeals';
import descriptor from './index';
import { useFactPack } from '../../shared/hooks/useFactPack';
import { HubButton } from '../../shared/ui';
import TablePortraits from '../../shared/components/TablePortraits';

// Single-device play: setup, then the round, whose own last screen is the
// results. A thin router, like every other game's LocalGame. Not resumable —
// the Hub button says so.
export default function LocalGame({ onExit, onBack }) {
  const pack = useFactPack();
  const [game, setGame] = useState(null); // { players, settings, deal, n }
  const [error, setError] = useState(null);

  const start = ({ players, settings }) => {
    const res = dealGame(players, settings, pack.pack, Math.random, { recent: readRecentDeals(descriptor.id) });
    // A failed deal goes back to setup, where `error` is shown: from "Play
    // again" the round is on screen, and the error would land nowhere.
    if (res.error) { setError(res.error); setGame(null); return; }
    rememberDealt(descriptor.id, dealtKeys(res.deal));
    setError(null);
    // `n` remounts the round on "play again", so its hook starts a fresh game.
    setGame((g) => ({ players, settings, deal: res.deal, n: (g?.n ?? 0) + 1 }));
  };

  return (
    <TablePortraits players={game?.players}>
      <>
        <HubButton
          onClick={onExit}
          confirm={game ? 'This game will be lost.' : null}
        />
        {game ? (
          <LocalRound
            key={game.n}
            players={game.players}
            deal={game.deal}
            onPlayAgain={() => start(game)}
            onBack={() => setGame(null)}
          />
        ) : (
          <PeekSetup pack={pack} onStart={start} error={error} onBack={onBack} />
        )}
      </>
    </TablePortraits>
  );
}
