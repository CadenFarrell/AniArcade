import { characterNameKey } from './character';

// The one character that stands for a player on a setup screen or in a lobby:
// their most-favourited character with a portrait. Deterministic on purpose —
// unlike the hub tiles, which draw fresh each visit, a player's slot is THEM,
// and a face that changed every time the screen re-rendered would read as a
// different person sitting down.
//
// Most-favourited because it is the best-known character on the list, so the
// one the rest of the table is likeliest to recognise. Ties keep list order.
// Characters with no portrait (hand-entered in ListManager) never qualify; a
// profile with none gets null and the slot draws its bare panel.
export function portraitFor(profile) {
  let best = null;
  let bestFav = -1;
  for (const anime of profile?.animeList ?? []) {
    for (const c of anime?.characters ?? []) {
      const imageUrl = typeof c?.imageUrl === 'string' ? c.imageUrl.trim() : '';
      if (!imageUrl) continue;
      const fav = Number.isFinite(c.favourites) ? c.favourites : 0;
      if (fav > bestFav) {
        best = { name: c.name ?? '', imageUrl, show: anime.title ?? '' };
        bestFav = fav;
      }
    }
  }
  return best;
}

// Every seated player's portrait, distinct across the table. Friends' lists
// overlap — that is the point of most games here — so their single best-known
// characters are often the SAME character, and two slots wearing one face read
// as one person seated twice. So: seat order, and each player gets their
// best-known character that nobody seated before them is already wearing
// (distinct by folded name, characterNameKey, the identity every game uses).
// A player whose every pictured character is taken falls back to their own
// best one rather than to no face at all.
//
// Returns a Map of player id → portrait | null.
export function portraitsFor(players) {
  const taken = new Set();
  const out = new Map();
  for (const player of players ?? []) {
    const ranked = [];
    for (const anime of player?.animeList ?? []) {
      for (const c of anime?.characters ?? []) {
        const imageUrl = typeof c?.imageUrl === 'string' ? c.imageUrl.trim() : '';
        if (!imageUrl) continue;
        ranked.push({
          name: c.name ?? '',
          imageUrl,
          show: anime.title ?? '',
          fav: Number.isFinite(c.favourites) ? c.favourites : 0,
        });
      }
    }
    // Stable sort: equal favourites keep list order, as portraitFor does.
    ranked.sort((a, b) => b.fav - a.fav);
    const pick = ranked.find((c) => !taken.has(characterNameKey(c.name))) ?? ranked[0] ?? null;
    if (pick) taken.add(characterNameKey(pick.name));
    out.set(player?.id, pick && { name: pick.name, imageUrl: pick.imageUrl, show: pick.show });
  }
  return out;
}
