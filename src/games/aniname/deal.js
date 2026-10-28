// The deal: one category a round, decided once on the dealing device. Only the
// category travels (`{ kind, key, label, known }`) — every device rebuilds the
// answers from the room's profiles and its own pack (answers.js), so a genre
// with four hundred shows behind it is not copied into the room.
//
// Pure, with an injectable rng, so a seed is a replay.
import { shuffle } from '../../shared/utils/random';
import { KINDS, buildIndex, categoriesFor } from './answers';

// Weighted order without replacement: heavier kinds tend to come first.
function weightedOrder(kinds, rng) {
  const left = [...kinds];
  const out = [];
  while (left.length) {
    const total = left.reduce((s, k) => s + KINDS[k].weight, 0);
    let r = rng() * total;
    const i = left.findIndex((k) => (r -= KINDS[k].weight) < 0);
    out.push(...left.splice(i < 0 ? left.length - 1 : i, 1));
  }
  return out;
}

/**
 * Deals a game. Returns `{ deal }`, or `{ error, found }` when the lists hold
 * fewer categories than rounds.
 *
 * `settings`: `{ rounds, seconds }` (prefs.js). `pack` is the indexed fact pack
 * or null. A category leans toward shows more of the table holds: a
 * "characters from X" only its importer has seen is a round only they can bid.
 *
 * No kind comes up twice running when another can, and no category twice.
 * "Characters from X" and "main characters from X" count as one show, so the
 * same cast is never asked for twice in a game.
 */
export function dealGame(players, settings, pack = null, rng = Math.random) {
  const rounds = settings?.rounds ?? 6;
  const index = buildIndex(players, pack);
  const byKind = new Map();
  for (const cat of shuffle(categoriesFor(index), rng)) {
    if (!byKind.has(cat.kind)) byKind.set(cat.kind, []);
    byKind.get(cat.kind).push(cat);
  }
  // Most-held first, with noise, so the lean is a lean and not a wall.
  for (const list of byKind.values()) {
    list.sort((a, b) => (b.owners + rng() * 1.5) - (a.owners + rng() * 1.5));
  }

  const cats = [];
  const usedShows = new Set();
  let last = null;
  while (cats.length < rounds) {
    const kinds = [...byKind.keys()].filter((k) => byKind.get(k).length);
    const order = weightedOrder(kinds.filter((k) => k !== last), rng);
    if (last && kinds.includes(last)) order.push(last);
    let picked = null;
    for (const kind of order) {
      const list = byKind.get(kind);
      const i = list.findIndex((c) => !(KINDS[kind].of === 'characters' && usedShows.has(c.key)));
      if (i < 0) { list.length = 0; continue; }
      [picked] = list.splice(i, 1);
      break;
    }
    if (!picked) break;
    if (KINDS[picked.kind].of === 'characters') usedShows.add(picked.key);
    last = picked.kind;
    cats.push({ kind: picked.kind, key: picked.key, label: picked.label, known: picked.known });
  }

  if (cats.length < rounds) {
    return { error: `These lists hold ${cats.length} categor${cats.length === 1 ? 'y' : 'ies'} — need ${rounds}.`, found: cats.length };
  }
  return { deal: { rounds, namingMs: (settings?.seconds ?? 60) * 1000, cats } };
}
