import { useEffect, useRef, useState } from 'react';
import { Button, Icon } from '../../../shared/ui';
import ClipDeck from './ClipDeck';
import { MAX_LOAD_ATTEMPTS } from './ClipPlayer';

// The online clip player. Where ClipPlayer just plays a song on its one device,
// this coordinates every device onto the SAME moment at the SAME instant, which
// is what makes the buzz race fair:
//
//   1. Ready gate — browsers refuse to start audio without a user gesture, so a
//      player taps "ready". The tap unlocks the element (a muted play/pause
//      primes it for later programmatic playback) and reports readiness upward.
//      The element is the game's one shared <audio> (hooks/usePrimedAudio), so
//      that tap happens ONCE: on every later song a primed phone reports ready
//      by itself as soon as the clip has buffered. A phone whose later play() is
//      refused anyway goes back to asking (markPrimed(false)).
//   2. Shared seek — every device seeks to clipFraction × the playable range, so
//      they hear the identical musical moment.
//   3. Scheduled start — once the room stamps clipStartAt (a server-time ms), each
//      device schedules play at that instant, corrected by serverOffset. A short
//      countdown fills the lead time.
//
// A PHONE THAT CANNOT LOAD THE CLIP STILL REPORTS READY. The room starts once
// every active phone is ready, so a phone stuck in 'error' used to hold every
// other phone on "Waiting for everyone…" for good — and in everyone-guesses,
// where nothing else ends a song, nobody could get past it. Now it says ready on
// failing, the rest of the room hears the song, and that player answers from
// what the others are hearing.
//
// Like ClipPlayer, the music runs the whole window and on until the reveal;
// `windowSeconds` only fills the bar and fires onWindowEnded. The CDN quirks
// (503 stalls with no error event, no CORS) are handled the same way.
const STALL_TIMEOUT_MS = 9000;
const PROGRESS_STEP = 0.05;

