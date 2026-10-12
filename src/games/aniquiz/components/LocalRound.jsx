import { useState } from 'react';
import { useQuizRound } from '../hooks/useQuizRound';
import { currentClue, requiredIds, stillToAct, wagerLimit } from '../rules';
import Board from './Board';
import ClueCard from './ClueCard';
import AnswerEntry from './AnswerEntry';
import ClueReveal from './ClueReveal';
import Scoreboard from './Scoreboard';
import WagerEntry from './WagerEntry';
import QuizResults from './QuizResults';
import LocalClock from './LocalClock';
import { categoryFor, nextLabel, stakeLabelFor } from '../roundText';
import { Backdrop, Button, Card, Screen } from '../../../shared/ui';

// One device, passed round the table. The screen sequence is DERIVED from the
// game, never stored: whoever is next is `stillToAct(...)[0]`, and the only
// local state is `holding` — which player has confirmed the device is in their
// hands. A handoff screen shows whenever the next player is not the one holding
// it, so a submit hands the device on with no extra bookkeeping.
//
// The handoff is skipped when exactly one player is required (a solo game, a
// Daily Double): there is nobody to hand to and nothing to hide.
export default function LocalRound({ players, deal, settings, pack, onPlayAgain, onBack }) {
  const round = useQuizRound(players, deal, settings);
  const { game } = round;
  const ids = players.map((p) => p.id);
  const [holding, setHolding] = useState(null);

  const clue = currentClue(game, deal);
  const category = categoryFor(game, deal);
  const queue = stillToAct(game, ids);
  const current = queue[0] ?? null;
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? '';
  const shared = requiredIds(game, ids).length > 1;
  const needsHandoff = shared && current != null && holding !== current;
  const clueKey = `${game.round}:${game.cell ?? game.index}`;

  if (game.phase === 'finished') {
    return <QuizResults players={players} scores={game.scores} onPlayAgain={onPlayAgain} onBack={onBack} />;
  }

  const scoreboard = (
    <Scoreboard
      players={players}
      scores={game.scores}
      highlightId={game.phase === 'board' ? game.pickerId : current}
    />
  );

  const handoff = (what) => (
    <Card padding="lg" className="text-center">
      <div className="mb-3 text-5xl">📲</div>
      <p className="mb-1 text-base text-fg-body">Pass the device to</p>
      <p className="mb-2 font-display text-3xl font-extrabold text-white">{nameOf(current)}</p>
      <p className="mb-6 text-sm text-fg-subtle">{what}</p>
      <Button variant="primary" size="lg" fullWidth onClick={() => setHolding(current)}>
        I&apos;m {nameOf(current)} — ready
      </Button>
    </Card>
  );

  let body;
  if (game.phase === 'board') {
    body = (
      <>
        <h2 className="mb-4 text-center font-display text-2xl font-extrabold text-white">
          {players.length > 1 ? `${nameOf(game.pickerId)}, pick a clue` : 'Pick a clue'}
        </h2>
        <Board deal={deal} game={game} canPick onPick={round.pick} />
      </>
    );
  } else if (game.phase === 'wager') {
    const finalRound = game.round === 'final';
    body = (
      <>
        <div className="mb-6 text-center">
          <p className="font-display text-4xl font-extrabold text-pop-amber">
            {finalRound ? '🏁 Final round' : '💥 Daily Double!'}
          </p>
          {category && <p className="mt-2 text-lg text-fg-body">Category: <span className="font-bold text-white">{category}</span></p>}
        </div>
        {needsHandoff
          ? handoff('Your wager is private — nobody else should see it.')
          : current && (
            <Card padding="lg">
              <p className="mb-4 text-center font-display text-xl font-extrabold text-white">{nameOf(current)}, your wager</p>
              <WagerEntry
                key={`${clueKey}:${current}`}
                limit={wagerLimit(game, current)}
                onWager={(amount) => { round.wager(current, amount); setHolding(null); }}
              />
            </Card>
          )}
      </>
    );
  } else if (game.phase === 'answering') {
    body = (
      <>
        <ClueCard clue={clue} category={category} stakeLabel={stakeLabelFor(game, deal)} className="mb-6" />
        {needsHandoff
          ? handoff('Answers stay hidden until everyone is in.')
          : current && (
            <div key={`${clueKey}:${current}`}>
              {shared && (
                <p className="mb-3 text-center font-display text-xl font-extrabold text-white">{nameOf(current)}, your answer</p>
              )}
              {game.timed && (
                <LocalClock ms={game.answerMs} onExpire={() => { round.answer(current, ''); setHolding(null); }} />
              )}
              <AnswerEntry
                clue={clue}
                options={clue?.options}
                pack={pack}
                onSubmit={(text) => { round.answer(current, text); setHolding(null); }}
              />
            </div>
          )}
      </>
    );
  } else {
    body = (
      <>
        <ClueCard clue={clue} category={category} stakeLabel={stakeLabelFor(game, deal)} className="mb-6" />
        <ClueReveal clue={clue} players={players} answers={game.answers} required={requiredIds(game, ids)}>
          <Button variant="primary" size="lg" fullWidth onClick={round.next}>
            {nextLabel(game, deal)}
          </Button>
        </ClueReveal>
      </>
    );
  }

  return (
    <>
      <Backdrop />
      <Screen width={game.phase === 'board' ? 'lg' : 'md'}>
        {scoreboard}
        {body}
      </Screen>
    </>
  );
}
