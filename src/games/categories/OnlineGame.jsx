import { useCategoriesRoom } from './hooks/useCategoriesRoom';
import { useCustomCategories } from './hooks/useCustomCategories';
import RoomSetup from '../../shared/components/RoomSetup';
import OnlineLobby from './components/OnlineLobby';
import PickPhase from './components/PickPhase';
import TurnScreen from './components/TurnScreen';
import TurnEnd from './components/TurnEnd';
import RoundEnd from './components/RoundEnd';
import AniTagResults from './components/AniTagResults';
import WaitingScreen from '../../shared/components/WaitingScreen';
import RoomShell from '../../shared/components/RoomShell';
import { useSoundCue } from '../../shared/hooks/useSoundCue';
import { HubButton, Screen } from '../../shared/ui';
import { POOL_LABELS } from './prefs';
import { verdictsOf } from './rules';
import { getCategory, suggestionsFor } from './categories';

// The online view-router. Same shape as src/games/wavelength/OnlineGame.jsx: a
// shell() wraps every in-room screen with the room code, a way out and the
// sync-error banner, and room.view picks the screen.
export default function OnlineGame({ onBack, onExit }) {
  const room = useCategoriesRoom();
  // This device's own written categories, offered at the top of the picker in
  // chosen mode. Read here rather than out of the room for the reason the hook
  // gives: a player's list never enters room state, so only the clause they
  // actually pick is ever published.
  const { categories: myCustom } = useCustomCategories();

  // Sounds from the room, each on the phone it belongs to. Every settled name
  // adds one entry to some trail, so the running count names each moment:
  //  - the verdicts on a name I put forward (any yes reads as a yes — it is a
  //    lead; all no is a no), or my missed call, as they land;
  //  - the seat coming round to me, once per go.
  const playing = room.view === 'round' && room.game;
  const settled = playing
    ? Object.values(room.trails ?? {}).reduce((n, t) => n + (t?.length ?? 0), 0)
    : 0;
  const last = playing ? room.lastPlayed : null;
  const lastMine = last && last.playerId === room.myPlayerId;
  const lastSound = !lastMine ? null
    : last.kind === 'declaration' ? 'wrong'
      : verdictsOf(last).some((v) => v.verdict) ? 'yes' : 'no';
  useSoundCue(lastSound, lastMine ? `${room.roundNumber}:${settled}` : null);
  useSoundCue(
    'turn',
    playing && room.game.phase !== 'turnEnd' && room.game.phase !== 'roundEnd' && room.iAmSeat
      ? `${room.roundNumber}:${settled}`
      : null,
  );

  if (!room.roomCode) {
    return (
      <>
        <HubButton onClick={onExit} />
        {/* No `stat`, and unlike AniWave's this is unconditional rather than a
            judgement call about which mode the host might pick: nothing in this
            game reads an anime list, so any number about one shown here would
            read as a requirement that does not exist. */}
        <RoomSetup room={room} onBack={onBack} tone="lime" />
      </>
    );
  }



  // Leaving from inside a round's own screens leaves the room too, exactly as
  // the bar's Hub does (RoomShell owns that one).
  const handleExitToHub = () => {
    room.leaveRoom();
    onExit();
  };

  // Every in-room screen goes through RoomShell: the way out, the room code and
  // Leave in the top bar, and the connection banners.
  const shell = (children, opts) => <RoomShell room={room} onExit={onExit} {...opts}>{children}</RoomShell>;

  if (!room.view) return shell(<WaitingScreen title="Loading room…" />);
  if (room.view === 'lobby') return shell(<OnlineLobby room={room} />, { codeInPage: true });

  if (room.view === 'round' && room.game) {
    const { game } = room;
    const noun = (POOL_LABELS[room.settings?.categoryPool] ?? POOL_LABELS.characters).noun;
    const seatName = room.seat?.name ?? 'Someone';
    const nameFor = (id) => room.players.find((p) => p.id === id)?.name ?? 'Someone';

    // CHOSEN MODE opens here: nobody can name anything until everyone still in
    // the room has committed a clause. This device picks its own and nothing
    // else — there is no dealer in this mode — and then waits, by name.
    if (game.phase === 'picking') {
      return shell(
        <Screen>
          <PickPhase
            playerName={room.myName}
            suggestions={suggestionsFor(
              room.settings?.categoryPool,
              room.settings?.useCustom === false ? [] : myCustom,
            )}
            noun={noun}
            done={room.iHavePicked}
            waitingOn={room.pendingPickers}
            picked={room.activeIds.length - room.pendingPickers.length}
            total={room.activeIds.length}
            onPick={room.pickCategory}
          />
        </Screen>
      );
    }

    if (game.phase === 'roundEnd') {
      return shell(
        <RoundEnd
          explain={room.explain}
          players={room.players}
          roundNumber={room.roundNumber}
          totalRounds={room.totalRounds}
          isFinalRound={room.isFinalRound}
          chosen={room.chosen}
          // Only the host advances the room. Everyone else reads the same
          // screen with the buttons replaced by a line saying who they are
          // waiting on — rendered here rather than inside RoundEnd so that
          // screen stays the same dumb component local play uses.
          canAdvance={room.isHost}
          hostName={room.hostName}
          onNext={room.nextRound}
          onFinish={room.finish}
        />
      );
    }

    if (game.phase === 'turnEnd') {
      const seatId = game.seatId;
      const row = room.explain.find((r) => r.playerId === seatId);
      // CHOSEN: what may be shown is the TARGET's clause, and only once the
      // seat claimed them — rules.revealAllowed is what decides, and its owner
      // is the only device that can publish it. DEALT: the seat's own, which
      // any other device publishes onto the result.
      const targetRow = room.chosen && row?.targetId
        ? room.explain.find((r) => r.playerId === row.targetId)
        : null;
      const shown = room.chosen ? targetRow?.category : row?.category;
      return shell(
        <Screen>
          <TurnEnd
            seatName={seatName}
            isYou={room.iAmSeat}
            chosen={room.chosen}
            targetName={row?.targetId ? nameFor(row.targetId) : null}
            order={room.order}
            trails={room.trails}
            seatId={seatId}
            myPlayerId={room.myPlayerId}
            usedFor={room.usedFor}
            // From the published value, never from this device's own read:
            // whichever mode is running, exactly one device is denied the
            // clause and the published copy is the only source that works on
            // all of them. Null for a beat while that device publishes it.
            // Resolved through getCategory because what is stored is a SPEC: a
            // built-in's id or a written category's whole definition.
            category={shown ? getCategory(shown) : null}
            result={game.results?.[seatId] ?? null}
            points={row?.points ?? 0}
            cap={room.cap}
            nameFor={nameFor}
            // Any device may move the seat on. The turn is over and its result
            // is written, so there is nothing left for one device to own — and
            // making it host-only would stall the room every time the host is
            // the person whose turn just ended and who is still reading it.
            canAdvance
            isLastSeat={room.activeIds.every((id) => id === seatId || game.results?.[id])}
            onNext={room.nextTurn}
          />
        </Screen>
      );
    }

    // DEALT ONLY: everyone but the hot seat is waiting on the deal to land in
    // assignments/. The seat needs nothing, so they never see this — and in
    // chosen mode nobody does, because there is no deal and the `picking` phase
    // above is the gate instead.
    if (!room.dealReady) {
      return shell(<WaitingScreen title="Dealing the categories…" />);
    }

    return shell(
      <Screen>
        <TurnScreen
          seatName={seatName}
          roundNumber={room.roundNumber}
          totalRounds={room.totalRounds}
          noun={noun}
          phase={game.phase}
          pending={room.pending}
          // Every trail and the whole rotation — see LocalSession for why one
          // trail stopped being enough the moment the seat started moving.
          trails={room.trails}
          order={room.order}
          lastPlayed={room.lastPlayed}
          cap={room.cap}
          left={room.left}
          usedFor={room.usedFor}
          myPlayerId={room.myPlayerId}
          chosen={room.chosen}
          // DEALT: null on the hot seat's own device — by a Firebase rule
          // rather than by this line — and the resolved clause on every other.
          // CHOSEN: the mirror, null on every device but its owner's. No peek
          // in either: online, the device that must not show a clause does not
          // have it, so there is nothing to hide behind a control.
          category={room.seatCategory}
          myCategory={room.myCategory}
          canName={room.iAmSeat}
          // At most one, and only while this device actually owes an answer.
          // Locally the same prop carries the whole table — see LocalSession.
          rulers={room.iMustRule ? [{ id: room.myPlayerId, name: room.myName }] : []}
          pendingJudges={room.pendingJudges}
          declarable={room.declarable}
          nameFor={nameFor}
          onPropose={room.propose}
          onDeclare={room.declare}
          // The judge id is this device's by construction, so it is thrown
          // away here — room.rule reads myPlayerId itself.
          onRule={(_judgeId, verdict) => room.rule(verdict)}
          onPass={room.pass}
          // The wedge presence cannot see: a hot seat who is connected and
          // simply not naming anything. usePresence notices a device that
          // DISCONNECTS and has nothing to say about one that is connected and
          // idle, so an untimed round would wait forever. It sits on the HOST
          // because the case it covers is the seat having stopped responding —
          // and unlike AniWave's reveal it needs no secret, so the host can hold
          // it. The seat's own "give up" is the same escape from their side.
          //
          // Passed INTO the screen rather than rendered under it, so it inherits
          // the width instead of re-declaring max-w-md, and so it reads as the
          // escape hatch it is rather than as part of the turn controls.
          onAbandon={room.isHost && !room.iAmSeat ? () => {
            if (!window.confirm(
              `End ${seatName}'s round? It scores nothing and everyone keeps the points they have.`,
            )) return;
            room.abandonTurn();
          } : null}
        />
      </Screen>
    );
  }

  if (room.view === 'results') {
    return shell(
      <AniTagResults
        players={room.players}
        totalScores={room.totalScores}
        onPlayAgain={room.isHost ? room.returnToLobby : null}
        playAgainLabel="Back to lobby"
        onBack={handleExitToHub}
        backLabel="Leave the room"
      />
    );
  }

  return shell(<WaitingScreen title="Loading…" />);
}
