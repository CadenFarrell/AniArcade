// Whether this tab has already been past the title screen.
//
// sessionStorage, not localStorage: the title is an attract screen, so it is
// right on a fresh visit and wrong on a refresh — a player who reloads in the
// middle of a game night should land on the hub (and rejoin their room from
// there), not be asked to press start again. A session is exactly that span.
//
// Every access is guarded. Private modes and locked-down browsers can throw on
// sessionStorage, and the failure mode chosen is "show the title again", which
// costs one tap, rather than a crash before the arcade has painted.
export const TITLE_KEY = 'aniarcade_title_seen';

export function readTitleSeen() {
  try {
    return sessionStorage.getItem(TITLE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTitleSeen() {
  try {
    sessionStorage.setItem(TITLE_KEY, '1');
  } catch {
    // Nothing to do — the title will simply show again next load.
  }
}
