// The arcade's sounds: the UI's (a press, a step back, a pick, a launch) and the
// games' own — right and wrong, a turn coming round, the last seconds of a
// clock, a reveal, the winner's stamp.
//
// Web Audio rather than <audio> elements, because a UI click has to start the
// instant the finger lands. An <audio> element re-buffers on every play() and
// two quick taps cut each other off; a decoded AudioBuffer can be started any
// number of times at once with no latency at all.
//
// The files are Kenney's "Interface Sounds" (CC0), converted once from .ogg to
// .mp3 — see shared/ui/credits.js. MP3 because it is the one format every
// browser decodes; Safari's Vorbis support is not something to bet a click on.
//
// THREE PROPERTIES THE REST OF THE APP RELIES ON:
//
// - **It is a no-op wherever Web Audio is missing.** jsdom has none, so every
//   component test presses Buttons that call playSound and nothing happens —
//   no fetch, no error. `HubScreen.test.jsx` fails every request but /facts/,
//   and this module never asks for /sounds/ there because it never gets far
//   enough to.
// - **Nothing is fetched before the browser is idle**, and nothing is decoded
//   before a user gesture. The bytes arrive early (prefetchSounds) so the very
//   first press — PRESS START — is not silent; the AudioContext is created
//   inside that press, because a context created before any gesture starts
//   suspended and Chrome logs a warning about it.
// - **A failure is silence, never an error.** A missing file, a decode the
//   browser refuses, a context that will not resume: each just drops that one
//   sound. Nothing here is worth a crash screen.

const SOUNDS = {
  tap: 0.35, // every Button
  back: 0.4, // GhostButton, the bar's Hub control
  select: 0.45, // picking a game on the hub
  start: 0.4, // PRESS START, and a game launching
  open: 0.35, // a Modal appearing
  close: 0.35,
  toggle: 0.4, // the mute switch itself (heard only when turning sound ON)

  // The games' sounds. Louder than the clicks on purpose: they are events in
  // the game, not acknowledgements of a press, and have to read as such from
  // across a table. All played through playCue, from state, not from a press.
  correct: 0.6, // your answer was right
  wrong: 0.55, // ...and wrong
  yes: 0.5, // a yes/no verdict landing (AniGuess's answers, AniTag's rulings)
  no: 0.5,
  turn: 0.6, // online: it has just become YOUR go
  buzz: 0.6, // AniTune's race: somebody buzzed in
  tick: 0.35, // each of a countdown's last five seconds
  timeup: 0.6, // a countdown running out
  reveal: 0.55, // an answer coming out (AniWave's dial, AniFake's vote, AniRank's order)
  stamp: 0.65, // the results splash's stamp landing
};

let ctx = null;
let muted = false;
// name → Promise<ArrayBuffer> (fetched) and name → AudioBuffer (decoded).
// Separate because decodeAudioData DETACHES the ArrayBuffer it is given, so a
// buffer can be decoded exactly once.
const bytes = new Map();
const decoded = new Map();
const decoding = new Map();

function audioContextClass() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

export function soundSupported() {
  return audioContextClass() != null;
}

export function setSoundMuted(next) {
  muted = !!next;
}

export function isSoundMuted() {
  return muted;
}

/** Fetch every file's bytes without decoding them. Safe to call repeatedly. */
export function prefetchSounds() {
  if (!soundSupported() || typeof fetch !== 'function') return;
  for (const name of Object.keys(SOUNDS)) {
    if (bytes.has(name)) continue;
    bytes.set(
      name,
      fetch(`/sounds/${name}.mp3`)
        .then((res) => (res.ok ? res.arrayBuffer() : null))
        .catch(() => null),
    );
  }
}

function context() {
  if (ctx) return ctx;
  const AC = audioContextClass();
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  return ctx;
}

function decode(name) {
  if (decoded.has(name)) return Promise.resolve(decoded.get(name));
  if (decoding.has(name)) return decoding.get(name);
  prefetchSounds();
  const c = ctx;
  const job = (bytes.get(name) ?? Promise.resolve(null))
    .then((buf) => (buf ? c.decodeAudioData(buf) : null))
    .then((audio) => {
      if (audio) decoded.set(name, audio);
      return audio;
    })
    .catch(() => null);
  decoding.set(name, job);
  return job;
}

/**
 * Play one sound. Call it from inside the event handler that caused it — the
 * first call creates the AudioContext, and it must be created in a gesture.
 */
export function playSound(name) {
  if (muted || !(name in SOUNDS)) return;
  const c = context();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});

  // The first press decodes on the spot. Decoding a 2 KB click takes a few
  // milliseconds, so it still lands with the press; a sound that would arrive
  // noticeably late is dropped instead, since a click that sounds after the
  // screen has already changed reads as a glitch rather than as feedback.
  const asked = performance.now();
  decode(name).then((audio) => {
    if (!audio || muted || performance.now() - asked > 250) return;
    try {
      const src = c.createBufferSource();
      src.buffer = audio;
      const gain = c.createGain();
      gain.gain.value = SOUNDS[name];
      src.connect(gain).connect(c.destination);
      src.start();
    } catch {
      // A context closed underneath us; silence is the right failure.
    }
  });
}

/**
 * Play a sound that a STATE CHANGE caused rather than a press: a verdict
 * arriving, a clock running out, a reveal. Same as playSound, except it never
 * creates the AudioContext — it plays only once a press already has. A context
 * created outside a gesture starts suspended (and Chrome warns about it), which
 * is exactly what a cue on a freshly reloaded tab would do before its first tap.
 * Until then a cue is silence, like every other failure here.
 */
export function playCue(name) {
  if (!ctx) return;
  playSound(name);
}

export const SOUND_NAMES = Object.keys(SOUNDS);
