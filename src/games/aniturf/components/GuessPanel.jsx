import { useState } from 'react';
import RoundHeader from '../../../shared/components/RoundHeader';
import SpeechBubble from '../../../shared/components/SpeechBubble';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Button } from '../../../shared/ui';
import { TEAM_NAMES, canClaim, canStop } from '../rules';
import TurfBoard from './TurfBoard';

// The team on turn at the board. A square is picked first and claimed second,
// so a stray tap on a phone is a highlighted square, not a scorched one.
//
// The board comes straight after the heading, and Claim / End turn ride in a
// bar pinned to the bottom of the viewport (the setup screens' StartBar) with
// the clue beside them. On a phone the team rows and the clue bubble above the
// board pushed it ~680px down and Claim ~1,200px down, so every claim was
// scroll down, tap, scroll down again. Whatever the caller passes as
// `children` (the team strip, the clue log) goes under the board; the screen
// around this needs `pb-36!` to clear the bar, as setup screens do.
//
// `canAct` is false for everyone who may watch but not press — the other team,
// and online the clue-giver of the team on turn, whose key is on their screen.
// `keyView` is only ever that clue-giver's. `waiting` is online's pending
// claim: the two devices that hold the answers have not answered yet.
export default function GuessPanel({
  game, giverName, canAct, onClaim, onStop, keyView = null, waiting = false, children,
}) {
  const team = game.turn;
  const [selected, setSelected] = useState(null);
  const pickable = canAct && !waiting;
  // A square somebody else just took (online) stops being a valid pick.
  const live = selected != null && canClaim(game, team, selected) ? selected : null;
  const left = game.claimsLeft;
  const clueLine = game.clue ? `“${game.clue.word}” · ${game.clue.number}` : '';
  const status = waiting ? `${clueLine} — checking the key…`
    : canAct ? `${clueLine} — ${live != null ? `claim ${game.board[live].name}?` : 'pick a square, then claim it.'}`
      : `${clueLine} — ${TEAM_NAMES[team]} is choosing.`;
  return (
    <>
      <RoundHeader
        title={`${TEAM_NAMES[team]}'s Turn`}
        tag={`${left} claim${left === 1 ? '' : 's'} left`}
        hint={canAct
          ? 'Pick a square your team can reach — an edge of yours, or next to a square you hold.'
          : `${TEAM_NAMES[team]} is choosing squares.`}
      />
      <TurfBoard
        board={game.board}
        marks={game.marks}
        mode={pickable ? 'pick' : 'view'}
        canPick={(i) => canClaim(game, team, i)}
        selected={pickable ? live : null}
        onSelect={(i) => setSelected((cur) => (cur === i ? null : i))}
        keyView={keyView}
      />
      {game.clue && (
        <SpeechBubble who={giverName} verb="says">
          {game.clue.word} · {game.clue.number}
        </SpeechBubble>
      )}
      {children}
      <StartBar status={status} ready={canAct && live != null} width="md">
        {canAct && (
          <>
            <Button variant="secondary" size="lg" disabled={waiting || !canStop(game, team)} onClick={onStop}>
              End turn
            </Button>
            <Button
              variant="primary"
              size="lg"
              sound={null}
              disabled={live == null || waiting}
              onClick={() => { const cell = live; setSelected(null); onClaim(cell); }}
            >
              {waiting ? 'Checking…' : live != null ? `Claim ${game.board[live].name}` : 'Claim'}
            </Button>
          </>
        )}
      </StartBar>
    </>
  );
}
