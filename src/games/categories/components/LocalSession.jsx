import { useMemo } from 'react';
import { Backdrop, Banner, Screen } from '../../../shared/ui';
import { useCategoriesRound } from '../hooks/useCategoriesRound';
import { getCategory, suggestionsFor } from '../categories';
import { POOL_LABELS } from '../prefs';
import PickPhase from './PickPhase';
import TurnScreen from './TurnScreen';
import TurnEnd from './TurnEnd';
import RoundEnd from './RoundEnd';

/**
 * A whole local session on one device.
 *
 * TWO PRIVATE MOMENTS, AND ONLY TWO. When the table picks, each player in turn
 * looks away while the device shows everyone else the picker (PickPhase, the
 * AniGuess assignment shape). Then, all round, the hot seat's own clause sits
 * behind CategoryPeek — a control they are asked not to press — because the
 * judge has to rule from it. Everything else — the trail, the pending name, the
 * counts — is meant to be on the table, so the go changing hands is somebody
 * leaning over rather than a handover. That is the same trust AniGuess's
 * PeekPanel and AniFake's blind mode already ask a table for.
 *
 * ONE DEVICE ANSWERS FOR EVERYBODY, which is what `rulers` says: online that
 * prop is at most one player (me, when I owe an answer), and here it is
 * everyone who still owes one. TurnScreen needs no other knowledge of where it
 * is running.
 */
export default function LocalSession({
  players, rounds, proposalCap, categoryPool, categorySource, customCategories, onFinish, onQuit,
}) {
  const round = useCategoriesRound(players, {
    rounds, proposalCap, categoryPool, categorySource, customCategories,
  });
  const pool = POOL_LABELS[categoryPool] ?? POOL_LABELS.characters;
  const noun = pool.noun;
  const nameFor = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';

  const suggestions = useMemo(
    () => suggestionsFor(categoryPool, customCategories),
    [categoryPool, customCategories],
  );

  const body = () => {
    // Only a table pick reaches this phase; a random deal opens straight onto
    // a go. Who is being picked for is rules.pickingFor's answer, derived from
    // the picks so far rather than from a stored index.
    if (round.phase === 'picking') {
      const target = round.pickingFor;
      if (!target) return null;
      return (
        <PickPhase
          target={target}
          suggestions={suggestions}
          noun={noun}
          takenLabels={round.takenLabels}
          handover
          picked={players.filter((p) => round.hasPicked(p.id)).length}
          total={players.length}
          onPick={(spec) => round.pick(target.id, spec)}
        />
      );
    }

    if (round.phase === 'roundEnd') {
      return (
        <RoundEnd
          explain={round.explain}
          players={players}
          roundNumber={round.roundNumber}
          totalRounds={round.totalRounds}
          isFinalRound={round.isFinalRound}
          canAdvance
          onNext={round.nextRound}
          onFinish={() => onFinish(round.totalScores, round.log)}
          onBack={onQuit}
          backLabel="← Quit session"
        />
      );
    }

    if (round.phase === 'turnEnd') {
      const seatId = round.state.seatId;
      const result = round.state.results?.[seatId] ?? null;
      const row = round.explain.find((r) => r.playerId === seatId);
      return (
        <TurnEnd
          seatName={round.seat?.name ?? 'They'}
          order={round.order}
          trails={round.trails}
          seatId={seatId}
          usedFor={round.usedFor}
          // Resolved from the published spec, exactly as online does it, rather
          // than from the hook's own map — one source, one code path, and the
          // reveal gate applies identically in both.
          category={row?.category ? getCategory(row.category) : null}
          result={result}
          points={row?.turnPoints ?? 0}
          cap={round.cap}
          nameFor={nameFor}
          canAdvance
          // Everyone still to come is anyone with no result yet.
          isLastSeat={players.every((p) => p.id === seatId || round.state.results?.[p.id])}
          onNext={round.nextTurn}
        />
      );
    }

    return (
      <TurnScreen
        seatName={round.seat?.name ?? 'They'}
        roundNumber={round.roundNumber}
        totalRounds={round.totalRounds}
        noun={noun}
        phase={round.phase}
        pending={round.pending}
        // Every trail and the whole rotation: the seat moves after each name, so
        // a screen holding only the current one would hide what each player has
        // spent the round collecting the moment they hand the go on.
        trails={round.trails}
        order={round.order}
        lastPlayed={round.lastPlayed}
        cap={round.cap}
        left={round.left}
        usedFor={round.usedFor}
        // One device holds every slot, so it can both name and rule — and the
        // seat's clause goes behind a peek rather than being rendered plainly.
        category={round.seatCategory}
        peek
        canName
        // Everyone who still owes an answer, because this device is all of them.
        rulers={round.pendingJudges}
        pendingJudges={round.pendingJudges}
        nameFor={nameFor}
        onPropose={round.propose}
        onDeclare={round.declare}
        onRule={round.rule}
        onPass={round.pass}
      />
    );
  };

  // The round end is a whole screen of its own (the results frame), so it
  // renders outside this one rather than as a card inside it.
  if (round.phase === 'roundEnd') return body();

  return (
    <>
      <Backdrop />
      <Screen onBack={onQuit} backLabel="← Quit session">
        {!round.seat && (
          <Banner tone="warning" className="mb-6">
            Nobody left to take a turn.
          </Banner>
        )}
        {body()}
      </Screen>
    </>
  );
}
