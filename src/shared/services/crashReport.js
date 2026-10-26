import { reportsAvailable, sendReport } from './reports';

// Crash reports: the one way a crash on somebody else's phone ever reaches the
// person who can fix it. Before this, ErrorBoundary's console.error was the
// whole story, and a console on a friend's phone at a game night is nobody's.
//
// Two sources feed it. ErrorBoundary's componentDidCatch, for a render crash,
// which is the one a player SEES; and the window's `error` and
// `unhandledrejection` events (installCrashListeners, from main.jsx), for a
// handler or a promise that failed without taking the screen down — the kind
// that leaves a button silently doing nothing.
//
// What it never sends: anything from a profile (no names, no lists — a stack
// holds file names and line numbers, not data), and the address bar's query,
// which is where an invite's room code rides.
//
// What it never sends FROM: a dev server (`import.meta.env.DEV`), because
// .env.local is production and a crash while editing is not news; a device
// with no signal; and a build with no Firebase, which has nowhere to send to.

// Remembered per tab, so a crash that repeats on every render — or a broken
// handler pressed ten times — is one report, not a burst the rate limit then
// has to refuse. sessionStorage, guarded: a browser that throws on it just
// sends again, and the server's limit still holds.
const SENT_KEY = 'aniarcade_crash_sent';

/** The fingerprint a repeat is recognised by: the message and the first frame of the stack. */
export function crashSignature(error) {
  const message = String(error?.message ?? error ?? '');
  const frame = String(error?.stack ?? '').split('\n').find((l) => /\bat\b|@/.test(l)) ?? '';
  return `${message}|${frame.trim()}`.slice(0, 300);
}

/**
 * The fields a report carries, from an error and where it happened. Pure, so it
 * is tested without a window: `env` supplies the page's address and browser.
 */
export function buildCrashReport(error, { componentStack, gameId } = {}, env = {}) {
  return {
    message: String(error?.message ?? error ?? 'Unknown error'),
    stack: typeof error?.stack === 'string' ? error.stack : undefined,
    componentStack: typeof componentStack === 'string' ? componentStack.trim() : undefined,
    gameId: typeof gameId === 'string' ? gameId : undefined,
    // The pathname only. The query is where an invite carries its room code.
    path: env.pathname,
    ua: env.userAgent,
  };
}

/**
 * Whether a window-level error is ours to report. Browser extensions and
 * injected scripts throw into the page too, and their errors are noise nobody
 * here can fix, so only an error whose stack runs through this site's own code
 * counts — `/assets/` in a build, `/src/` in dev. An error with no stack at all
 * ("ResizeObserver loop…", a cross-origin "Script error.") is skipped for the
 * same reason: there is nothing in it to act on.
 */
export function isOwnError(error, origin) {
  const stack = typeof error?.stack === 'string' ? error.stack : '';
  if (!stack || !origin) return false;
  return stack.includes(`${origin}/assets/`) || stack.includes(`${origin}/src/`);
}

function alreadySent(signature) {
  try {
    const sent = JSON.parse(sessionStorage.getItem(SENT_KEY) || '[]');
    if (Array.isArray(sent) && sent.includes(signature)) return true;
    sessionStorage.setItem(SENT_KEY, JSON.stringify([...(Array.isArray(sent) ? sent : []), signature].slice(-20)));
  } catch {
    // Unreadable storage: send, and let the server's rate limit hold.
  }
  return false;
}

/**
 * Report one crash, in the background. Never throws and never rejects: a
 * reporter that can crash is a second crash.
 */
export function reportCrash(error, context = {}) {
  try {
    if (import.meta.env.DEV) return;
    // A game whose code never downloaded is a dropped connection or a tab left
    // open across a deploy (lazyGame.js), not a bug, and offline there is
    // nowhere to send it anyway.
    if (error?.gameLoad) return;
    if (globalThis.navigator?.onLine === false) return;
    if (alreadySent(crashSignature(error))) return;
    const fields = buildCrashReport(error, context, {
      pathname: globalThis.location?.pathname,
      userAgent: globalThis.navigator?.userAgent,
    });
    reportsAvailable()
      .then((ok) => (ok ? sendReport('crashes', fields) : null))
      .catch(() => {});
  } catch {
    // Nothing: see above.
  }
}

/** The window-level half. Called once, from main.jsx. */
export function installCrashListeners() {
  if (typeof window === 'undefined') return;
  const origin = window.location.origin;
  window.addEventListener('error', (e) => {
    if (isOwnError(e.error, origin)) reportCrash(e.error);
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (isOwnError(e.reason, origin)) reportCrash(e.reason);
  });
}
