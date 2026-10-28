import { useState, useEffect, useRef } from 'react';
import { useRoom } from './hooks/useRoom';
import { useWins } from '../../shared/hooks/useWins';
import { isCorrectGuess } from './utils/guessMatch';
import { buildWhoIsWho } from './utils/whoIsWho';
import { roundComplete } from './rules';
import RoomSetup from '../../shared/components/RoomSetup';
import descriptor from './index';
import { countCharacters } from '../../shared/utils/profileStats';
import OnlineLobby from './components/OnlineLobby';
import OnlineCharacterAssignment from './components/OnlineCharacterAssignment';
import CharacterReveal from './components/CharacterReveal';
import OnlineGameScreen from './components/OnlineGameScreen';
import OnlineAnswererView from './components/OnlineAnswererView';
import CorrectGuessScreen from './components/CorrectGuessScreen';
import RoundEnd from './components/RoundEnd';
import Leaderboard from './components/Leaderboard';
import WaitingScreen from '../../shared/components/WaitingScreen';
import RoomShell from '../../shared/components/RoomShell';
import { useSoundCue } from '../../shared/hooks/useSoundCue';
import { HubButton } from '../../shared/ui';
import ResultImpact from '../../shared/components/ResultImpact';


export default function OnlineGame({ onBack, onExit }) {
  const room = useRoom();
  const { recordWin } = useWins();
  const [revealCharacter, setRevealCharacter] = useState(null);
  const [whoIsWho, setWhoIsWho] = useState([]);
  const [resolving, setResolving] = useState(false);

  // Fetch the character to reveal — only devices that AREN'T the assignee are
  // permitted to read it (enforced server-side by database.rules.json).
  useEffect(() => {
    if (room.view !== 'reveal' || room.isMyAssignmentTurn || !room.assignmentPlayer) {
      setRevealCharacter(null);
      return;
    }
    let cancelled = false;
    room.readAssignment(room.assignmentPlayer.id).then((c) => {
      if (!cancelled) setRevealCharacter(c);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.view, room.assignmentPlayer?.id, room.isMyAssignmentTurn]);

  // Every other player's character, fetched once when the round's game phase
  // starts. Remote players can't lean over and check a shared screen the way
  // local pass-and-play allows, and a round can run for many turns — so both
  // the pinned "whose turn it is" card and the Who-is-who recap read from here.
  // This device's own player is deliberately absent: database.rules.json denies
  // that read outright.
  // Assignments are fixed for the life of a round, so this doesn't need to
  // re-run per turn. gameSession gets a fresh object identity on every snapshot,
  // hence the player count rather than the array as a dep.
  useEffect(() => {
    if (room.view !== 'game' || !room.gameSession) {
      setWhoIsWho([]);
      return;
    }
    let cancelled = false;
    const players = room.gameSession.players;
    Promise.all(
      players
        .filter((p) => p.id !== room.myPlayerId)
        .map((p) => room.readAssignment(p.id).then((character) => [p.id, character]))
    ).then((pairs) => {
      if (cancelled) return;
      const byId = Object.fromEntries(pairs);
      // No lockedPositions: that only drives the local look-away gate, and this
      // list is rendered ungated.
      setWhoIsWho(buildWhoIsWho({
        players,
        characterFor: (id) => byId[id],
        excludePlayerId: room.myPlayerId,
      }));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.view, room.roundNumber, room.myPlayerId, room.gameSession?.players?.length]);

  // When it's my turn I'm excluded from the list, so this correctly stays
  // null — OnlineGameScreen must never receive its own player's character.
  const guesserCharacter = whoIsWho.find((e) => e.playerId === room.currentGuesser?.id)?.character ?? null;

  // Assignment progress counts the players still here, and "last" means nobody
  // active is left to assign — not merely the end of the original array.
  const assignmentNumber = Math.max(
    1, room.activePlayers.findIndex((p) => p.id === room.assignmentPlayer?.id) + 1
  );
  const isLastAssignment = !(room.gameSession?.players ?? [])
    .slice((room.assignmentIndex ?? 0) + 1)
    .some((p) => room.activeIds.includes(p.id));

  // Auto-resolve a pending GUESS — no human decision needed, any non-guesser
  // device races to claim it via the transaction-guarded resolvePendingAction;
  // only one instance actually proceeds.
  useEffect(() => {
    if (room.view !== 'game' || room.isMyTurn) return;
    const pending = room.pendingAction;
    if (!pending || pending.resolved || (pending.kind !== 'guess' && pending.kind !== 'giveup')) return;

    let cancelled = false;
    (async () => {
      // Once resolvePendingAction() reports we claimed it, that claim itself
      // is durable ownership — do NOT bail out on `cancelled` past this
      // point. The transaction's own successful write updates room.pendingAction
      // (resolved: true), which re-fires this effect and flips `cancelled`
      // via the cleanup below almost immediately; checking it after the
      // claim would abort our own follow-through before it finishes.
      if (cancelled) return;
      const claimed = await room.resolvePendingAction();
      if (!claimed) return;
      // Past this line we own a pendingAction that is already marked resolved,
      // so every exit path must clear it — otherwise the guesser's device waits
      // on an answer that can never arrive.
      try {
        const character = await room.readAssignment(pending.askedBy);
        if (pending.kind === 'giveup') {
          await room.clearPendingAction();
          await room.handleGiveUp(character);
          return;
        }
        if (!character) {
          await room.clearPendingAction();
          return;
        }
        const correct = isCorrectGuess(character, pending.text);
        const logEntry = { id: crypto.randomUUID(), type: 'guess', text: pending.text, correct };
        await room.clearPendingAction();
        if (correct) await room.handleCorrectGuess(logEntry, character);
        else await room.handleWrongGuess(logEntry, character);
      } catch {
        await room.clearPendingAction();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.view, room.isMyTurn, room.pendingAction]);

  // Game sounds, from state — each phone sounds for ITS OWN result only, so a
  // room of phones does not chime at once for one player's answer:
  //  - the yes/no to the question I asked as it lands, and my wrong guess as
  //    the impact frame (lastOutcome carries whose action it was; `at` makes
  //    each one new);
  //  - my turn coming round — keyed on my own turn count, which moves on once
  //    per turn I take, so each new go pings once;
  //  - a correct guess: CorrectGuessScreen's impact frame on the guesser's
  //    phone, the reveal sting on everyone else's, since the whole table is
  //    looking at that screen.
  const outcome = room.lastOutcome;
  const mine = outcome && outcome.playerId === room.myPlayerId;
  useSoundCue(
    mine && outcome.kind === 'question' ? (outcome.answer === 'Yes' ? 'yes' : 'no') : null,
    mine ? outcome.at : null,
  );
  const missImpact = (
    <ResultImpact result={mine && outcome.kind === 'guess' ? 'wrong' : null} eventKey={mine ? outcome.at : null} />
  );
  useSoundCue(
    'turn',
    room.view === 'game' && room.isMyTurn
      ? `${room.roundNumber}:${room.turnCounts?.[room.myPlayerId] ?? 0}`
      : null,
  );
  useSoundCue(
    room.lastLocked?.playerId === room.myPlayerId ? null : 'reveal',
    room.view === 'correctGuess' && room.lastLocked
      ? `${room.roundNumber}:${room.lastLocked.playerId}`
      : null,
  );

  // Unanimous approval: once every non-assignee has approved the current shared
  // proposal, lock it in (advance to reveal). Any present device can trigger the
  // write (it's idempotent); the ref guards each device to one trigger per
  // assignment so we don't spam identical writes.
  const lockedForRef = useRef(null);
  useEffect(() => {
    if (room.view !== 'assignment' || room.isMyAssignmentTurn || !room.gameSession) return;
    const prop = room.currentProposal;
    if (!prop?.character) return;
    // Count only the players still here. A departed player can never approve,
    // and their stale approval shouldn't stand in for someone who's present —
    // so both sides of this comparison are filtered to the active roster.
    const needed = room.activePlayers.filter((p) => p.id !== room.assignmentPlayer?.id).length;
    const approved = Object.entries(prop.approvals ?? {})
      .filter(([id, ok]) => ok && room.activeIds.includes(id)).length;
    const key = `${room.roundNumber}:${room.assignmentIndex}:${room.activeIds.join(',')}`;
    if (approved >= needed && lockedForRef.current !== key) {
      lockedForRef.current = key;
      room.lockInAssignment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.view, room.isMyAssignmentTurn, room.currentProposal, room.assignmentIndex, room.roundNumber, room.activeIds]);

  if (!room.roomCode) {
    // Not in a room yet, so leaving costs nothing — no confirm.
    return (
      <>
        <HubButton onClick={onExit} />
        <RoomSetup
          game={descriptor}
          room={room}
          onBack={onBack}
          tone="purple"
          stat={(p) => `${countCharacters(p)} characters`}
        />
      </>
    );
  }



  const handleAnswerQuestion = async (answer) => {
    setResolving(true);
    try {
      const claimed = await room.resolvePendingAction();
      if (claimed) {
        const logEntry = { id: crypto.randomUUID(), type: 'question', text: claimed.text, answer };
        // Read now, while this device is the one resolving: if this was the
        // last of the guesser's final chances, the lock shows who they were.
        const character = await room.readAssignment(claimed.askedBy).catch(() => null);
        await room.clearPendingAction();
        await room.handleTurnComplete(logEntry, character);
      }
    } finally {
      setResolving(false);
    }
  };

  // Every in-room screen goes through RoomShell: the way out, the room code and
  // Leave in the top bar, and the connection banners.
  // The miss frame rides in the shell, because the guesser's turn has already
  // moved on (to somebody else's) by the time their wrong guess lands.
  const shell = (children, opts) => (
    <RoomShell room={room} onExit={onExit} {...opts}>{children}{missImpact}</RoomShell>
  );

  if (!room.view) {
    return shell(<WaitingScreen title="Loading room…" />);
  }

  if (room.view === 'setup') {
    return shell(<OnlineLobby room={room} />, { codeInPage: true });
  }

  if (room.view === 'assignment') {
    if (room.isMyAssignmentTurn) {
      return shell(
        <WaitingScreen
          icon="eye-off"
          title="Look away!"
          subtitle="The other players are choosing your character together."
        />
      );
    }
    return shell(
      <OnlineCharacterAssignment
        guesser={room.assignmentPlayer}
        // The character pool comes from the players still here — "shared shows
        // only" shouldn't be narrowed by someone who has left.
        allPlayers={room.activePlayers}
        sharedShowsOnly={room.gameSession.settings.sharedShowsOnly}
        twoStepRandom={room.gameSession.settings.twoStepRandom}
        currentProposal={room.currentProposal}
        myPlayerId={room.myPlayerId}
        onPropose={room.proposeCharacter}
        onToggleApproval={room.setMyApproval}
        assignmentNumber={assignmentNumber}
        totalPlayers={room.activePlayers.length}
      />
    );
  }

  if (room.view === 'reveal') {
    if (room.isMyAssignmentTurn) {
      return shell(
        <WaitingScreen
          icon="eye-off"
          title="Still looking away!"
          subtitle="The other players are memorizing your character."
        />
      );
    }
    if (!revealCharacter) {
      return shell(<WaitingScreen title="Loading character…" />);
    }
    return shell(
      <CharacterReveal
        character={revealCharacter}
        guesserName={room.assignmentPlayer.name}
        onStartQuestioning={room.handleRevealDone}
        isLastPlayer={isLastAssignment}
        online
      />
    );
  }

  if (room.view === 'game') {
    if (room.isMyTurn) {
      return shell(
        <OnlineGameScreen
          guesser={room.currentGuesser}
          players={room.gameSession.players}
          whoIsWho={whoIsWho}
          lockedPositions={room.lockedPositions}
          questionLog={room.questionLogs[room.currentGuesser.id] || []}
          turnCount={room.turnCounts[room.currentGuesser.id] || 0}
          hasPeeked={room.hasPeeked}
          onPeek={room.handlePeek}
          onSubmitQuestion={(text) => room.submitPendingAction('question', text)}
          onSubmitGuess={(text) => room.submitPendingAction('guess', text)}
          pendingAction={room.pendingAction}
          lastOutcome={room.lastOutcome}
          sharedShowsOnly={room.gameSession.settings.sharedShowsOnly ?? true}
          turnsLeft={room.turnsLeft}
          onGiveUp={() => room.submitPendingAction('giveup', '')}
          timerSeconds={room.gameSession.settings.timerEnabled ? room.gameSession.settings.timerSeconds : 0}
          turnKey={`${room.roundNumber}:${room.turnCounts[room.currentGuesser.id] || 0}`}
          onTimeout={() => room.handleTurnComplete({ id: crypto.randomUUID(), type: 'timer', text: "Time's up!" })}
        />
      );
    }
    return shell(
      <OnlineAnswererView
        guesser={room.currentGuesser}
        guesserCharacter={guesserCharacter}
        whoIsWho={whoIsWho}
        questionLog={room.questionLogs[room.currentGuesser?.id] || []}
        turnCount={room.turnCounts[room.currentGuesser?.id] || 0}
        pendingAction={room.pendingAction}
        lastOutcome={room.lastOutcome}
        onAnswer={handleAnswerQuestion}
        resolving={resolving}
      />
    );
  }

  if (room.view === 'correctGuess' && room.lastLocked) {
    return shell(
      <CorrectGuessScreen
        lastLocked={room.lastLocked}
        lockedPositions={room.lockedPositions}
        mine={room.lastLocked.playerId === room.myPlayerId}
        onContinue={() => {
          // Everyone still here has been placed. Counting lockedPositions
          // against the full roster would hold the round open for a player who
          // left and will never be locked.
          if (roundComplete(room.lockedPositions, room.activePlayers)) {
            room.finishRound(room.lockedPositions);
          } else {
            room.setView('game');
          }
        }}
      />
    );
  }

  if (room.view === 'roundEnd') {
    return shell(
      <RoundEnd
        players={room.gameSession.players}
        lockedPositions={room.lockedPositions}
        roundNumber={room.roundNumber}
        rounds={room.gameSession.settings?.rounds ?? 0}
        totalScores={room.totalScores}
        departedIds={room.departedIds}
        isHost={room.isHost}
        hostName={room.hostName}
        onNewRound={room.handleNewRound}
        onEndSession={() => room.handleEndSession(recordWin)}
      />
    );
  }

  if (room.view === 'leaderboard') {
    return shell(
      <Leaderboard
        players={room.gameSession.players}
        totalScores={room.totalScores}
        roundNumber={room.roundNumber}
        roundHistory={room.roundHistory}
        departedIds={room.departedIds}
        onPlayAgain={() => { room.leaveRoom(); onBack(); }}
        onEditLists={() => { room.leaveRoom(); onBack(); }}
      />,
      // The final results: the host may take the table on to another game.
      { nextGame: true },
    );
  }

  return shell(<WaitingScreen title="Loading…" />);
}
