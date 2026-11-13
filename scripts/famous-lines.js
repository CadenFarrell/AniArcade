// Famous Lines at a glance, so a new batch starts from a page of output instead
// of reading famousLines.js whole (it is ~120 KB, about 30k tokens — more than
// the rest of a typical batch session put together). Read-only: it prints and
// never writes.
//
//   node scripts/famous-lines.js               totals, a lines-per-show histogram, duplicates
//   node scripts/famous-lines.js --counts      the same with every show's count (~4 KB)
//   node scripts/famous-lines.js --missing 40  the 40 most popular pack shows with no line
//   node scripts/famous-lines.js --show Naruto every line of one show (pack fold, so any spelling)
//
// The duplicate check folds case, punctuation and the [blank] brackets, which
// is how two batches have entered the same line in different typography.
// famousLines.test.js remains what holds each entry to the file's rules; this
// only answers "what is there" cheaply.

import { readFileSync } from 'node:fs';
import { FAMOUS_LINES } from '../src/games/aniquiz/famousLines.js';
import { franchiseTitleKey } from '../src/shared/utils/franchise.js';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] ?? '');
};

const fold = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const byShow = new Map();
for (const entry of FAMOUS_LINES) {
  const key = franchiseTitleKey(entry.show);
  if (!byShow.has(key)) byShow.set(key, { title: entry.show, lines: [] });
  byShow.get(key).lines.push(entry);
}

const show = flag('--show');
const missing = flag('--missing');

if (show !== null) {
  const hit = byShow.get(franchiseTitleKey(show));
  if (!hit) {
    console.log(`No lines for "${show}".`);
  } else {
    console.log(`${hit.title}: ${hit.lines.length} line(s)`);
    for (const e of hit.lines) console.log(`- [fame ${e.fame}] ${e.by}: ${e.line}`);
  }
} else if (missing !== null) {
  // index.json's `current` names the live pack file, as it does for the app.
  const { current } = JSON.parse(readFileSync('public/facts/index.json', 'utf8'));
  const pack = JSON.parse(readFileSync(`public/facts/${current}`, 'utf8'));
  const unlined = Object.entries(pack.shows)
    .filter(([key]) => !byShow.has(key))
    .sort(([, a], [, b]) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, Number(missing) || 40);
  console.log(`Most popular pack shows with no line (${unlined.length}):`);
  for (const [, s] of unlined) console.log(`- ${s.title} (popularity ${s.popularity ?? '?'})`);
} else {
  console.log(`${FAMOUS_LINES.length} lines across ${byShow.size} shows`);
  const counts = [...byShow.values()].sort((a, b) => b.lines.length - a.lines.length);
  if (args.includes('--counts')) {
    console.log(counts.map((s) => `${s.title} ${s.lines.length}`).join(' · '));
  } else {
    // A histogram, not the 200-show list: "how lopsided is it" in one line.
    const shape = new Map();
    for (const s of counts) shape.set(s.lines.length, (shape.get(s.lines.length) ?? 0) + 1);
    console.log(`shows by line count: ${[...shape].map(([n, k]) => `${n}×${k}`).join(', ')}`);
    console.log(`most: ${counts.slice(0, 5).map((s) => `${s.title} ${s.lines.length}`).join(' · ')}`);
  }

  const seen = new Map();
  const dupes = [];
  for (const e of FAMOUS_LINES) {
    const key = fold(e.line);
    if (seen.has(key)) dupes.push(`${seen.get(key).show} / ${e.show}: ${e.line}`);
    else seen.set(key, e);
  }
  console.log(dupes.length ? `\nDuplicates:\n${dupes.join('\n')}` : '\nNo duplicate lines.');
}
