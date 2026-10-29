import PlayerRow from '../../../shared/components/PlayerRow';
import RoundHeader from '../../../shared/components/RoundHeader';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Backdrop, Button, Card, Icon, Screen } from '../../../shared/ui';
import {
  ROLES_PER_ROUND, currentPicker, hasVoted, isLastRound, pendingVoters, pickEndsAt, revealDone, revealedScores,
} from '../rules';
import Ballot from './Ballot';
import DraftScreen from './DraftScreen';
import RoleReveal from './RoleReveal';

// One round, on one phone. The draft is the same screen as on one device, live
// on every phone with only the picker's phone able to pick; the vote is your
// own ballot until you cast it, then who the table is still waiting for (never
// what anyone chose); the reveal moves on for everyone when anyone presses.
export default function OnlineRound({ room }) {
  const { game, clock } = room;
  const players = room.seatedPlayers;
  const me = room.myPlayerId;
  const active = room.activeIds;
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';

  const shell = (children) => (
    <>
      <Backdrop />
      <Screen width="md" className="pb-48!">{children}</Screen>
    </>
  );

  if (game.phase === 'draft') {
    const picker = currentPicker(game);
    const timed = pickEndsAt(game) != null && !clock.expired;
    return shell(
      <DraftScreen
        game={game}
        players={players}
        youId={me}
        canPick={picker === me}
        onPick={room.pick}
        onReshuffle={room.isHost ? room.reshuffle : null}
        clock={timed ? clock : null}
      />,
    );
  }

  if (game.phase === 'vote') {
    if (game.order.includes(me) && !hasVoted(game, me)) {
      return shell(<Ballot key={`${game.round}`} game={game} players={players} voter={me} onCast={room.vote} />);
    }
    const waiting = pendingVoters(game, active);
    return shell(
      <>
        <PlayerRow
          players={players}
          youId={me}
          dimIds={room.departedIds}
          label="Votes"
          status={(p) => (hasVoted(game, p.id)
            ? <span className="text-fg-helper"><Icon name="lock" label="Voted" /></span>
            : null)}
        />
        <RoundHeader
          title="Votes Coming In"
          tag={`Round ${game.round + 1}/${game.rounds}`}
          hint="Nobody sees a vote until they’re all in."
        />
        <Card padding="lg" className="mb-5 text-center">
          <p className="text-lg text-fg-body">
            {waiting.length ? `Waiting for ${waiting.map(nameOf).join(', ')}.` : 'Counting the votes…'}
          </p>
        </Card>
        <StartBar width="md" status="Your votes are in.">{null}</StartBar>
      </>,
    );
  }

  // The reveal.
  const done = revealDone(game);
  const last = isLastRound(game);
  const shown = revealedScores(game);
  return shell(
    <>
      <PlayerRow players={players} youId={me} dimIds={room.departedIds} label="Teams" score={(p) => String(shown[p.id] ?? 0)} />
      <RoundHeader
        title="Votes Are In"
        tag={done ? `Round ${game.round + 1}/${game.rounds}` : `Role ${game.shown + 1}/${ROLES_PER_ROUND}`}
        hint={done ? 'Every role turned over.' : 'Anyone can turn over the next role.'}
      />
      <RoleReveal game={game} players={players} youId={me} />
      <StartBar width="md" status={done ? (last ? 'That was the last round.' : 'Next: a new board and new roles.') : 'Reveal the next role.'} ready>
        {done
          ? <Button variant="primary" size="lg" onClick={room.next}>{last ? 'See results' : 'Next round'}</Button>
          : <Button variant="primary" size="lg" onClick={() => room.revealNext(game.shown)}>Next role</Button>}
      </StartBar>
    </>,
  );
}
