import { useNameRound } from '../hooks/useNameRound';
import NameRound from './NameRound';
import AniNameResults from './AniNameResults';

// One device, passed round the table. There is no handoff: nothing in AniName
// is private — bids are said out loud and the namer types with the table
// watching — so the device just goes to whoever the heading names. The table
// rules on unknown names in person, so this device judges as anyone but the
// namer (or the namer themself, at a table of one).
export default function LocalRound({ players, deal, pack, onPlayAgain, onBack }) {
  const round = useNameRound(players, deal, pack);
  const { game } = round;

  if (game.phase === 'finished') {
    return <AniNameResults players={players} scores={game.scores} onPlayAgain={onPlayAgain} onBack={onBack} />;
  }

  const judgeAs = players.find((p) => p.id !== game.bid?.by)?.id ?? game.bid?.by ?? null;
  return (
    <NameRound
      game={game}
      deal={deal}
      players={players}
      index={round.index}
      clock={round.clock}
      canActAs={() => true}
      judgeAs={judgeAs}
      onBid={round.bid}
      onPass={round.pass}
      onName={round.name}
      onDone={round.done}
      onJudge={round.judge}
      onNext={round.next}
    />
  );
}
