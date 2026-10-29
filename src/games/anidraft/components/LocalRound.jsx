import { useState } from 'react';
import Handoff from '../../../shared/components/Handoff';
import PlayerRow from '../../../shared/components/PlayerRow';
import RoundHeader from '../../../shared/components/RoundHeader';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Backdrop, Button, Screen } from '../../../shared/ui';
import { useDraftRound } from '../hooks/useDraftRound';
import { ROLES_PER_ROUND, isLastRound, pendingVoters, revealDone, revealedScores } from '../rules';
import AniDraftResults from './AniDraftResults';
import Ballot from './Ballot';
import DraftScreen from './DraftScreen';
import RoleReveal from './RoleReveal';

// One device in the middle of the table. The draft needs no passing — every
// pick is made in the open, so the picker just takes the phone and taps — but
// the vote is secret: each voter in seat order gets a Handoff, then their whole
// ballot, then hands on. The device remembers which voter has passed the
// handoff, so a ballot is never shown to the wrong person after a re-render.
export default function LocalRound({ players, settings, onPlayAgain, onBack }) {
  const round = useDraftRound(players, settings);
  const { game } = round;
  const [holding, setHolding] = useState(null); // `${round}:${voterId}` once they have the phone

  if (game.phase === 'finished') {
    return <AniDraftResults game={game} players={players} onPlayAgain={onPlayAgain} onBack={onBack} />;
  }

  const playerOf = (id) => players.find((p) => p.id === id);

  if (game.phase === 'draft') {
    return (
      <Shell>
        <DraftScreen
          game={game}
          players={players}
          canPick
          onPick={round.pick}
          onReshuffle={round.reshuffle}
        />
      </Shell>
    );
  }

  if (game.phase === 'vote') {
    const voter = pendingVoters(game)[0];
    const key = `${game.round}:${voter}`;
    if (holding !== key) {
      return (
        <Shell>
          <Handoff
            player={playerOf(voter)}
            note="Vote for the best pick in each role. Everyone else, look away."
            cta={`I'm ${playerOf(voter)?.name ?? 'next'} — vote`}
            onReady={() => setHolding(key)}
          />
        </Shell>
      );
    }
    return (
      <Shell>
        <Ballot
          // A fresh ballot per voter: the last voter's choices must not carry over.
          key={key}
          game={game}
          players={players}
          voter={voter}
          title={`${playerOf(voter)?.name ?? 'Your'}'s Vote`}
          onCast={(choices) => { setHolding(null); round.vote(voter, choices); }}
        />
      </Shell>
    );
  }

  // The reveal.
  const done = revealDone(game);
  const last = isLastRound(game);
  const shown = revealedScores(game);
  return (
    <Shell>
      <PlayerRow players={players} label="Teams" score={(p) => String(shown[p.id] ?? 0)} />
      <RoundHeader
        title="Votes Are In"
        tag={done ? `Round ${game.round + 1}/${game.rounds}` : `Role ${game.shown + 1}/${ROLES_PER_ROUND}`}
        hint={done ? 'Every role turned over.' : 'Turn the roles over one at a time.'}
      />
      <RoleReveal game={game} players={players} />
      <StartBar width="md" status={done ? (last ? 'That was the last round.' : 'Next: a new board and new roles.') : 'Reveal the next role.'} ready>
        {done
          ? <Button variant="primary" size="lg" onClick={round.next}>{last ? 'See results' : 'Next round'}</Button>
          : <Button variant="primary" size="lg" onClick={round.revealNext}>Next role</Button>}
      </StartBar>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <>
      <Backdrop />
      <Screen width="md" className="pb-48!">{children}</Screen>
    </>
  );
}
