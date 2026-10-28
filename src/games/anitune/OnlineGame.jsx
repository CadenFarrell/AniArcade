import { useEffect, useRef, useState } from 'react';
import { useAniTuneRoom } from './hooks/useAniTuneRoom';
import { isRace, hasLives, isEliminated, livePlayerIds } from './rules';
import RoomSetup from '../../shared/components/RoomSetup';
import descriptor from './index';
import { countShows } from '../../shared/utils/profileStats';
import { formatPoints } from '../../shared/utils/deadline';
import OnlineLobby from './components/OnlineLobby';
import SyncedClipPlayer from './components/SyncedClipPlayer';
import OnlineRaceRound from './components/OnlineRaceRound';
import OnlineSimultaneousRound from './components/OnlineSimultaneousRound';
import QuestionReveal from './components/QuestionReveal';
import AniTuneResults from './components/AniTuneResults';
import WaitingScreen from '../../shared/components/WaitingScreen';
import RoomShell from '../../shared/components/RoomShell';
import { Backdrop, Badge, GhostButton, HubButton, Icon, Screen, TimerBar } from '../../shared/ui';
import Lives from './components/Lives';
import { useSoundCue } from '../../shared/hooks/useSoundCue';
import PlayerRow from '../../shared/components/PlayerRow';
import RoundHeader from '../../shared/components/RoundHeader';