// "Gavin" / "Gavin and Sam" / "Gavin, Sam and Liv".
function nameList(names) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export default function SyncedClipPlayer({
  src,
  windowSeconds = 20,
  // Mid-range, matching ClipPlayer's own default — only ever used by a question
  // that somehow arrived without a fraction.
  clipFraction = 0.45,
  playbackRate = 1,
  clipStartAt = null,
  serverOffset = 0,
  paused = false,
  revealed = false,
  shared = null,
  // Names of the players the room is still waiting on to be ready.
  waitingOn = [],
  onReady,
  onStarted,
  onWindowEnded,
  onUnplayable,
  onProgress,
}) {
  const audioRef = useRef(null);
  const offsetRef = useRef(0);
  const tickRef = useRef(null);
  const startTimerRef = useRef(null);
  const windowEndedRef = useRef(false);
  const reportedRef = useRef(-1);
  // 'loading' | 'gate' | 'armed' | 'playing' | 'done' | 'blocked' | 'error'
  const [state, setState] = useState('loading');
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [attempt, setAttempt] = useState(1);

  // Effects below are armed once per clip, so they'd capture stale callbacks.
  const readyRef = useRef(onReady); readyRef.current = onReady;
  const startedRef = useRef(onStarted); startedRef.current = onStarted;
  const endedRef = useRef(onWindowEnded); endedRef.current = onWindowEnded;
  const unplayableRef = useRef(onUnplayable); unplayableRef.current = onUnplayable;
  const progressRef = useRef(onProgress); progressRef.current = onProgress;

  // Load + seek. Mirrors ClipPlayer's stall-retry handling for the flaky CDN.
  useEffect(() => {
    const ownElement = !shared?.element;
    const audio = shared?.element ?? new Audio();
    if (ownElement) audio.preload = 'auto';
    audio.pause();
    audio.muted = false;
    audio.volume = 1;
    audio.src = src;
    audioRef.current = audio;
    windowEndedRef.current = false;
    reportedRef.current = -1;
    setState('loading');
    setElapsed(0);
    setAttempt(1);

    let cancelled = false;
    let tries = 1;
    let stallTimer = null;

    // Failing is still "ready" — see the note at the top.
    const fail = () => {
      setState('error');
      unplayableRef.current?.();
      readyRef.current?.();
    };

    const armStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (cancelled || audio.readyState > 0) return;
        if (tries < MAX_LOAD_ATTEMPTS) {
          tries += 1;
          setAttempt(tries);
          audio.src = `${src}${src.includes('?') ? '&' : '?'}r=${tries}`;
          audio.load();
          armStallTimer();
        } else {
          fail();
        }
      }, STALL_TIMEOUT_MS);
    };

    const onLoaded = () => {
      if (cancelled) return;
      clearTimeout(stallTimer);
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const latest = Math.max(0, duration - windowSeconds - 2);
      // Shared fraction, not Math.random(), so every device lands on the same spot.
      offsetRef.current = Math.min(latest, clipFraction * latest);
      audio.currentTime = offsetRef.current;
      // Already unlocked by an earlier song's tap: no gate, just say ready.
      if (shared?.primed) {
        setState('armed');
        readyRef.current?.();
      } else {
        setState('gate');
      }
    };

    const onError = () => {
      if (cancelled) return;
      clearTimeout(stallTimer);
      fail();
    };

    const onEnded = () => {
      if (cancelled) return;
      clearInterval(tickRef.current);
      setState('done');
      if (!windowEndedRef.current) { windowEndedRef.current = true; endedRef.current?.(); }
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);
    audio.load();
    armStallTimer();

    return () => {
      cancelled = true;
      clearTimeout(stallTimer);
      clearInterval(tickRef.current);
      clearTimeout(startTimerRef.current);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      if (ownElement) { audio.removeAttribute('src'); try { audio.load(); } catch { /* jsdom */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, windowSeconds, clipFraction]);

  // Every device applies the same rate, so a shared start instant still means a
  // shared musical position all the way through the clip.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, state]);

  // The Ready tap: a real user gesture, so prime the element for the later,
  // gesture-less programmatic play() and report readiness to the room.
  const handleReady = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = true;
    audio.play()
      .then(() => {
        audio.pause();
        audio.muted = false;
        audio.currentTime = offsetRef.current;
        shared?.markPrimed(true);
      })
      .catch(() => { audio.muted = false; });
    setState('armed');
    readyRef.current?.();
  };

  function startPlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    clearInterval(tickRef.current);
    audio.currentTime = offsetRef.current;
    audio.volume = 1;
    const startedAt = audio.currentTime;
    setElapsed(0);

    audio.play()
      .then(() => { shared?.markPrimed(true); setState('playing'); startedRef.current?.(); })
      // The unlock did not take (or never happened) — offer a button, and ask
      // for the tap again on the next song.
      .catch(() => { shared?.markPrimed(false); setState('blocked'); });

    tickRef.current = setInterval(() => {
      if (!audioRef.current) return;
      const played = audioRef.current.currentTime - startedAt;
      setElapsed(played);
      const heard = windowSeconds > 0 ? Math.min(1, played / windowSeconds) : 1;
      const step = Math.floor(heard / PROGRESS_STEP) * PROGRESS_STEP;
      if (step !== reportedRef.current) { reportedRef.current = step; progressRef.current?.(step); }
      if (played >= windowSeconds && !windowEndedRef.current) {
        windowEndedRef.current = true;
        endedRef.current?.();
      }
    }, 100);
  }

  // Schedule playback at the shared instant, once armed and the room has stamped
  // clipStartAt. Runs a 3-2-1 countdown over the lead time.
  useEffect(() => {
    if (state !== 'armed' || clipStartAt == null) return;
    const delay = clipStartAt - (Date.now() + serverOffset);
    if (delay <= 0) { startPlayback(); return; }

    setCountdown(Math.ceil(delay / 1000));
    const tick = setInterval(() => {
      const left = clipStartAt - (Date.now() + serverOffset);
      setCountdown(Math.max(0, Math.ceil(left / 1000)));
    }, 200);
    startTimerRef.current = setTimeout(() => { clearInterval(tick); startPlayback(); }, delay);
    return () => { clearInterval(tick); clearTimeout(startTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, clipStartAt, serverOffset]);

  // Race pauses the clip for everyone while a buzzed player answers, then resumes
  // it in place — progress is measured off currentTime, which simply stops
  // advancing while paused. Nothing pauses it once the answer is out.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || state !== 'playing') return;
    if (paused && !revealed) audio.pause();
    else audio.play().catch(() => {});
  }, [paused, revealed, state]);

  function replay() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = offsetRef.current;
    startPlayback();
  }

  const pct = Math.min(100, (elapsed / Math.max(windowSeconds, 1)) * 100);

  return (
    <ClipDeck pct={revealed ? 100 : pct} playing={state === 'playing'}>

      {state === 'loading' && (
        <p className="py-2 text-lg">
          Loading clip…{attempt > 1 ? ` (try ${attempt} of ${MAX_LOAD_ATTEMPTS})` : ''}
        </p>
      )}

      {state === 'error' && (
        <p className="py-2 text-lg">
          <Icon name="warning" /> This phone couldn&apos;t load the clip — listen to someone else&apos;s, you can still answer.
        </p>
      )}

      {state === 'gate' && (
        // Secondary (paper) rather than primary: an ink button on the ink deck
        // would be an outline in the dark.
        <Button variant="secondary" size="lg" fullWidth onClick={handleReady}>
          Tap when ready
        </Button>
      )}

      {state === 'armed' && (
        <p className="py-2 text-lg">
          {clipStartAt == null
            ? (waitingOn.length ? `Waiting on ${nameList(waitingOn)}…` : 'Waiting for everyone…')
            : `Get ready… ${countdown > 0 ? countdown : ''}`}
        </p>
      )}

      {state === 'playing' && !revealed && (
        <p className="py-2 font-display text-lg font-bold uppercase tracking-[0.3em]">Listen…</p>
      )}

      {state === 'blocked' && (
        <Button variant="neutral" size="lg" fullWidth onClick={replay}>
          Play clip
        </Button>
      )}

      {/* Revealed too: the song ran out before the answer did, and the room
          wants to hear it again with the title in front of them. */}
      {state === 'done' && (
        <Button variant="neutral" size="lg" fullWidth onClick={replay}>
          Replay clip
        </Button>
      )}
    </ClipDeck>
  );
}
