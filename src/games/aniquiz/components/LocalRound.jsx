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
import LocalClock from '../../../shared/components/LocalClock';
import { categoryFor, nextLabel, riskLine, stakeLabelFor } from '../roundText';
import { Backdrop, Button, Card, Screen } from '../../../shared/ui';
import Handoff from '../../../shared/components/Handoff';
import WagerBanner from './WagerBanner';

// One device, on the table. The screen sequence is DERIVED from the game, never
// stored: whoever is next is `stillToAct(...)[0]`, and the only local state is
// `holding` — which player has confirmed the device is in their hands.
//
// Every clue but the final belongs to one player (rules.js), and their answer
// is no secret — the table watches them give it — so those clues need no
// handoff: the screen names whose clue it is and they answer in front of
// everyone. Only the final, which everyone wagers on and answers privately,
// still passes the device, one player at a time.
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
  const table = players.length > 1;

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
    <Handoff
      player={players.find((p) => p.id === current)}
      note={what}
      cta={`I'm ${nameOf(current)} — ready`}
      onReady={() => setHolding(current)}
    />
  );

  let body;
  if (game.phase === 'board') {
    body = (
      <>
        <h2 className="mb-4 text-center font-display text-2xl font-bold uppercase tracking-wide text-fg-strong sm:text-3xl">
          {table ? `${nameOf(game.pickerId)}, pick a clue` : 'Pick a clue'}
        </h2>
        <Board deal={deal} game={game} canPick onPick={round.pick} />
      </>
    );
  } else if (game.phase === 'wager') {
    const finalRound = game.round === 'final';
    body = (
      <>
        <WagerBanner finalRound={finalRound} category={category} />
        {needsHandoff
          ? handoff('Your wager is private — nobody else should see it.')
          : current && (
            <Card padding="lg">
              <p className="mb-4 text-center font-display text-xl font-extrabold text-fg-strong">{nameOf(current)}, your wager</p>
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
    const risk = riskLine(game, deal);
    body = (
      <>
        <ClueCard clue={clue} category={category} stakeLabel={stakeLabelFor(game, deal)} className="mb-6" />
        {needsHandoff
          ? handoff('Answers stay hidden until everyone is in.')
          : current && (
            <div key={`${clueKey}:${current}`}>
              {table && (
                <p className="mb-1 text-center font-display text-xl font-extrabold text-fg-strong">{nameOf(current)}, your answer</p>
              )}
              {risk && <p className="mb-3 text-center text-sm text-fg-helper">{risk}</p>}
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
        <ClueReveal
          clue={clue}
          players={players}
          answers={game.answers}
          required={requiredIds(game, ids)}
          staged={game.round === 'final'}
        >
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
