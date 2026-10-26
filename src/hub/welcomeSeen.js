// Whether this device has answered the first-visit welcome (WelcomeModal.jsx).
//
// Remembered for good once answered: a player who said "Not now" still has
// the hub's one-line hint and the bar's Set profile, and being asked again on
// every visit is how a welcome turns into a nag. localStorage, unlike
// titleSeen's session flag, for exactly that reason — and guarded like it, so
// a browser that throws on storage shows the welcome again rather than
// crashing before the hub paints. Not in PRESERVED_KEYS: a crash reset showing
// it once more is harmless.
export const WELCOME_KEY = 'aniarcade_welcome_seen';

export function readWelcomeSeen() {
  try {
    return localStorage.getItem(WELCOME_KEY) === '1';
  } catch {
    return false;
  }
}

export function markWelcomeSeen() {
  try {
    localStorage.setItem(WELCOME_KEY, '1');
  } catch {
    // It will simply show again next visit.
  }
}
