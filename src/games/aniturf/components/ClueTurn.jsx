import RoundHeader from '../../../shared/components/RoundHeader';
import { Banner } from '../../../shared/ui';
import { TEAM_NAMES } from '../rules';
import ClueForm from './ClueForm';
import TurfBoard from './TurfBoard';

// The clue-giver's turn: their key over the board, and the clue. Pressing
// "Give the clue" is also what takes the key off the screen — locally the
// device goes straight to the guessers' board, so there is no separate "hide"
// for a clue-giver to forget.
//
// `detour` is the team's detour notice (rules.nextDetour): squares its key
// gained when its route was cut. It is news exactly once — on the first clue
// screen after it happened — and only ever here: the clue-giver is the one
// person who may know their key changed.
export default function ClueTurn({ game, team, footing, traps, detour = null, onClue, busy = false }) {
  const lastClue = game.log.findLastIndex((e) => e.kind === 'clue' && e.team === team);
  const fresh = detour && detour.at - 1 > lastClue ? detour.squares : [];
  return (
    <>
      <RoundHeader
        title="Your clue"
        tag={`${TEAM_NAMES[team]} key`}
        hint="Ringed squares are your footing. One word, and how many squares it points to — your team may claim that many."
      />
      {fresh.length > 0 && (
        <Banner tone="info" className="mb-4">
          Your route was cut, so your key now runs a detour. New footing:{' '}
          {fresh.map((i) => game.board[i]?.name).join(', ')} — marked NEW on the board.
        </Banner>
      )}
      <TurfBoard board={game.board} marks={game.marks} keyView={{ team, footing, traps, fresh }} />
      <ClueForm board={game.board} onSubmit={onClue} disabled={busy} />
    </>
  );
}
