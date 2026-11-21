// The hub's startup budget: everything the page downloads before the menu can
// paint, gzipped. `npm run size` (after `npm run build`), and CI.
//
// The files are read out of the built index.html rather than named here: the
// entry script, EVERY chunk it modulepreloads, and the stylesheet. A fixed list
// (`index-*.js` plus the Rolldown runtime) was this file until 2026-11-16, when
// loading the record page on demand made Rolldown lift three modules the
// entry shares with it into chunks of their own — `ui`, `character`,
// `Portrait`, all preloaded, all still startup — and the old list reported
// 94 kB for a page that really cost 116.6. A check that names chunks goes
// quiet the day the bundler renames them; index.html is the bundler's own
// answer to "what loads first".
//
// The limits are decisions (root CLAUDE.md, "Hub and game registration"):
// raise one only as a decision, never to get a build through.
import { readFileSync } from 'node:fs';

let html;
try {
  html = readFileSync(new URL('./dist/index.html', import.meta.url), 'utf8');
} catch {
  throw new Error('No dist/index.html — run `npm run build` before `npm run size`.');
}

// Same-origin files only, as index.html writes them ("/assets/x.js").
const tagged = (tag, rel) => [...html.matchAll(new RegExp(`<${tag} [^>]*>`, 'g'))]
  .map(([el]) => el)
  .filter((el) => !rel || new RegExp(`rel="${rel}"`).test(el))
  .map((el) => /(?:src|href)="\/([^"]+)"/.exec(el)?.[1])
  .filter(Boolean)
  .map((file) => `dist/${file}`);

const scripts = [...tagged('script'), ...tagged('link', 'modulepreload')];
const styles = tagged('link', 'stylesheet');
if (!scripts.length || !styles.length) {
  throw new Error('dist/index.html names no startup script or stylesheet — has its shape changed?');
}

export default [
  { name: 'Hub startup script', path: scripts, gzip: true, limit: '120 kB' },
  { name: 'Hub startup styles', path: styles, gzip: true, limit: '15 kB' },
];
