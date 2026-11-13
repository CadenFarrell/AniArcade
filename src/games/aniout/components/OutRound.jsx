import PlayerRow from '../../../shared/components/PlayerRow';
import RoundHeader from '../../../shared/components/RoundHeader';
import ResultImpact from '../../../shared/components/ResultImpact';
import { Backdrop, Button, Card, Screen } from '../../../shared/ui';
import { currentSet } from '../rules';
import CardGrid from './CardGrid';
import PickPanel from './PickPanel';
import RevealPanel from './RevealPanel';
import BoardReveal from './BoardReveal';
import SortBoard from './SortBoard';

// One round, on any device — the screen local play and every phone in a room
// both draw. It holds no state of its own: the phase says what is on screen.
//
// `pickerId` is who picks on THIS screen right now — locally the player holding
// the device (LocalRound decides, behind its handoff), online this phone's own
// seat until it has locked in, then null. With nobody to pick here the cards
// show, unpickable, beside who is still to lock in.
//
// `handoff`, when set, stands in for the picking panel: local play's "pass the
// device" screen, drawn under the same heading and score row.
export default function OutRound({
  game, deal, players, departedIds = [], youId = null, pickerId = null, handoff = null,
  onPick, onNext,
}) {
  const set = currentSet(game, deal);
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const roundKey = `${game.round}`;
  const lastRound = game.round + 1 >= game.rounds;
  const revealed = game.phase === 'revealed';
  const locked = (id) => Boolean(game.picks?.[id]);
  const waitingOn = players.filter((p) => !departedIds.includes(p.id) && !locked(p.id)).map((p) => p.name);
  // "Groups of four": a round is a board to sort (SortBoard / BoardReveal).
  const groups = deal.mode === 'groups';
  const unit = groups ? 'Board' : 'Round';
  const Reveal = groups ? BoardReveal : RevealPanel;

  let hint;
  if (revealed) hint = groups ? null : set?.sentence ?? null;
  else if (groups) {
    hint = `${set?.groups?.length ?? 4} hidden groups of four. Each shares something nobody else on the board has.`
      + (deal.reasonsOn ? ' Sort them, and say what joins each.' : ' Sort them.');
  } else if (deal.reasonsOn) hint = 'All but one share something. Pick who’s out, and why.';
  else hint = 'All but one share something. Pick who’s out.';

  let panel;
  if (!set) {
    panel = <Card padding="lg" className="text-center"><p className="text-fg-body">This round could not be loaded.</p></Card>;
  } else if (revealed) {
    panel = (
      <Reveal set={set} game={game} deal={deal} players={players} youId={youId}>
        <Button variant="primary" size="lg" fullWidth onClick={onNext}>
          {lastRound ? 'See results' : `Next ${unit.toLowerCase()}`}
        </Button>
      </Reveal>
    );
  } else if (handoff) {
    panel = handoff;
  } else if (pickerId) {
    panel = (
      <div key={`${roundKey}:${pickerId}`}>
        {!youId && players.length > 1 && (
          <p className="mb-3 text-center font-display text-xl font-extrabold text-fg-strong">
            {nameOf(pickerId)}, your {groups ? 'sort' : 'pick'}
          </p>
        )}
        {groups
          ? <SortBoard set={set} reasonsOn={deal.reasonsOn} onLock={(choice) => onPick(pickerId, choice)} />
          : <PickPanel set={set} reasonsOn={deal.reasonsOn} onLock={(choice) => onPick(pickerId, choice)} />}
      </div>
    );
  } else {
    panel = (
      <>
        {/* A board's 16 are too many to stand in for a waiting screen. */}
        {!groups && <CardGrid cards={set.cards} />}
        <Card padding="lg" className="text-center">
          <p className="text-lg text-fg-body">
            {/* "Locked in" only for a seat that has: someone who joined the
                room after the deal has no pick to have locked. */}
            {youId && locked(youId) ? 'Locked in. ' : ''}
            {waitingOn.length ? `Waiting for ${waitingOn.join(', ')}…` : 'Revealing…'}
          </p>
        </Card>
      </>
    );
  }

  // Online, only this player's own result lands on their phone (the sound rule
  // in .claude/rules/styling.md); locally a table of one gets its own, and a
  // bigger table's mixed results are the reveal panel's to say.
  const resultFor = youId ?? (players.length === 1 ? players[0].id : null);
  const mine = revealed && resultFor ? game.picks?.[resultFor] : null;
  const impact = mine ? (mine.correct ? 'correct' : 'wrong') : null;

  return (
    <>
      <Backdrop />
      <ResultImpact result={impact} eventKey={impact ? roundKey : null} />
      <Screen width="md">
        <PlayerRow
          players={players}
          youId={youId}
          activeId={!revealed && !handoff ? pickerId : null}
          dimIds={departedIds}
          label="Scores"
          score={(p) => String(game.scores?.[p.id] ?? 0)}
          status={(p) => {
            if (departedIds.includes(p.id)) return <Tag>left</Tag>;
            if (revealed && game.picks?.[p.id]) return <Tag>+{game.picks[p.id].delta ?? 0}</Tag>;
            if (!revealed && locked(p.id)) return <Tag>locked</Tag>;
            return null;
          }}
        />
        <RoundHeader title={headingOf(groups, revealed)} tag={`${unit} ${game.round + 1}/${game.rounds}`} hint={hint} />
        {panel}
      </Screen>
    </>
  );
}

// The bots and tests tell the screens apart by these.
function headingOf(groups, revealed) {
  if (groups) return revealed ? 'The Groups' : 'Sort the Board';
  return revealed ? 'Who Was Out' : 'Who’s Out?';
}

function Tag({ children }) {
  return (
    <span className="font-display text-[10px] font-bold uppercase tracking-wider text-fg-helper">{children}</span>
  );
}
