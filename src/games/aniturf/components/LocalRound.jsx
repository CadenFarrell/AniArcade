import { useState } from 'react';
import Handoff from '../../../shared/components/Handoff';
import ResultImpact from '../../../shared/components/ResultImpact';
import RoundHeader from '../../../shared/components/RoundHeader';
import { Backdrop, Button, Screen } from '../../../shared/ui';
import { useAniTurfRound } from '../hooks/useAniTurfRound';
import { TEAM_NAMES, other, trapsFor } from '../rules';
import ClueLog from './ClueLog';
import ClueTurn from './ClueTurn';
import GuessPanel from './GuessPanel';
import TeamStrip from './TeamStrip';
import TrapPlanting from './TrapPlanting';
import TurfBoard from './TurfBoard';
import { TEAM_STYLE } from './teamStyle';

// One game on one device. The only secrets are the two keys and the traps,
// and each is shown to exactly one person: a Handoff names the clue-giver, the
// key appears only after they say "show me", and it leaves the screen the
// moment they plant or give the clue. Guessing needs no handoff — the team on
// turn and the team watching may both see the board.
//
// `revealed` names the handoff that has been answered ("plant:red",
// "clue:3"), so the next one always starts closed: a key left open on one
// step can never carry over into the next.
export default function LocalRound({ setup, players, onFinish }) {
  const round = useAniTurfRound(setup);
  const { game, keys, planted, last } = round;
  const [revealed, setRevealed] = useState(null);
  const byId = new Map(players.map((p) => [p.id, p]));
  const giverOf = (team) => byId.get(game.clueGivers[team]);

  const handoff = (step, team, note) => (
    <Screen center>
      <Handoff
        key={step}
        player={giverOf(team)}
        note={note}
        cta={`I'm ${giverOf(team)?.name ?? 'the clue-giver'} — show me`}
        onReady={() => setRevealed(step)}
      />
    </Screen>
  );

  const body = () => {
    if (game.phase === 'plant') {
      const team = !game.planted[game.startTeam] ? game.startTeam : other(game.startTeam);
      const step = `plant:${team}`;
      if (revealed !== step) {
        return handoff(step, team, `${TEAM_NAMES[team]}'s clue-giver only — this is your team's secret key.`);
      }
      return (
        <Screen width="md">
          <TrapPlanting
            key={step}
            board={game.board}
            marks={game.marks}
            team={team}
            footing={keys[team]}
            count={trapsFor(game.traps, team, game.startTeam)}
            onDone={(cells) => { round.plantTraps(team, cells); setRevealed(null); }}
          />
        </Screen>
      );
    }

    if (game.phase === 'clue') {
      const team = game.turn;
      const step = `clue:${game.log.length}`;
      if (revealed !== step) {
        return handoff(step, team, `Everyone else, look away — ${TEAM_NAMES[team]}'s key is about to show.`);
      }
      return (
        <Screen width="md">
          <ClueTurn
            key={step}
            game={game}
            team={team}
            footing={keys[team]}
            traps={planted[team]}
            detour={round.detours[team]}
            onClue={(word, number) => { round.giveClue(word, number); setRevealed(null); }}
          />
        </Screen>
      );
    }

    if (game.phase === 'over') {
      const s = TEAM_STYLE[game.winner];
      return (
        <Screen width="md">
          <RoundHeader
            title={`${s.name} wins`}
            tag="Game over"
            hint={game.winBy === 'cut'
              ? `${TEAM_NAMES[game.loser]} has no route left across the board.`
              : `${s.name} crossed the board ${s.goal}.`}
          />
          <TurfBoard board={game.board} marks={game.marks} />
          <Button variant="primary" size="lg" fullWidth onClick={() => onFinish(game)}>See results</Button>
        </Screen>
      );
    }

    return (
      <Screen width="md" className="pb-36!">
        <GuessPanel
          key={`guess:${game.log.filter((e) => e.kind === 'clue').length}`}
          game={game}
          giverName={giverOf(game.turn)?.name}
          canAct
          onClaim={round.claim}
          onStop={round.stop}
        >
          <TeamStrip game={game} players={players} />
          <ClueLog game={game} players={players} />
        </GuessPanel>
      </Screen>
    );
  };

  // The impact frame sits at one fixed place in the tree on EVERY screen, so it
  // is one instance for the whole game: the claim that ends a turn is followed
  // straight away by the next handoff, and its ✗ must still land there — but a
  // fresh instance per screen would replay the last result each time a screen
  // changed.
  return (
    <>
      <Backdrop />
      {last && <ResultImpact result={last.outcome === 'claim' ? 'correct' : 'wrong'} eventKey={last.key} />}
      {body()}
    </>
  );
}
