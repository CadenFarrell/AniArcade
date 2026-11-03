// Name That Character's pictures: every character portrait on the seated
// players' imported lists, keyed the way the fact pack keys characters.
//
// The pack carries no images (it is a few hundred KB of text every player
// downloads), and the players' lists already hold AniList's portrait URL for
// every character they imported — the same picture the hub tiles and every
// Avatar show. So the topic is exactly as wide as the table's lists, and is
// empty for a table with none. Loading one is the player's OWN data from
// AniList's CDN, the arcade's one sanctioned third-party load (root CLAUDE.md).
//
// Online the host deals from the room's copies of each profile, which carry
// the same characters (useQuizRoom's normalizeState repairs a dropped list).
import { subjectKeyForCharacter } from '../../../shared/utils/facts';

const isImage = (url) => typeof url === 'string' && /^https:\/\//.test(url);

/** Map of pack character key → portrait URL, first list to picture someone wins. */
export function portraitsFrom(players) {
  const out = new Map();
  for (const p of players ?? []) {
    for (const entry of p?.animeList ?? []) {
      for (const c of entry?.characters ?? []) {
        if (!c?.name || !isImage(c.imageUrl)) continue;
        const key = subjectKeyForCharacter(c.name);
        if (key && !out.has(key)) out.set(key, c.imageUrl);
      }
    }
  }
  return out;
}
