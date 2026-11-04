import { useEffect, useRef, useState } from 'react';
import { Button, Icon } from '../../../shared/ui';
import ClipDeck from './ClipDeck';

// Plays a song from the dealt offset until the answer is out.
//
// Constraints this is written around, all measured against a.animethemes.moe:
//   - Plain <audio src> works and Range seeking works.
//   - The CDN sends no Access-Control-Allow-Origin on the actual response, so
//     Web Audio is unavailable: no AudioContext, no MediaElementSource, no
//     decodeAudioData, and crossOrigin="anonymous" fails outright with
//     MEDIA_ERR_SRC_NOT_SUPPORTED. Volume goes through el.volume, not a gain
//     node, and there is no waveform.
//   - Metadata took ~2s on a 3.6MB file, so the parent preloads the next clip.
//   - The CDN 503s a lot: 10 of 15 requests during one playthrough. Chrome's
//     media stack retries transparently and usually wins, but a run of them
//     leaves the element stalled at readyState 0 with no `error` event ever
//     firing — so a plain load can hang forever. Hence the stall timeout.
//
// THE CLIP RUNS THE WHOLE WINDOW. It used to play a fixed "clip length" (10s by
// default) and stop, while the guess clock ran 20s — ten seconds of silence on
// every timed song, at the moment the table most wanted to hear it again. Now
// the music keeps going until the answer is revealed (or the song ends), and
// `windowSeconds` is only where the window's progress bar fills and when
// onWindowEnded fires: the cue for "Nobody got it" in an untimed round, which
// has no clock to end it. Measured in seconds OF SONG (currentTime), so a race
// clip paused for a buzz picks up exactly where it left off, and 1.5× speed is a
// difficulty knob rather than secretly also a length one.
const STALL_TIMEOUT_MS = 9000;
export const MAX_LOAD_ATTEMPTS = 3;
// Progress is reported to the parent in steps this size, not every 100ms tick —
// the parent is the whole round screen, and the hints it gates only change at
// two points.
const PROGRESS_STEP = 0.05;

