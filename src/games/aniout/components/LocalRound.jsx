import { useState } from 'react';
import Handoff from '../../../shared/components/Handoff';
import { useSoundCue } from '../../../shared/hooks/useSoundCue';
import { useOutRound } from '../hooks/useOutRound';
import { stillToPick } from '../rules';
import OutRound from './OutRound';
import AniOutResults from './AniOutResults';

// One device, passed round the table. AniQuiz's shape: the screen sequence is
// DERIVED from the game, never stored — whoever picks next is
// `stillToPick(...)[0]`, and the only local state is `holding`, which player
// has confirmed the device is in their hands. A handoff shows whenever the next
// player is not the one holding it, so a lock-in hands the device on with no
// extra bookkeeping. A table of one never sees a handoff: there is nobody to
// hide a pick from.
export default function LocalRound({ players, deal, onPlayAgain, onBack }) {
  const round = useOutRound(players, deal);
  const { game, ids } = round;
  const [holding, setHolding] = useState(null);

  const current = stillToPick(game, ids)[0] ?? null;
  const shared = ids.length > 1;
  const needsHandoff = shared && current != null && holding !== current;
  const player = players.find((p) => p.id === current);

  // A mixed table's reveal has no one result to play, so it gets the reveal cue.
  useSoundCue('reveal', shared && game.phase === 'revealed' ? `${game.round}` : null);

  if (game.phase === 'finished') {
    return <AniOutResults players={players} scores={game.scores} onPlayAgain={onPlayAgain} onBack={onBack} />;
  }

  return (
    <OutRound
      game={game}
      deal={deal}
      players={players}
      pickerId={needsHandoff ? null : current}
      handoff={needsHandoff ? (
        <Handoff
          player={player}
          note="Picks stay hidden until everyone is in."
          cta={`I'm ${player?.name ?? 'next'} — ready`}
          onReady={() => setHolding(current)}
        />
      ) : null}
      onPick={(id, choice) => { round.pick(id, choice); setHolding(null); }}
      onNext={round.next}
    />
  );
}
