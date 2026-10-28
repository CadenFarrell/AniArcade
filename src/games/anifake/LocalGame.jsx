import { useCallback, useState } from 'react';
import AniFakeSetup from './components/AniFakeSetup';
import LocalRound from './components/LocalRound';
import AniFakeResults from './components/AniFakeResults';
import AniFakeFinal from './components/AniFakeFinal';
import { eligibleCharacters } from './utils/pool';
import { applyRoundScores, minPool, roundLogEntry, seating } from './rules';
import { isFinalRound, matchLabel } from '../../shared/utils/match';
import { HubButton } from '../../shared/ui';
import TablePortraits from '../../shared/components/TablePortraits';

// Single-device pass-and-play. A thin view-router, the same shape as
// src/games/anirank/LocalGame.jsx: it holds a `view` string and hands the work
// to dumb screens from components/.
export default function LocalGame({ onExit, onBack }) {
  const [view, setView] = useState('setup'); // setup | round | results | final
  const [error, setError] = useState(null);
  const [game, setGame] = useState(null); // { players, pool, settings }
  const [finished, setFinished] = useState(null);
  const [totalScores, setTotalScores] = useState({});
  // The match (shared/utils/match.js): which round this is, and one log line
  // per finished round for the final screen's awards.
  const [matchRound, setMatchRound] = useState(0);
  const [log, setLog] = useState([]);
  // Bumped per round so LocalRound remounts and re-deals rather than reusing a
  // hook whose lazy initializer has already run.
  const [roundKey, setRoundKey] = useState(0);

  // From setup: a new match, totals and log cleared.
  const startMatch = (opts) => {
    setTotalScores({});
    setLog([]);
    setMatchRound(0);
    start(opts);
  };

  const start = ({ players, sharedOnly, mode, laps, talkMode, fame, allowRedeal, rounds, clueSeconds }) => {
    setError(null);
    const pool = eligibleCharacters(players, { sharedOnly });
    const needed = minPool(mode);
    if (pool.length < needed) {
      // The setup screen already gates on this, so reaching here means the
      // roster changed under it — say the number rather than failing silently.
      setError(`Only ${pool.length} characters to draw from — ${mode} mode needs ${needed}.`);
      return;
    }
    // talkMode rides in settings rather than on the round: it decides which
    // screen renders, never what the rules accept, so it must not reach
    // rules.startRound. `fame` is the same kind of thing one layer down — it
    // shapes the draw, not the round — and `allowRedeal` decides whether the
    // check phase exists at all. onPlayAgain spreads settings straight back in
    // here, so a re-deal keeps all of them without any extra plumbing; anything
    // left out of this object is silently dropped on the second round.
    setGame({
      players,
      pool,
      sharedOnly,
      settings: { mode, laps, wordLimit: 1, talkMode, fame, allowRedeal, rounds: rounds ?? 0, clueSeconds: clueSeconds ?? 0 },
    });
    setMatchRound((n) => n + 1);
    setFinished(null);
    setRoundKey((k) => k + 1);
    setView('round');
  };

  // Stable, so LocalRound's finish effect isn't re-armed every render.
  const handleFinish = useCallback((result) => {
    setFinished(result);
    setTotalScores((totals) => applyRoundScores(totals, result.scores));
    setLog((l) => [...l, roundLogEntry(result.state, { fakeId: result.fakeId, secret: result.secret })]);
    setView('results');
  }, []);

  // Every local screen sits under one fixed "Hub" button rather than carrying
  // its own way out, so the exit never moves between views. Rendering it here
  // rather than per screen is what gives the pass-and-play screens inside
  // LocalRound — SecretReveal, CardCheck, VoteScreen, StealScreen and the two
  // interstitials — a way out at all; they had none, and only ClueRound's
  // "← Leave the round" (which drops back to setup, not home) ever did.
  const body = () => {
    if (view === 'round' && game) {
      return (
        <LocalRound
          key={roundKey}
          players={game.players}
          pool={game.pool}
          settings={game.settings}
          onFinish={handleFinish}
          onQuit={() => { setGame(null); setView('setup'); }}
        />
      );
    }

    if (view === 'final' && game) {
      return (
        <AniFakeFinal
          players={game.players}
          totalScores={totalScores}
          log={log}
          rounds={game.settings.rounds}
          onPlayAgain={() => startMatch({ players: game.players, sharedOnly: game.sharedOnly, ...game.settings })}
          onBack={() => { setGame(null); setView('setup'); }}
        />
      );
    }

    if (view === 'results' && game && finished) {
      const last = isFinalRound(matchRound, game.settings.rounds);
      return (
        <AniFakeResults
          // Seated, so the reveal lists players in the same order and under the
          // same seat numbers the clue log and the ballot used.
          players={seating(finished.state, game.players)}
          game={finished.state}
          fakeId={finished.fakeId}
          secret={finished.secret}
          fakeCard={finished.fakeCard}
          roundScores={finished.scores}
          totalScores={totalScores}
          // Re-deals from the same pool rather than reusing the round: roundKey
          // remounts LocalRound, whose lazy initializer picks a fresh secret.
          // The last round of a match goes on to the final scores; any other
          // re-deals the next one, totals kept.
          onPlayAgain={last ? () => setView('final') : () => start({
            players: game.players,
            sharedOnly: game.sharedOnly,
            ...game.settings,
          })}
          playAgainLabel={last ? 'Final scores' : 'Next round'}
          onEndMatch={last ? null : () => setView('final')}
          matchTag={matchLabel(matchRound, game.settings.rounds)}
          // "Next round" re-deals with the same mode and settings, so this is
          // the only route back to the options. Safe here and nowhere earlier:
          // the reveal has happened, so there is no secret left to protect.
          // Starting from setup is a new match (startMatch clears the totals).
          onBack={() => { setGame(null); setView('setup'); }}
        />
      );
    }

    return <AniFakeSetup onStart={startMatch} error={error} onBack={onBack} />;
  };

  // Faces shared out once for the whole table (see TablePortraits), so the turn
  // strip, the pass-the-device panel and the results all match the setup slots.
  return (
    <TablePortraits players={game?.players}>
      <>
        <HubButton
          onClick={onExit}
          confirm={view === 'round' ? 'Return to the hub? The round will be lost.' : null}
        />
        {body()}
      </>
    </TablePortraits>
  );
}
