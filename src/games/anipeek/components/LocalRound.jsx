import { useMemo } from 'react';
import { usePeekRound } from '../hooks/usePeekRound';
import { suggestionsFor } from '../deal';
import PeekRound from './PeekRound';
import AniPeekResults from './AniPeekResults';

// One device, passed round the table. Unlike AniQuiz there is no handoff:
// nothing in AniPeek is private — every bid is said out loud, and the whole
// table watches the tiles come off — so the device just goes to whoever the
// heading names.
export default function LocalRound({ players, deal, onPlayAgain, onBack }) {
  const round = usePeekRound(players, deal);
  const suggestions = useMemo(() => suggestionsFor(players), [players]);

  if (round.game.phase === 'finished') {
    return <AniPeekResults players={players} scores={round.game.scores} onPlayAgain={onPlayAgain} onBack={onBack} />;
  }

  return (
    <PeekRound
      game={round.game}
      deal={deal}
      players={players}
      canActAs={() => true}
      suggestions={suggestions}
      onBid={round.bid}
      onPass={round.pass}
      onUncover={round.uncover}
      onHint={round.hint}
      onNameNow={round.nameNow}
      onAnswer={round.answer}
      onSkip={round.skip}
      onNext={round.next}
    />
  );
}
