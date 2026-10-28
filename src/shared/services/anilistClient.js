// Low-level AniList GraphQL client for the browser. Spends AniList's request
// allowance as the X-RateLimit-* headers report it (the commonly-cited ~90/min
// figure is stale — as of writing the API reports 30) and waits out a 429 until
// the reset the response names.
//
// Despite "for the browser" above, this module is plain fetch plus timers and is
// Node-safe — generateFacts.js and generateProfiles.js both import it directly.
// Do that rather than copying the throttle: generateProfiles.js carried its own
// 600ms version until it was folded in here, and a copy is how a rate-limit fix
// ends up applied to two callers out of three.
//
// Two Node caveats bite, not one. animethemesClient.js's User-Agent bot filter
// is a different API; AniList has its own, on Referer — see REFERER below.
const ENDPOINT = 'https://graphql.anilist.co';

// AniList bot-filters requests that carry no Referer, answering them with a 403
// whose body reads "The AniList API has been temporarily disabled due to severe
// stability issues." That looks exactly like an outage and was mistaken for one:
// the fact pack shipped empty because generateFacts.js could not get a single
// response. Only the header's PRESENCE is checked — any non-empty value passes,
// and an empty one does not — so this is honest about who is calling rather
// than impersonating anilist.co.
//
// It is a no-op in the browser: Referer is a forbidden header name, so fetch()
// silently drops this and sends the page's own referrer, which is why the app's
// import kept working throughout and only Node was ever blocked.
const REFERER = 'https://aniarcade.web.app/';

// The allowance is a FIXED WINDOW, not a rate, and that decides the whole
// design below. Measured 2026-10-26: X-RateLimit-Remaining counts down from 29
// however fast requests arrive (twelve back to back, ~200ms apart, all 200s);
// once it is spent EVERY request is a 429 until the window resets, at the time
// the 429 names in X-RateLimit-Reset; requests made during that lockout do not
// extend it; and afterwards the full 30 are back at once.
//
// This used to space every request 60000/limit + 200ms apart, i.e. 2.2s, which
// a fixed window never asked for: an import of 15 requests took 33s that the
// window would have served in about as many round trips as it has batches. Now
// the allowance is spent as fast as the requests come — a few in flight at once,
// since a character batch takes ~0.8s to answer — and only an exhausted window
// waits.
//
// CORS exposes X-RateLimit-Limit/-Remaining/-Reset to the page but NOT
// Retry-After (Access-Control-Expose-Headers, checked the same day), and
// Number(null) is 0: the old code read a browser 429's Retry-After as "retry
// now", spent its four attempts inside one second and failed the import.
// headerNumber says null for a header that is not there.
const MAX_IN_FLIGHT = 4;
// When a 429 names no usable reset. A window is a minute long.
const LOCKOUT_FALLBACK_MS = 60000;
// The reset is the server's clock and the wait is the client's, so a wait read
// off it is clamped: a client clock running fast must not retry into the same
// lockout, nor one running slow sleep for an hour.
const MIN_LOCKOUT_MS = 1000;
const MAX_LOCKOUT_MS = 65000;
// A lockout ends a beat after the reset, not on it.
const RESET_MARGIN_MS = 250;
// 429s retried per request before giving up. Each one waits out a whole
// lockout, so this is minutes, not a spin.
const MAX_LOCKOUTS = 5;
const MAX_NETWORK_ATTEMPTS = 4;

// What the last response said is left of this window — null when nothing has
// said yet (the first request, or straight after a lockout), which lets ONE
// request through to find out.
let remaining = null;
let inFlight = 0;
let blockedUntil = 0;
const waiters = [];

function headerNumber(res, name) {
  const raw = res.headers.get(name);
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const abortError = () => new DOMException('The import was cancelled.', 'AbortError');

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const done = () => { signal?.removeEventListener('abort', stop); resolve(); };
    const timer = setTimeout(done, ms);
    const stop = () => { clearTimeout(timer); reject(abortError()); };
    signal?.addEventListener('abort', stop, { once: true });
  });
}

// Waits for a slot: no lockout running, fewer than MAX_IN_FLIGHT out, and
// allowance left once the requests already out are counted against it. With
// nothing out it always lets one through, even on a spent window: that request
// either finds the window reset or brings back the 429 that says when it will.
async function acquire(signal) {
  for (;;) {
    if (signal?.aborted) throw abortError();
    const wait = blockedUntil - Date.now();
    if (wait > 0) { await sleep(wait, signal); continue; }
    const left = (remaining ?? 1) - inFlight;
    if (inFlight === 0 || (inFlight < MAX_IN_FLIGHT && left > 0)) {
      inFlight++;
      return;
    }
    // Something is out, so a release is coming to wake this.
    await new Promise((resolve) => waiters.push(resolve));
  }
}

function release(res) {
  inFlight--;
  const left = res ? headerNumber(res, 'X-RateLimit-Remaining') : null;
  if (left != null) remaining = left;
  waiters.splice(0).forEach((wake) => wake());
}

function lockOut(res) {
  const retryAfterSec = headerNumber(res, 'Retry-After');
  const resetAtSec = headerNumber(res, 'X-RateLimit-Reset');
  const wait = retryAfterSec != null
    ? retryAfterSec * 1000
    : resetAtSec != null
      ? resetAtSec * 1000 - Date.now()
      : LOCKOUT_FALLBACK_MS;
  const clamped = Math.min(Math.max(wait, MIN_LOCKOUT_MS), MAX_LOCKOUT_MS);
  blockedUntil = Math.max(blockedUntil, Date.now() + clamped + RESET_MARGIN_MS);
  remaining = null;
}

export async function anilistRequest(query, variables, { signal } = {}) {
  let networkFailures = 0;
  let lockouts = 0;
  for (;;) {
    await acquire(signal);

    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Referer: REFERER,
        },
        body: JSON.stringify({ query, variables }),
        signal,
      });
    } catch (err) {
      release(null);
      if (err.name === 'AbortError') throw err;
      if (++networkFailures >= MAX_NETWORK_ATTEMPTS) throw new Error(`AniList request failed: ${err.message}`);
      continue;
    }

    if (res.status === 429) {
      lockOut(res);
      release(null);
      if (++lockouts > MAX_LOCKOUTS) throw new Error('AniList request failed after retries');
      continue;
    }
    release(res);

    const json = await res.json().catch(() => null);
    if (!res.ok || json?.errors) {
      const message = json?.errors?.[0]?.message || `HTTP ${res.status}`;
      throw new Error(`AniList error: ${message}`);
    }

    return json.data;
  }
}

// Test-only: module state is the whole limiter, and each test needs a fresh one.
export function resetAnilistClientForTests() {
  remaining = null;
  inFlight = 0;
  blockedUntil = 0;
  waiters.splice(0);
}
