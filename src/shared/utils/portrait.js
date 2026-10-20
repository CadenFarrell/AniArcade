import { characterNameKey } from './character';

// Every character on a profile that can be drawn as a face: one entry per
// person (folded name, characterNameKey, the identity every game uses — the
// same character turns up under several season titles), most-favourited first.
// Characters with no portrait (hand-entered in ListManager's old form) never
// qualify. Equal favourites keep list order, so the ranking is stable.
//
// Shared by the automatic choice below and the character picker
// (PortraitPicker.jsx), so the grid a player chooses from and the faces the
// table gets cannot disagree about who is on the list.
export function pictureableCharacters(profile) {
  const seen = new Map();
  for (const anime of profile?.animeList ?? []) {
    for (const c of anime?.characters ?? []) {
      const imageUrl = typeof c?.imageUrl === 'string' ? c.imageUrl.trim() : '';
      if (!imageUrl) continue;
      const key = characterNameKey(c.name ?? '');
      const fav = Number.isFinite(c.favourites) ? c.favourites : 0;
      const prev = seen.get(key);
      // The same person on two shows: keep the better-known entry's numbers and
      // the first show it was found under, which is the order the list reads in.
      if (!prev) seen.set(key, { key, name: c.name ?? '', imageUrl, show: anime.title ?? '', fav });
      else if (fav > prev.fav) prev.fav = fav;
    }
  }
  // Stable sort: equal favourites keep list order.
  return [...seen.values()].sort((a, b) => b.fav - a.fav);
}

const face = (c) => c && { name: c.name, imageUrl: c.imageUrl, show: c.show };

// The profile with its chosen face set to `key`, or back on Automatic for a
// null key. Automatic DROPS the field rather than writing null or undefined:
// the profile is copied whole into an online room, and RTDB rejects a write
// that carries `undefined` anywhere in it.
export function withPortraitKey(profile, key) {
  const { portraitKey: _previous, ...rest } = profile;
  return key ? { ...rest, portraitKey: key } : rest;
}

// The character a player CHOSE (profile.portraitKey, a characterNameKey, set
// from PortraitPicker), or null when they left it on Automatic — or chose
// someone a later edit took off their list, which quietly falls back to
// Automatic rather than to no face. Keyed by folded name, not by AniList id,
// for the reason identity is name-based everywhere else (see CLAUDE.md).
function chosen(ranked, profile) {
  const key = typeof profile?.portraitKey === 'string' ? profile.portraitKey : '';
  return key ? ranked.find((c) => c.key === key) ?? null : null;
}

// The one character that stands for a player on a setup screen or in a lobby:
// the one they chose, else their most-favourited character with a portrait.
// Deterministic on purpose — unlike the hub tiles, which draw fresh each visit,
// a player's slot is THEM, and a face that changed every time the screen
// re-rendered would read as a different person sitting down.
//
// Most-favourited because it is the best-known character on the list, so the
// one the rest of the table is likeliest to recognise. A profile with no
// pictured character gets null and the slot draws its bare panel.
export function portraitFor(profile) {
  const ranked = pictureableCharacters(profile);
  return face(chosen(ranked, profile) ?? ranked[0] ?? null);
}

// Every seated player's portrait, distinct across the table. Friends' lists
// overlap — that is the point of most games here — so their single best-known
// characters are often the SAME character, and two slots wearing one face read
// as one person seated twice.
//
// Two passes, in seat order:
//   1. Chosen characters. A player who picked a face gets it unless somebody
//      seated before them picked the same one — first seated keeps it. A choice
//      beats an automatic face whatever the seats, because the automatic one
//      is only ever a stand-in for a choice nobody made.
//   2. Everyone else, automatic: their best-known character nobody already
//      wears. A player whose every pictured character is taken falls back to
//      their own best one rather than to no face at all.
//
// A player who lost a clash in pass 1 is marked `takenBy` (the name of whoever
// kept it), so their slot can say why they are not wearing what they chose —
// otherwise the pick just looks like it failed to save.
//
// Returns a Map of player id → portrait | null.
export function portraitsFor(players) {
  const seated = (players ?? []).map((player) => {
    const ranked = pictureableCharacters(player);
    return { player, ranked, pick: chosen(ranked, player) };
  });
  const taken = new Map(); // folded name → name of who wears it
  const out = new Map();
  const clashes = new Map();

  for (const { player, pick } of seated) {
    if (!pick) continue;
    if (taken.has(pick.key)) {
      clashes.set(player?.id, taken.get(pick.key));
      continue;
    }
    taken.set(pick.key, player?.name ?? '');
    out.set(player?.id, face(pick));
  }

  for (const { player, ranked } of seated) {
    if (out.has(player?.id)) continue;
    const auto = ranked.find((c) => !taken.has(c.key)) ?? ranked[0] ?? null;
    if (auto && !taken.has(auto.key)) taken.set(auto.key, player?.name ?? '');
    const portrait = face(auto);
    const takenBy = clashes.get(player?.id);
    out.set(player?.id, portrait && takenBy != null ? { ...portrait, takenBy } : portrait);
  }
  return out;
}