// The online view-router — the Firebase-backed counterpart to AniTuneRound's local
// orchestration. Modelled on src/games/aniguess/OnlineGame.jsx: a shell() wraps
// every in-room screen with the room code, a way out, and the sync-error banner,
// and room.view picks the screen. The AniTune-specific parts are the synchronized
// clip (the readiness → clipStartAt handshake below) and the two per-device modes.
export default function OnlineGame({ onBack, onExit }) {
  const room = useAniTuneRoom();

  // Local playback flags for the current question; reset when the question (or
  // the whole round) changes. clipStarted enables buzzing/guessing; clipDone
  // reveals the "nobody got it" escape.
  const [clipStarted, setClipStarted] = useState(false);
  const [clipDone, setClipDone] = useState(false);
  useEffect(() => {
    setClipStarted(false);
    setClipDone(false);
  }, [room.game?.index, room.view]);

  // Warm the next clip — metadata alone took ~2s in testing, which would
  // otherwise be dead air between questions. Delayed rather than immediate: the
  // CDN 503s under concurrent requests, and the clip playing right now must win
  // that race. AniTuneRound does the same locally; online it matters MORE, not
  // less, because every device pays the cold fetch and the room's ready gate
  // waits on the slowest one.
  const preloadRef = useRef(null);
  useEffect(() => {
    if (room.view !== 'round') return undefined;
    const next = room.round?.[(room.game?.index ?? -1) + 1];
    if (!next?.audioUrl) return undefined;
    const timer = setTimeout(() => {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = next.audioUrl;
      preloadRef.current = audio;
    }, 4000);
    return () => {
      clearTimeout(timer);
      if (preloadRef.current) { preloadRef.current.src = ''; preloadRef.current = null; }
    };
  }, [room.view, room.game?.index, room.round]);

  // Once every device has tapped "ready", one of them stamps the shared start
  // time (a transaction, so only the first stamp sticks). Ref-guarded to one
  // write per question per device.
  const clipStartWriterRef = useRef(null);
  useEffect(() => {
    if (room.view !== 'round') return;
    const g = room.game;
    if (!g || g.phase !== 'listening' || g.clipStartAt != null || !room.allReady) return;
    if (clipStartWriterRef.current === g.index) return;
    clipStartWriterRef.current = g.index;
    room.setClipStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.view, room.game, room.allReady]);

  // Race mode's two table events. Somebody else buzzing rings on every phone,
  // the way a quiz-show bell is heard by the whole studio — the buzzer's own
  // phone rang on the press already. Being locked out after a wrong answer is
  // a result of my own, so only my phone hears it.
  const g = room.view === 'round' ? room.game : null;
  useSoundCue('buzz', g?.buzzedBy && g.buzzedBy !== room.myPlayerId ? `${g.index}:${g.buzzedBy}` : null);
  useSoundCue('wrong', g?.lockedOut?.includes(room.myPlayerId) ? `${g.index}:out` : null);

  if (!room.roomCode) {
    return (
      <>
        <HubButton onClick={onExit} />
        <RoomSetup
          game={descriptor}
          room={room}
          onBack={onBack}
          tone="blue"
          stat={(p) => `${countShows(p)} shows`}
        />
      </>
    );
  }



  // Every in-room screen goes through RoomShell: the way out, the room code and
  // Leave in the top bar, and the connection banners.
  const shell = (children, opts) => <RoomShell room={room} onExit={onExit} {...opts}>{children}</RoomShell>;

  if (!room.view) {
    return shell(<WaitingScreen title="Loading room…" />);
  }

  if (room.view === 'lobby') {
    return shell(<OnlineLobby room={room} />, { codeInPage: true });
  }

  if (room.view === 'preparing') {
    const p = room.prepProgress;
    return shell(
      <>
        <Backdrop />
        <Screen center className="text-center">
          <div className="mb-5 text-7xl text-pop-blue"><Icon name="headphones" /></div>
          <h2 className="mb-3 font-display text-3xl font-extrabold text-fg-strong">
            {room.isPreparing ? 'Finding songs…' : 'Host is finding songs…'}
          </h2>
          {room.isPreparing && p ? (
            <div className="mx-auto w-full max-w-sm">
              <p className="mb-2 text-base text-fg-body">
                {p.phase === 'resolving' ? 'Matching shows…' : 'Loading themes…'} {p.done}/{p.total}
              </p>
              <div className="h-4 w-full overflow-hidden rounded-pop-sm border-2 border-ink bg-surface-2">
                <div
                  className="h-full bg-pop-blue transition-[width]"
                  style={{ width: `${(p.done / Math.max(p.total, 1)) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-lg text-fg-body">Hang tight — the round is being dealt.</p>
          )}
        </Screen>
      </>
    );
  }

  if (room.view === 'round' && room.game && room.round) {
    const { game, round } = room;
    const question = round[game.index];
    if (!question) return shell(<WaitingScreen title="Loading clip…" />);

    const revealed = game.phase === 'revealed';
    const race = isRace(game.mode);
    const lastManStanding = hasLives(game.mode);
    // Lives can end a round before its questions run out, so "is this the last
    // clip" is not just an index comparison: one survivor means it is.
    const survivors = livePlayerIds(game, room.activeIds);
    const isLast = game.index + 1 >= round.length
      || (lastManStanding && room.players.length > 1 && survivors.length <= 1);
    const clipSeconds = room.settings?.clipSeconds ?? 10;
    const ranked = [...room.players].sort(
      (a, b) => (game.scores[b.id] || 0) - (game.scores[a.id] || 0)
    );

    return shell(
      <>
        <Backdrop />
        <Screen width="md">
          {/* The live leaderboard as the row of faces. The buzzer is framed under
              NOW; departed players keep their frozen score with their face
              dimmed, so the room can still see how the match stood when they
              went, and so do players Lives has knocked out. */}
          <PlayerRow
            players={ranked}
            activeId={game.buzzedBy ?? null}
            youId={room.myPlayerId}
            label="Scores"
            dimIds={ranked
              .filter((p) => room.departedIds.includes(p.id) || (lastManStanding && isEliminated(game, p.id)))
              .map((p) => p.id)}
            score={(p) => formatPoints(game.scores[p.id] || 0)}
            status={(p) => (room.departedIds.includes(p.id)
              ? <span className="font-display text-[10px] font-bold uppercase tracking-wider text-fg-helper">left</span>
              : lastManStanding
                ? <Lives count={isEliminated(game, p.id) ? 0 : game.lives?.[p.id]} className="text-pop-red" />
                : null)}
          />

          <RoundHeader
            title={race ? 'Buzz in' : lastManStanding ? 'Last one standing' : 'Everyone guesses'}
            tag={`Song ${game.index + 1}/${round.length}`}
          />

          <SyncedClipPlayer
            key={question.id}
            src={question.audioUrl}
            seconds={clipSeconds}
            clipFraction={question.clipFraction ?? 0.45}
            playbackRate={room.settings?.playbackRate ?? 1}
            clipStartAt={game.clipStartAt}
            serverOffset={room.serverOffset}
            paused={game.phase === 'buzzed'}
            revealed={revealed}
            onReady={room.markReady}
            onStarted={() => setClipStarted(true)}
            onWindowEnded={() => setClipDone(true)}
            onUnplayable={() => setClipDone(true)}
          />

          {/* Driven by the room's shared deadlineAt, corrected per device, so
              nobody's bar runs ahead of the clock their speed is scored on. The
              window is opened by the hook when clipStartAt lands, not here. */}
          {!revealed && game.deadlineAt != null && (
            <TimerBar
              className="mt-4"
              secondsLeft={room.clock.secondsLeft}
              fraction={room.clock.fraction}
              label={game.phase === 'buzzed' ? 'Time to answer' : 'Time to guess'}
            />
          )}

          {!revealed && race && (
            <OnlineRaceRound
              players={room.activePlayers}
              questions={round}
              question={question}
              game={game}
              myPlayerId={room.myPlayerId}
              isMyBuzz={room.isMyBuzz}
              clipStarted={clipStarted}
              clipDone={clipDone}
              onBuzz={room.buzz}
              onAnswer={(guess) => room.resolveBuzz(question, guess)}
              onGiveUp={room.giveUp}
            />
          )}

          {!revealed && !race && (
            <OnlineSimultaneousRound
              players={room.activePlayers}
              questions={round}
              question={question}
              game={game}
              myPlayerId={room.myPlayerId}
              iHaveAnswered={room.iHaveAnswered}
              iAmOut={room.iAmOut}
              lives={lastManStanding ? game.lives : null}
              eliminated={game.eliminated}
              clipStarted={clipStarted}
              onSubmit={(text) => room.submitAnswer(question, text)}
              onReveal={room.revealNow}
            />
          )}

          {revealed && (
            <QuestionReveal
              question={question}
              mode={game.mode}
              players={room.players}
              answers={game.answers}
              windowMs={game.windowMs}
              lives={lastManStanding ? game.lives : null}
              myId={room.myPlayerId}
              onNext={room.advance}
              nextLabel={isLast ? 'See results →' : 'Next question →'}
            />
          )}
        </Screen>
      </>
    );
  }

  if (room.view === 'results' && room.game) {
    return shell(
      <AniTuneResults
        players={room.players}
        scores={room.game.scores}
        mode={room.game.mode}
        lives={room.game.lives}
        eliminated={room.game.eliminated}
        round={room.round ?? []}
        // game.index is the last question the room actually reached, which in
        // Lives is short of the round it was dealt.
        playedCount={(room.game.index ?? 0) + 1}
        departedIds={room.departedIds}
        roundSize={room.round?.length ?? Object.keys(room.game.scores).length}
        onPlayAgain={room.returnToLobby}
      />,
      // The final results: the host may take the table on to another game.
      { nextGame: true },
    );
  }

  return shell(<WaitingScreen title="Loading…" />);
}
