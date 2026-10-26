import PlayerRow from '../../../shared/components/PlayerRow';
import RoundHeader from '../../../shared/components/RoundHeader';
import ResultImpact from '../../../shared/components/ResultImpact';
import { ChoiceEntry, TypedEntry } from '../../../shared/components/AnswerEntry';
import { Backdrop, Button, Card, Screen } from '../../../shared/ui';
import { CHOICE, budgetLeft, currentCard, pointsFor } from '../rules';
import PeekBoard from './PeekBoard';
import BidPanel from './BidPanel';
import HintCards from './HintCards';
import RevealCard from './RevealCard';

// One round, on any device — the screen local play and every phone in a room
// both draw. It holds no state of its own: the phase says what is on screen,
// and `canActAs(id)` says whether THIS device may move for that player
// (locally always — the device goes round the table and nothing in this game
// is private; online only for your own seat).
//
// Every handler takes the acting player's id first, which is how the local
// hook knows who moved; the online hook ignores it and acts as its own seat.
//
// The board sits straight under the heading on every phase, and the controls
// under it: a phone holds the portrait and the bid together without a scroll
// on most screens, and the portrait is what everyone is looking at.
export default function PeekRound({
  game, deal, players, departedIds = [], youId = null, canActAs, suggestions = [],
  onBid, onPass, onUncover, onHint, onNameNow, onAnswer, onSkip, onNext,
}) {
  const card = currentCard(game, deal);
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const who = (id) => (youId && id === youId ? 'You' : nameOf(id));
  const possessive = (id) => (youId && id === youId ? 'Your' : `${nameOf(id)}'s`);
  const { bid, phase, result } = game;
  const bidder = bid?.by ?? null;
  const left = budgetLeft(game);
  const roundKey = `${game.round}:${game.cardIndex}`;
  const lastRound = game.round + 1 >= game.rounds;

  let title;
  let hint;
  if (phase === 'bidding') {
    title = `${possessive(game.turnId)} Bid`;
    hint = bid ? `Lowest bid: ${who(bid.by)} — ${bid.n} tile${bid.n === 1 ? '' : 's'}.` : 'No bid yet.';
  } else if (phase === 'peeking') {
    title = `${possessive(bidder)} Peek`;
    hint = `${left} of ${bid.n} tile${bid.n === 1 ? '' : 's'} left to spend · worth ${pointsFor(bid.n)} points.`;
  } else if (phase === 'answering') {
    title = 'Name Them';
    hint = `${who(bidder)} bid ${bid.n} — worth ${pointsFor(bid.n)} points.`;
  } else {
    title = result?.void ? 'Round Void' : result?.correct ? 'Named!' : 'Missed!';
    hint = null;
  }

  const waiting = (text) => (
    <Card padding="lg" className="text-center">
      <p className="text-lg text-fg-body">{text}</p>
    </Card>
  );

  let panel;
  if (phase === 'bidding') {
    panel = canActAs(game.turnId) ? (
      <BidPanel
        key={`${roundKey}:${game.turnId}:${bid?.n ?? 'open'}`}
        heading={youId ? 'Your bid' : `${nameOf(game.turnId)}, your bid`}
        bid={bid}
        onBid={(n) => onBid(game.turnId, n)}
        onPass={() => onPass(game.turnId)}
      />
    ) : waiting(`Waiting for ${nameOf(game.turnId)} to bid…`);
  } else if (phase === 'peeking') {
    const mine = canActAs(bidder);
    panel = (
      <>
        <HintCards game={game} deal={deal} card={card} canBuy={mine} onBuy={(kind) => onHint(bidder, kind)} />
        {mine ? (
          <>
            <p className="mb-3 text-center text-sm text-fg-helper">
              Tap a tile to uncover it{deal.hintsOn ? ', or buy a hint card' : ''}. Name them whenever you&apos;re sure.
            </p>
            <Button variant="primary" size="lg" fullWidth onClick={() => onNameNow(bidder)}>
              Name them
            </Button>
          </>
        ) : waiting(`${nameOf(bidder)} is peeking…`)}
      </>
    );
  } else if (phase === 'answering') {
    const mine = canActAs(bidder);
    panel = (
      <>
        <HintCards game={game} deal={deal} card={card} canBuy={false} />
        {mine ? (
          <div key={roundKey}>
            {!youId && (
              <p className="mb-3 text-center font-display text-xl font-extrabold text-fg-strong">
                {nameOf(bidder)}, who is it?
              </p>
            )}
            {deal.answerStyle === CHOICE && card?.choices?.length ? (
              <ChoiceEntry options={card.choices} onSubmit={(text) => onAnswer(bidder, text)} />
            ) : (
              <TypedEntry
                suggestions={suggestions}
                placeholder="Type their name…"
                onSubmit={(text) => onAnswer(bidder, text)}
              />
            )}
          </div>
        ) : waiting(`${nameOf(bidder)} is naming them…`)}
      </>
    );
  } else {
    panel = (
      <>
        <HintCards game={game} deal={deal} card={card} canBuy={false} showAll />
        <RevealCard card={card} result={result} who={who}>
          <Button variant="primary" size="lg" fullWidth onClick={onNext}>
            {lastRound ? 'See results' : 'Next round'}
          </Button>
        </RevealCard>
      </>
    );
  }

  // Online, only this player's own answer lands on their phone (the sound rule
  // in .claude/rules/styling.md); locally the table's result is everyone's.
  const impact = phase === 'revealed' && result && !result.void && (!youId || result.by === youId)
    ? (result.correct ? 'correct' : 'wrong')
    : null;

  const canPick = phase === 'peeking' && canActAs(bidder) && left >= 1;
  const canSkip = ['bidding', 'peeking'].includes(phase) && game.uncovered.length === 0;

  return (
    <>
      <Backdrop />
      <ResultImpact result={impact} eventKey={impact ? roundKey : null} />
      <Screen width="md">
        <PlayerRow
          players={players}
          activeId={phase === 'bidding' ? game.turnId : bidder}
          youId={youId}
          dimIds={departedIds}
          label="Scores"
          score={(p) => String(game.scores?.[p.id] ?? 0)}
          status={(p) => {
            if (departedIds.includes(p.id)) return <Tag>left</Tag>;
            if (phase === 'bidding' && game.passed[p.id]) return <Tag>pass</Tag>;
            if (bid?.by === p.id && phase !== 'revealed') return <Tag>bid {bid.n}</Tag>;
            return null;
          }}
        />
        <RoundHeader title={title} tag={`Round ${game.round + 1}/${game.rounds}`} hint={hint} />
        <PeekBoard
          imageUrl={card?.imageUrl}
          name={card?.name ?? ''}
          uncovered={game.uncovered}
          revealAll={phase === 'revealed'}
          onPick={canPick ? (tile) => onUncover(bidder, tile) : null}
          onSkip={canSkip ? onSkip : null}
        />
        {panel}
      </Screen>
    </>
  );
}

function Tag({ children }) {
  return (
    <span className="font-display text-[10px] font-bold uppercase tracking-wider text-fg-helper">{children}</span>
  );
}
