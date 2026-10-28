import PlayerRow from '../../../shared/components/PlayerRow';
import RoundHeader from '../../../shared/components/RoundHeader';
import ResultImpact from '../../../shared/components/ResultImpact';
import { Backdrop, Button, Card, Screen, TimerBar } from '../../../shared/ui';
import { answersFor, categoryText } from '../answers';
import { canJudge, currentCategory, missPoints, rightCount } from '../rules';
import AnswerList from './AnswerList';
import BidPanel from './BidPanel';
import NamingPanel from './NamingPanel';

// How many answers on record the reveal offers as "you could have said".
const SAMPLE = 12;

// One round, on any device — the screen local play and every phone in a room
// both draw. It holds no state of its own: the phase says what is on screen,
// and `canActAs(id)` says whether THIS device may move for that player
// (locally always — nothing in AniName is private, the device goes to whoever
// the heading names; online only for your own seat).
//
// `judgeAs` is who rules on pending answers from this device: online this
// phone's seat, locally any player but the namer (the table, in person).
//
// Every handler takes the acting player's id first; the online hook ignores it.
export default function NameRound({
  game, deal, players, index, clock, departedIds = [], youId = null, canActAs, judgeAs = null,
  onBid, onPass, onName, onDone, onJudge, onNext,
}) {
  const cat = currentCategory(game, deal);
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const who = (id) => (youId && id === youId ? 'You' : nameOf(id));
  const possessive = (id) => (youId && id === youId ? 'Your' : `${nameOf(id)}'s`);
  const { bid, phase, result } = game;
  const bidder = bid?.by ?? null;
  const roundKey = `${game.round}`;
  const lastRound = game.round + 1 >= game.rounds;
  const right = rightCount(game.answers);
  const ids = players.map((p) => p.id).filter((id) => !departedIds.includes(id));

  let title;
  let hint = null;
  if (phase === 'bidding') {
    title = `${possessive(game.turnId)} Bid`;
    hint = bid ? `Top bid: ${who(bid.by)} — ${bid.n}.` : 'No bid yet.';
  } else if (phase === 'naming') {
    title = `${possessive(bidder)} Turn`;
    hint = `${right} of ${bid.n} named.`;
  } else if (phase === 'review') {
    title = 'Table Decides';
    hint = `${right} of ${bid.n} right so far. Rule on the names the arcade doesn’t know.`;
  } else {
    title = result?.void ? 'Round Void' : result?.made ? 'Named Them!' : 'Fell Short';
  }

  const waiting = (text) => (
    <Card padding="lg" className="mb-4 text-center">
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
  } else if (phase === 'naming') {
    const mine = canActAs(bidder);
    panel = (
      <>
        {mine
          ? <NamingPanel key={roundKey} onName={(text) => onName(bidder, text)} onDone={() => onDone(bidder)} />
          : waiting(`${nameOf(bidder)} is naming…`)}
        <AnswerList answers={game.answers} />
      </>
    );
  } else if (phase === 'review') {
    const mayJudge = judgeAs != null && canJudge(game, judgeAs, ids);
    panel = (
      <>
        {!mayJudge && waiting(`The table is ruling on ${nameOf(bidder)}’s answers…`)}
        <AnswerList answers={game.answers} onJudge={mayJudge ? (i, accept) => onJudge(judgeAs, i, accept) : null} />
      </>
    );
  } else {
    panel = (
      <Reveal game={game} cat={cat} index={index} who={who}>
        <Button variant="primary" size="lg" fullWidth onClick={onNext}>
          {lastRound ? 'See results' : 'Next round'}
        </Button>
      </Reveal>
    );
  }

  // Online only the namer's phone lands the ✓/✗ (the sound rule in
  // .claude/rules/styling.md); locally the table's result is everyone's.
  const impact = phase === 'revealed' && result && !result.void && (!youId || result.by === youId)
    ? (result.made ? 'correct' : 'wrong')
    : null;

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
            if (phase === 'bidding' && game.passed[p.id]) return <Tag>out</Tag>;
            if (bid?.by === p.id && phase !== 'revealed') return <Tag>bid {bid.n}</Tag>;
            return null;
          }}
        />
        <RoundHeader title={title} tag={`Round ${game.round + 1}/${game.rounds}`} hint={hint}>
          {phase === 'naming' && clock && (
            <TimerBar secondsLeft={clock.secondsLeft} fraction={clock.fraction} label="Time to name" />
          )}
        </RoundHeader>
        <Card padding="lg" className="mb-5 text-center">
          <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-fg-helper">
            {bid && phase !== 'bidding' ? `Name ${bid.n}` : 'How many can you name?'}
          </p>
          <p className="font-display text-2xl font-bold uppercase leading-tight tracking-wide text-fg-strong [overflow-wrap:anywhere] sm:text-3xl">
            {cat ? categoryText(cat) : 'This round could not be loaded'}
          </p>
        </Card>
        {panel}
      </Screen>
    </>
  );
}

// What happened, the answers with their verdicts, and some of what the arcade
// had on record that nobody said — the "oh, of course" part of the round.
function Reveal({ game, cat, index, who, children }) {
  const { result } = game;
  const said = new Set(game.answers.filter((a) => a.verdict === 'right').map((a) => a.key));
  const known = cat && index ? [...answersFor(index, cat)].filter(([key]) => !said.has(key)) : [];
  let line;
  if (!result) line = null;
  else if (result.void) line = `${who(result.by)} left — no points this round.`;
  else if (result.made) line = `${who(result.by)} named ${result.n} for ${result.n} points.`;
  else line = `${who(result.by)} named ${result.count} of ${result.n} — everyone else +${missPoints(result.n)}.`;
  return (
    <>
      <Card padding="lg" className="mb-4 text-center">
        <p className="text-lg text-fg-body">{line}</p>
      </Card>
      <AnswerList answers={game.answers} />
      {known.length > 0 && (
        <section className="mb-5" aria-labelledby="aniname-known">
          <h3 id="aniname-known" className="mb-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-fg-helper">
            Also on record
          </h3>
          <p className="text-fg-body">
            {known.slice(0, SAMPLE).map(([, label]) => label).join(' · ')}
            {known.length > SAMPLE && ` · and ${known.length - SAMPLE} more`}
          </p>
        </section>
      )}
      {children}
    </>
  );
}

function Tag({ children }) {
  return (
    <span className="font-display text-[10px] font-bold uppercase tracking-wider text-fg-helper">{children}</span>
  );
}
