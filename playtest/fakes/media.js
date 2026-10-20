// Audio for the bots.
//
// jsdom implements HTMLMediaElement as an inert shell: load() and play() log
// "Not implemented" through the virtual console and play() returns undefined,
// so ClipPlayer's `audio.play().then(…)` throws on the first clip. These stubs
// give it the behaviour it is written against — load() fires loadedmetadata,
// play() resolves, and currentTime ADVANCES while playing — with currentTime
// read off Date.now(), which the jsdom runner fakes. So a clip "plays" exactly
// as fast as the bot advances time, and a ten-second window takes ten seconds
// of fake time no matter how slow the machine is.
//
// A src containing "broken" fires `error` instead, for the unplayable path.

const DURATION = 90;
const state = new WeakMap();
const st = (el) => {
  if (!state.has(el)) state.set(el, { base: 0, startedAt: null, rate: 1, ready: 0 });
  return state.get(el);
};
const now = () => Date.now();

let installed = false;

export function installMediaStubs() {
  if (installed || typeof HTMLMediaElement === 'undefined') return;
  installed = true;
  const P = HTMLMediaElement.prototype;
  const define = (name, desc) => Object.defineProperty(P, name, { configurable: true, ...desc });

  define('load', {
    value() {
      const s = st(this);
      s.base = 0;
      s.startedAt = null;
      const src = this.getAttribute('src') ?? this.src ?? '';
      // A microtask, not a timer: the fake clock must not have to move for a
      // clip to finish loading, or every clip would sit on "Loading…" until
      // the bot happened to wait.
      queueMicrotask(() => {
        if (!src) return;
        if (/broken/.test(src)) { this.dispatchEvent(new Event('error')); return; }
        s.ready = 4;
        this.dispatchEvent(new Event('loadedmetadata'));
        this.dispatchEvent(new Event('canplay'));
      });
    },
  });
  define('play', {
    value() {
      const s = st(this);
      if (s.startedAt == null) s.startedAt = now();
      queueMicrotask(() => this.dispatchEvent(new Event('playing')));
      return Promise.resolve();
    },
  });
  define('pause', {
    value() {
      const s = st(this);
      if (s.startedAt != null) {
        s.base += ((now() - s.startedAt) / 1000) * s.rate;
        s.startedAt = null;
      }
    },
  });
  define('currentTime', {
    get() {
      const s = st(this);
      const t = s.startedAt == null ? s.base : s.base + ((now() - s.startedAt) / 1000) * s.rate;
      return Math.min(t, DURATION);
    },
    set(v) {
      const s = st(this);
      s.base = Number(v) || 0;
      if (s.startedAt != null) s.startedAt = now();
    },
  });
  define('playbackRate', {
    get() { return st(this).rate; },
    set(v) { this.pause(); st(this).rate = Number(v) || 1; },
  });
  define('duration', { get() { return DURATION; } });
  define('readyState', { get() { return st(this).ready; } });
  define('paused', { get() { return st(this).startedAt == null; } });
}

// A silent mono WAV, built in memory for the browser layer's audio route, long
// enough for any clip window plus ClipPlayer's two-second outro margin. 4 kHz
// 8-bit keeps 60 seconds at ~240 KB; nothing listens to it.
export function silentWav(seconds = 60, rate = 4000) {
  const samples = seconds * rate;
  const buf = Buffer.alloc(44 + samples, 128);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples, 40);
  return buf;
}
