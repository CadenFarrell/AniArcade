import { characterNameKey } from '../shared/utils/character';

// Which character stands on each hub tile: a fresh draw from the main
// profile's own list, so every player's board is theirs, and different every
// time the menu opens.
//
// A .js module for the reason gameIcons.js was one (see src/hub/CLAUDE.md):
// a pure function is checked by a plain .test.js under node, while anything
// inside HubScreen.jsx can only be reached by mounting the hub in jsdom.
//
// Only characters that carry a portrait are eligible. Hand-entered ones from
// ListManager have no `imageUrl`, and neither does anything imported before
// portraits were fetched — a tile with a name and no face would just be an
// empty panel with a caption. One character never stands on two tiles: the
// same person often appears under several seasons of one franchise, so
// distinctness is by folded NAME (`characterNameKey`, the identity every game
// uses), not by id, which differs between those seasons.
//
// Returns { [gameId]: { name, imageUrl, show } | null }. A list too small to
// fill the board fills what it can, in board order, and the rest get null —
// HubScreen draws those as bare manga panels rather than repeating a face.

export function tileCandidates(profile) {
  const seen = new Set();
  const out = [];
  for (const anime of profile?.animeList ?? []) {
    for (const c of anime?.characters ?? []) {
      const imageUrl = typeof c?.imageUrl === 'string' ? c.imageUrl.trim() : '';
      if (!imageUrl || !c?.name) continue;
      const key = characterNameKey(c.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ name: c.name, imageUrl, show: anime.title ?? '' });
    }
  }
  return out;
}

// `random` is injectable so the draw can be tested; the hub passes nothing.
export function drawTileCharacters(profile, gameIds, random = Math.random) {
  const pool = tileCandidates(profile);
  // A partial Fisher–Yates: only as many swaps as there are tiles to fill.
  const n = Math.min(pool.length, gameIds.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Object.fromEntries(gameIds.map((id, i) => [id, i < n ? pool[i] : null]));
}
