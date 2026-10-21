import { useState } from 'react';
import { useAniTurfRoom } from './hooks/useAniTurfRoom';
import RoomSetup from '../../shared/components/RoomSetup';
import RoomShell from '../../shared/components/RoomShell';
import ResultImpact from '../../shared/components/ResultImpact';
import RoundHeader from '../../shared/components/RoundHeader';
import WaitingScreen from '../../shared/components/WaitingScreen';
import { countCharacters } from '../../shared/utils/profileStats';
import { useSoundCue } from '../../shared/hooks/useSoundCue';
import { Backdrop, Banner, Button, HubButton, Screen } from '../../shared/ui';
import OnlineLobby from './components/OnlineLobby';
import TeamStrip from './components/TeamStrip';
import TrapPlanting from './components/TrapPlanting';
import ClueTurn from './components/ClueTurn';
import GuessPanel from './components/GuessPanel';
import ClueLog from './components/ClueLog';
import TurfBoard from './components/TurfBoard';
import AniTurfResults from './components/AniTurfResults';
import { TEAM_STYLE } from './components/teamStyle';
import { TEAM_NAMES, trapsFor } from './rules';

// The online view-router: room.view picks lobby / play / results, and inside
// play the game's own phase picks the screen — and, for each phase, which of
// three seats this phone is in: the team on turn's clue-giver, one of its
// guessers, or watching.
export default function OnlineGame({ onBack, onExit }) {
  const room = useAniTurfRoom();
  const { game, myTeam, amGiver, key } = room;

  // The latest claim's landing. Each phone stamps ITS OWN team's results (the
  // arcade's sound rule) and hears the other team's as a plain reveal. Only
  // claims made after this phone arrived, so a refresh does not replay the
  // last one.
  // Adjusted while rendering (the arcade's pattern for derived-from-props
  // state), and cleared between games — the lobby has no game — so the next
  // game counts from its first claim.
  const [firstSeen, setFirstSeen] = useState(null);
  if (game && firstSeen == null) setFirstSeen(game.log.length);
  if (!game && firstSeen != null) setFirstSeen(null);
  const lastEvent = game?.log.at(-1);
  const fresh = game && firstSeen != null && game.log.length > firstSeen
    && ['claim', 'miss', 'trap'].includes(lastEvent?.kind);
  const eventKey = fresh ? `${game.round}:${game.log.length}` : null;
  const mine = fresh && lastEvent.team === myTeam;
  useSoundCue('reveal', fresh && !mine ? eventKey : null);
  // My go: my clue to give, or my team's board to play.
  useSoundCue('turn', game?.phase === 'clue' && amGiver && game.turn === myTeam
    ? `clue:${game.round}:${game.log.length}` : null);

  if (!room.roomCode) {
    return (
      <>
        <HubButton onClick={onExit} />
        <RoomSetup room={room} onBack={onBack} tone="plum" stat={(p) => `${countCharacters(p)} characters`} />
      </>
    );
  }

  const shell = (children, opts) => <RoomShell room={room} onExit={onExit} {...opts}>{children}</RoomShell>;

  if (!room.view) return shell(<WaitingScreen title="Loading room…" />);
  if (room.view === 'lobby') return shell(<OnlineLobby room={room} />, { codeInPage: true });

  if (room.view === 'results' && game?.winner) {
    return shell(
      <AniTurfResults
        game={game}
        players={room.seatedPlayers}
        totalScores={room.totalScores}
        departedIds={room.departedIds}
        onPlayAgain={room.returnToLobby}
        playAgainLabel="Back to lobby"
      />,
    );
  }

  if (room.view !== 'play' || !game) return shell(<WaitingScreen title="Loading…" />);

  const byId = new Map(room.players.map((p) => [p.id, p]));
  const giverOf = (team) => byId.get(game.clueGivers[team]);
  // A clue-giver sees their own key on every screen of the game — it is on
  // their own phone — and nobody else ever does.
  const keyView = amGiver && key ? { team: myTeam, footing: key.footing, traps: key.traps } : null;
  const impact = (
    <ResultImpact result={mine ? (lastEvent.kind === 'claim' ? 'correct' : 'wrong') : null} eventKey={mine ? eventKey : null} />
  );
  // The latest hand-over that cost a team its traps, shown until the next clue
  // — news for the turn it happens in, not a fixture for the rest of the game.
  const lastLoss = game.log.findLastIndex((e) => e.kind === 'migrate' && e.trapsLost);
  const lostNews = lastLoss >= 0 && !game.log.slice(lastLoss).some((e) => e.kind === 'clue')
    ? game.log[lastLoss] : null;

  if (game.phase === 'plant') {
    if (amGiver && !game.planted[myTeam]) {
      if (!key) return shell(<WaitingScreen title="Dealing your key…" />);
      return shell(
        <>
          <Backdrop />
          <Screen width="md">
            <TrapPlanting
              board={game.board}
              marks={game.marks}
              team={myTeam}
              footing={key.footing}
              count={trapsFor(game.traps, myTeam, game.startTeam)}
              onDone={room.plantTraps}
            />
          </Screen>
        </>,
      );
    }
    const still = ['red', 'blue'].filter((t) => !game.planted[t]).map((t) => giverOf(t)?.name).filter(Boolean);
    return shell(
      <WaitingScreen
        title="Reading the keys"
        subtitle={still.length ? `Waiting for ${still.join(' and ')}.` : 'Starting…'}
      />,
    );
  }

  const strip = <TeamStrip game={game} players={room.seatedPlayers} youId={room.myPlayerId} departedIds={room.departedIds} />;
  const banner = lostNews && (
    <Banner tone="info" className="mb-4">
      {byId.get(lostNews.from)?.name ?? 'A clue-giver'} left, so {byId.get(lostNews.to)?.name ?? 'a teammate'} now
      gives {TEAM_NAMES[lostNews.team]}&apos;s clues with a fresh key — the traps the old one planted went with them.
    </Banner>
  );

  if (game.phase === 'over') {
    const s = TEAM_STYLE[game.winner];
    return shell(
      <>
        <Backdrop />
        <Screen width="md">
          {impact}
          <RoundHeader
            title={`${s.name} wins`}
            tag="Game over"
            hint={game.winBy === 'cut' ? `${TEAM_NAMES[game.loser]} has no route left across the board.`
              : game.winBy === 'forfeit' ? `${TEAM_NAMES[game.loser]} has nobody left to guess.`
                : `${s.name} crossed the board ${s.goal}.`}
          />
          <TurfBoard board={game.board} marks={game.marks} keyView={keyView} />
          <Button variant="primary" size="lg" fullWidth onClick={room.finishGame}>See results</Button>
        </Screen>
      </>,
    );
  }

  if (game.phase === 'clue') {
    const mineToGive = amGiver && game.turn === myTeam;
    return shell(
      <>
        <Backdrop />
        <Screen width="md" className={mineToGive ? 'pb-48!' : ''}>
          {impact}
          {banner}
          {mineToGive ? (
            key ? (
              <ClueTurn game={game} team={myTeam} footing={key.footing} traps={key.traps} detour={key.detour} onClue={room.giveClue} />
            ) : <p role="status" className="mb-5 text-center text-lg text-fg-body">Dealing your key…</p>
          ) : (
            <>
              <RoundHeader
                title={`${TEAM_NAMES[game.turn]}'s Turn`}
                tag="Clue"
                hint={`Waiting for ${giverOf(game.turn)?.name ?? 'the clue-giver'} to give a clue.`}
              />
              <TurfBoard board={game.board} marks={game.marks} keyView={keyView} />
            </>
          )}
          {strip}
          <ClueLog game={game} players={room.players} />
        </Screen>
      </>,
    );
  }

  // Guessing.
  const canAct = game.turn === myTeam && !amGiver;
  return shell(
    <>
      <Backdrop />
      <Screen width="md" className="pb-36!">
        {impact}
        {banner}
        <GuessPanel
          key={`guess:${game.log.filter((e) => e.kind === 'clue').length}`}
          game={game}
          giverName={giverOf(game.turn)?.name}
          canAct={canAct}
          waiting={Boolean(game.pending)}
          keyView={keyView}
          onClaim={room.requestClaim}
          onStop={room.stop}
        >
          {strip}
          <ClueLog game={game} players={room.players} />
        </GuessPanel>
      </Screen>
    </>,
  );
}
