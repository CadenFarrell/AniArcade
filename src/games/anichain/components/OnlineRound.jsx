import ResultImpact from '../../../shared/components/ResultImpact';
import RoundHeader from '../../../shared/components/RoundHeader';
import { StartBar } from '../../../shared/components/SetupLayout';
import { TEAM_NAMES, teamOf } from '../../../shared/utils/teams';
import { Backdrop, Button, Card, Screen, TimerBar } from '../../../shared/ui';
import {
  SKIPS, currentGuessers, currentValue, guessedThisWord, isTeamShape, nextGiver, totalTurns, turnNo,
  turnsPerRound, valueAt, windowEndsAt, windowOpen,
} from '../rules';
import ChainLine from './ChainLine';
import { GuessBar, WordBar } from './EntryBar';
import GuessLog from './GuessLog';
import RoundReveal from './RoundReveal';
import { revealTitle } from '../copy';
import SecretCard from './SecretCard';
import TableScores from './TableScores';

// One turn, on one phone. Everyone sees the sentence build and every guess
// land; the givers also see their card (from their own secrets/ node) and,
// when it is their go, the word box; whoever the last word was for gets the
// guess box. Only the bottom bar changes with who you are.
export default function OnlineRound({ room }) {
  const { game, card, amGiver, windowClock } = room;
  const players = room.seatedPlayers;
  const me = room.myPlayerId;
  const active = room.activeIds;
  const plain = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const possessive = (id) => (id === me ? 'Your' : `${plain(id)}'s`);
  const [first, second] = game.givers;
  const givers = `${plain(first)} & ${plain(second)}`;
  const turn = turnNo(game);

  // My own result lands as a frame and its sound: my guess marked wrong, or
  // the turn won by me (or, in a team game, my team).
  const mine = game.guesses.filter((g) => g.by === me && (g.verdict === 'wrong' || g.verdict === 'right'));
  const lastMine = mine[mine.length - 1];
  let impact = null;
  let eventKey = null;
  if (game.phase === 'over' && game.result?.kind === 'got') {
    const won = isTeamShape(game.shape) ? teamOf(game, me) === game.result.team : game.result.by === me || game.givers.includes(me);
    if (won) { impact = 'correct'; eventKey = `${turn}:got`; }
  } else if (game.phase === 'chain' && lastMine?.verdict === 'wrong') {
    impact = 'wrong';
    eventKey = `${turn}:${lastMine.n}`;
  }

  const shell = (children, bar = null) => (
    <>
      <Backdrop />
      <ResultImpact result={impact} eventKey={eventKey} />
      <Screen width="md" className="pb-48!">
        <TableScores
          game={game}
          players={players}
          youId={me}
          departedIds={room.departedIds}
          activeId={game.phase === 'chain' && game.chain.length < game.cap ? nextGiver(game) : null}
        />
        {children}
      </Screen>
      {bar}
    </>
  );

  if (game.phase === 'deal') {
    return shell(
      <>
        <RoundHeader
          title={amGiver ? 'Your Character' : `${givers} Look`}
          tag={`Turn ${turn + 1}/${totalTurns(game)}`}
          hint={amGiver ? 'Dealing your character…' : `Dealing a character to ${givers}…`}
        />
        <Card padding="lg" className="mb-5 text-center">
          <p className="text-lg text-fg-body">
            {amGiver ? 'One moment — your card is on its way.' : `${givers} are about to see who they’re describing.`}
          </p>
        </Card>
      </>,
    );
  }

  if (game.phase === 'over') {
    const last = game.round + 1 >= game.rounds && game.turn + 1 >= turnsPerRound(game.shape);
    const label = last ? 'See results' : game.turn + 1 < turnsPerRound(game.shape) ? 'Next turn' : 'Next round';
    return shell(
      <>
        <RoundHeader title={revealTitle(game.result)} tag={`Turn ${turn + 1}/${totalTurns(game)}`} />
        <RoundReveal game={game} players={players} youId={me} />
      </>,
      <StartBar width="md" status={last ? 'That was the last turn.' : 'Anyone can move the table on.'} ready>
        <Button variant="primary" size="lg" onClick={room.next}>{label}</Button>
      </StartBar>,
    );
  }

  // The chain.
  const n = game.chain.length;
  const capped = n >= game.cap;
  const speaker = nextGiver(game);
  const now = room.now();
  const open = windowOpen(game, now, active);
  const forMe = currentGuessers(game, active).includes(me);
  const forTeam = game.shape === 'rivals' && n ? TEAM_NAMES[teamOf(game, game.chain[n - 1].by)] : null;
  const clockOn = n > 0 && windowEndsAt(game) != null && !windowClock.expired && !open;

  const title = capped ? 'Last Guesses' : `${possessive(speaker)} Word`;
  const hint = !n
    ? `${plain(first)} starts. A right guess on word 1 is worth ${valueAt(game.cap, 1)}.`
    // Said of the word just spoken, by name — see LocalRound.
    : `${forTeam ? `${plain(game.chain[n - 1].by)}’s word is for ${forTeam} only. ` : ''}One guess each — worth ${currentValue(game)} now.`;

  let bar;
  if (amGiver) {
    if (speaker === me && !capped && card) {
      const wait = !open ? (game.guesses.some((g) => g.verdict === 'pending')
        ? 'Checking a guess…'
        : `Waiting for guesses — ${windowClock.secondsLeft}s.`) : null;
      bar = <WordBar key={`${turn}:${n}`} banned={card.banned} wait={wait} onAdd={room.addWord} />;
    } else {
      bar = (
        <StartBar width="md" status={capped ? 'Last guesses — then the turn is over.' : `Waiting for ${plain(speaker)}’s word.`}>
          {null}
        </StartBar>
      );
    }
  } else if (forMe && !guessedThisWord(game, me)) {
    bar = (
      <GuessBar
        key={`${turn}:${n}`}
        status={`One guess on word ${n} — worth ${currentValue(game)}.`}
        onGuess={room.guess}
        onPass={room.pass}
      />
    );
  } else {
    const status = !n ? `Waiting for ${plain(first)}’s first word.`
      : forMe ? 'Guess in — waiting for the next word.'
        : forTeam ? `${forTeam} is guessing ${plain(game.chain[n - 1].by)}’s word.`
          : 'Watching — this turn is the other team’s.';
    bar = <StartBar width="md" status={status}>{null}</StartBar>;
  }

  return shell(
    <>
      <RoundHeader title={title} tag={`Word ${Math.min(n + 1, game.cap)}/${game.cap}`} hint={hint}>
        {clockOn && (
          <TimerBar secondsLeft={windowClock.secondsLeft} fraction={windowClock.fraction} label="Time to guess" />
        )}
      </RoundHeader>
      {amGiver && (card ? (
        <SecretCard card={card} compact>
          {!n && game.skips < SKIPS && (
            <Button variant="secondary" fullWidth onClick={room.skip}>Don&apos;t know them — another</Button>
          )}
        </SecretCard>
      ) : (
        <Card padding="lg" className="mb-5 text-center"><p className="text-fg-body">Your card is on its way…</p></Card>
      ))}
      <ChainLine game={game} players={players} />
      <GuessLog game={game} players={players} youId={me} />
    </>,
    bar,
  );
}
