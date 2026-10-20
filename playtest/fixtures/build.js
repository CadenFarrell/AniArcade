// Builds playtest/fixtures/profiles.json: the profiles every playtest bot sits
// down with. Run once, and again only when the seed or the pack changes:
//
//   npx vite-node playtest/fixtures/build.js
//
// vite-node rather than plain node because packStats.js and its imports are
// app modules with Vite's extensionless imports — the exact reason the root
// CLAUDE.md gives for facts.js carrying `.js` extensions. vite-node resolves
// them the way the app does, so the stats here come from the same backfill a
// player's profile gets, not from a copy of it.
//
// WHY REAL SHOWS. makeProfile's "Test Show A" lists are not in the fact pack,
// so against them AniQuiz's shared pool is empty, AniRank's popularity axis has
// nothing to sort and AniFake's fame setting has no signal — every one of those
// modes collapses into its "not enough data" branch and the bots would only
// ever test the fallback. seedProfiles.js holds four real AniList lists, so the
// fixture is cut from those.
//
// seedProfiles.js is ~950 KB of generated JSON (see "Generated files" in the
// root CLAUDE.md). It is parsed here, never read by hand.
import { readFileSync, writeFileSync } from 'node:fs';
import { backfillProfileFromPack } from '../../src/shared/utils/packStats';
import { indexPack } from '../../src/shared/utils/facts';

const ROOT = new URL('../../', import.meta.url);
const SHOWS = 20;
const CAST = 4;

// The SEED literal sits between `const SEED = {` and the `for` loop that
// consumes it; the file is CRLF on Windows checkouts, so split on either.
function readSeed() {
  const lines = readFileSync(new URL('seedProfiles.js', ROOT), 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => l.includes('const SEED = {'));
  const end = lines.findIndex((l, i) => i > start && /^ {2}}\s*$/.test(l));
  return JSON.parse(`{${lines.slice(start + 1, end + 1).join('\n')}}`);
}

function readPack() {
  const index = JSON.parse(readFileSync(new URL('public/facts/index.json', ROOT), 'utf8'));
  return indexPack(JSON.parse(readFileSync(new URL(`public/facts/${index.current}`, ROOT), 'utf8')));
}

const trimChar = (c) => ({
  ...c,
  // Long AniList bios bloat the fixture and no bot reads past the first line.
  description: (c.description ?? '').slice(0, 160),
  favourites: c.favourites ?? 0,
});

function trim(profile, shows) {
  return {
    id: profile.id,
    name: profile.name,
    animeList: shows.map((a) => ({ ...a, characters: (a.characters ?? []).slice(0, CAST).map(trimChar) })),
  };
}

const seed = readSeed();
const pack = readPack();
// Every pair of players must share some shows (AniGuess, AniTune and AniQuiz
// default to shared-only pools), so the first SHARED titles of the biggest list
// go into everybody's; the rest of each list is that player's own.
const [big, ...rest] = Object.values(seed).sort((a, b) => b.animeList.length - a.animeList.length);
const common = big.animeList.slice(0, 8);
const titles = (list) => new Set(list.map((a) => a.title.toLowerCase()));

const profiles = [big, ...rest].map((p, i) => {
  const own = titles(common);
  const extra = p.animeList.filter((a) => !own.has(a.title.toLowerCase()));
  // Cut each extra slice from a different offset of the big list as well, so
  // the two synthetic players below do not simply duplicate somebody.
  return trim(p, [...common, ...extra].slice(0, SHOWS + (i === 3 ? -6 : 0)));
});

// Two more seats, assembled from the real lists, so six-player tables exist.
// Names chosen to fold to distinct profile ids.
for (const [name, offset] of [['Mika', 8], ['Ren', 20]]) {
  const shows = [...common.slice(0, 6), ...big.animeList.slice(offset, offset + 12)];
  profiles.push(trim({ id: name.toLowerCase(), name }, shows));
}

const out = profiles.map((p) => backfillProfileFromPack(p, pack).profile);
const stats = out.map((p) => {
  const withPop = p.animeList.filter((a) => a.popularity != null).length;
  return `${p.name}: ${p.animeList.length} shows (${withPop} with pack stats)`;
});
// One profile per line: diffable by player without pretty-printing every field.
writeFileSync(
  new URL('playtest/fixtures/profiles.json', ROOT),
  `[\n${out.map((p) => JSON.stringify(p)).join(',\n')}\n]\n`,
);
console.log(stats.join('\n'));
