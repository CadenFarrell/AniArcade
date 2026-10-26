// The arcade's one write-only channel back to whoever runs it: crash reports
// (crashReport.js) and player feedback (FeedbackModal.jsx). Both land in the
// Realtime Database the online rooms already use, under `reports/<kind>/<uid>`,
// which no client can read — they are read in the Firebase console, which
// bypasses the rules. That keeps the whole thing on the free Spark plan: no
// Cloud Function, no third-party error service, no account.
//
// FIREBASE IS IMPORTED DYNAMICALLY, never at the top of this file. The hub's
// startup bundle carries no Firebase at all (src/hub/CLAUDE.md, "Games load on
// demand"), and both callers are hub-level code — the root ErrorBoundary and the
// hub footer. A static import here would pull the SDK back into the first paint
// for every visitor, to serve a crash that almost never happens. Imported on
// demand, local play still contacts Firebase only at the moment something is
// actually sent.
//
// The rate limit lives in database.rules.json, not here: each report is written
// in one multi-path update with `reportGate/<uid>/<kind>` set to the server's
// `now`, and the gate's rule refuses a write too soon after the last one. A
// client-side throttle would be a suggestion; the rule is the limit.

// Where each kind goes, and the field caps its rule enforces. Trimmed here as
// well so an over-long stack is cut rather than refused outright — the rule is
// the guard against a hand-made write, this is the courtesy to a real one.
export const REPORT_KINDS = ['crashes', 'feedback'];

export const LIMITS = {
  message: 300,
  stack: 2000,
  componentStack: 1500,
  path: 200,
  ua: 200,
  gameId: 40,
  build: 40,
  text: 1000,
};

/** Cut every string field to its limit and drop empty ones (an absent field passes the rules; an empty string still has to be a string). */
export function trimFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (typeof value !== 'string') continue;
    const cut = value.slice(0, LIMITS[key] ?? 0);
    if (cut) out[key] = cut;
  }
  return out;
}

// The build this page is running, so a report can be matched to a commit.
// vite.config.js defines it from `git rev-parse`; absent under vitest.
export const BUILD = import.meta.env.VITE_APP_BUILD || 'dev';

/**
 * Whether this build has somewhere to send to: true or false, or null when the
 * Firebase chunk itself could not load — which is what offline looks like to a
 * dynamic import, and is "don't know yet" rather than "no".
 */
export async function reportsConfigured() {
  try {
    const { firebaseEnabled } = await import('./firebase');
    return Boolean(firebaseEnabled);
  } catch {
    return null;
  }
}

/** Whether a report can be sent from here right now: configured, and the device has signal. */
export async function reportsAvailable() {
  if (globalThis.navigator?.onLine === false) return false;
  return (await reportsConfigured()) === true;
}

/**
 * Writes one report. Resolves true once the server has it; rejects on a refusal
 * (the rate limit, a field over its cap) or a lost connection, so the feedback
 * box can say so. Crash reporting swallows the rejection itself.
 */
export async function sendReport(kind, fields) {
  if (!REPORT_KINDS.includes(kind)) throw new Error(`unknown report kind: ${kind}`);
  const fb = await import('./firebase');
  if (!fb.firebaseEnabled) throw new Error('Firebase is not configured');
  const uid = await fb.ensureSignedIn();
  const { ref, push, update, serverTimestamp } = await import('firebase/database');
  const db = fb.getFirebaseDb();
  const id = push(ref(db, `reports/${kind}/${uid}`)).key;
  // One update, so the rule on the report can see the gate being stamped in the
  // same write (it reads the new tree through newData's parents).
  await update(ref(db), {
    [`reports/${kind}/${uid}/${id}`]: { ...trimFields(fields), build: BUILD, at: serverTimestamp() },
    [`reportGate/${uid}/${kind}`]: serverTimestamp(),
  });
  return true;
}
