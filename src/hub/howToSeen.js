// Which games this device has already been shown the How to play sheet for.
//
// The sheet opens by itself the first time each game is opened here, and never
// again: a player new to a game needs the rules before the first round, while a
// sheet over every visit is how help turns into a nag (welcomeSeen.js's reason).
// The top bar's "How to play" brings it back at any point.
//
// One key holding a list of game ids rather than a key per game, so the arcade
// keeps one name in storage for the whole feature. localStorage, guarded like
// welcomeSeen: a browser that throws on storage shows the sheet again rather
// than crashing the game open. Not in PRESERVED_KEYS — a crash reset showing
// the rules once more is harmless.
export const HOWTO_KEY = 'aniarcade_howto_seen';

function readList() {
  try {
    const list = JSON.parse(localStorage.getItem(HOWTO_KEY) || '[]');
    return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function readHowToSeen(gameId) {
  return readList().includes(gameId);
}

export function markHowToSeen(gameId) {
  if (typeof gameId !== 'string' || !gameId) return;
  const list = readList();
  if (list.includes(gameId)) return;
  try {
    localStorage.setItem(HOWTO_KEY, JSON.stringify([...list, gameId]));
  } catch {
    // It will simply open again next time.
  }
}