export default function ClipPlayer({
  src,
  windowSeconds = 20,
  // Where in the playable range to start, 0..1. Dealt with the question by
  // pickRound, so a remount (or a resumed game) lands on the same moment, and
  // both clip players map fraction to seconds identically.
  fraction = 0.4,
  playbackRate = 1,
  autoPlay = true,
  revealed = false,
  paused = false,
  // The game's one primed <audio> (hooks/usePrimedAudio). Without it a fresh
  // element is made, which is what a component test gets.
  shared = null,
  onPlaybackError,
  onStarted,
  onWindowEnded,
  onUnplayable,
  // fraction of the window heard, in PROGRESS_STEP steps (for SongHints).
  onProgress,
  // Shown with the "couldn't play" message: reveal the song and move on.
  onSkip,
}) {
  const audioRef = useRef(null);
  const tickRef = useRef(null);
  const offsetRef = useRef(0);
  const windowEndedRef = useRef(false);
  const [state, setState] = useState('loading'); // loading | ready | playing | done | error
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(1);

  // The load and playback effects below are set up once per clip, so they would
  // capture stale callbacks from the render that started them.
  const endedRef = useRef(onWindowEnded);
  endedRef.current = onWindowEnded;
  const unplayableRef = useRef(onUnplayable);
  unplayableRef.current = onUnplayable;
  const startedRef = useRef(onStarted);
  startedRef.current = onStarted;
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  const reportedRef = useRef(-1);

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

    // A 503 leaves the element silently stalled, so treat "no metadata yet" as
    // a failure and reload rather than waiting on an error that never comes.
    const armStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (cancelled || audio.readyState > 0) return;
        if (tries < MAX_LOAD_ATTEMPTS) {
          tries += 1;
          setAttempt(tries);
          // Cache-bust so the retry is not served the same failed response.
          audio.src = `${src}${src.includes('?') ? '&' : '?'}r=${tries}`;
          audio.load();
          armStallTimer();
        } else {
          setState('error');
          onPlaybackError?.(new Error('Clip stalled (CDN unavailable)'));
          unplayableRef.current?.();
        }
      }, STALL_TIMEOUT_MS);
    };

    const onLoaded = () => {
      if (cancelled) return;
      clearTimeout(stallTimer);
      // Leave room at the end for the whole window plus the outro, then take the
      // dealt fraction of what's left. Same mapping SyncedClipPlayer uses, so a
      // question sounds the same locally and online.
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const latest = Math.max(0, duration - windowSeconds - 2);
      offsetRef.current = Math.min(latest, fraction * latest);
      audio.currentTime = offsetRef.current;
      setState('ready');
      if (autoPlay) startPlayback(audio);
    };

    const onError = () => {
      if (cancelled) return;
      clearTimeout(stallTimer);
      setState('error');
      onPlaybackError?.(audio.error);
      unplayableRef.current?.();
    };

    // The song itself ran out — the only place the music stops on its own now.
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
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      // A throwaway element is emptied; the shared one is left for the next
      // song's src, since emptying it here would be a second load for nothing.
      if (ownElement) { audio.removeAttribute('src'); try { audio.load(); } catch { /* jsdom */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, windowSeconds, fraction]);

  // Applied on its own rather than at play() time so a rate change mid-clip
  // takes effect immediately. playbackRate survives pause/resume and seeking, so
  // there is nothing to re-apply afterwards.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, state]);

  // Race mode holds the clip while a buzzed player answers, then resumes it for
  // everyone still in. No timer bookkeeping is needed: progress is measured off
  // audio.currentTime, which simply stops advancing while paused. Once the answer
  // is out nothing pauses it — the table hears the rest of the song.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || state !== 'playing') return;
    if (paused && !revealed) audio.pause();
    else audio.play().catch(() => {});
  }, [paused, revealed, state]);

  function startPlayback(audio = audioRef.current) {
    if (!audio) return;
    clearInterval(tickRef.current);
    audio.volume = 1;
    const startedAt = audio.currentTime;
    setElapsed(0);

    // The guess window opens here rather than on mount: play() resolving is the
    // first moment anyone can actually hear anything, and a clock started while
    // the CDN was still stalling would be scoring the connection.
    audio.play().then(() => {
      shared?.markPrimed(true);
      setState('playing');
      startedRef.current?.();
    }).catch((err) => {
      // Autoplay without a gesture is refused by every browser; fall back to
      // showing the button rather than looking broken. Whatever we thought,
      // this element is not unlocked.
      shared?.markPrimed(false);
      setState('ready');
      onPlaybackError?.(err);
    });

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

  function replay() {
    const audio = audioRef.current;
    if (!audio) return;
    // Back to the dealt offset — the offset is a property of the question, so
    // there is an exact place to return to.
    audio.currentTime = offsetRef.current;
    startPlayback(audio);
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
        <div className="py-2">
          <p className="text-lg"><Icon name="warning" /> Couldn&apos;t play this clip.</p>
          {/* Secondary (paper) rather than a ghost link: on the ink deck a
              ghost's body-ink text would vanish, as the online gate's note says. */}
          {onSkip && !revealed && (
            <Button variant="secondary" size="lg" fullWidth className="mt-3" onClick={onSkip}>
              Skip this song
            </Button>
          )}
        </div>
      )}

      {state === 'playing' && !revealed && (
        <p className="py-2 font-display text-lg font-bold uppercase tracking-[0.3em]">Listen…</p>
      )}

      {(state === 'ready' || state === 'done') && (
        <Button variant="neutral" size="lg" fullWidth onClick={replay}>
          {state === 'done' ? 'Replay clip' : 'Play clip'}
        </Button>
      )}
    </ClipDeck>
  );
}
