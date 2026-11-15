// Writes the service worker into a finished build (vite.config.js runs it).
//
// It runs at writeBundle, after Vite has copied public/ and written every
// chunk, so one walk of the output folder sees exactly what hosting will
// serve — no second list of files to keep in step with the first. Build only:
// the dev server never gets a worker, and main.jsx only registers one in a
// production bundle.
//
// The version is a hash of every stored file's path AND bytes. Chunk names are
// content-hashed already, but public/ files are not: a sound re-encoded under
// the same name must still make a new version, or phones would keep the old
// one for good.
//
// Each file's own hash goes into the worker too (PRECACHE is url -> hash), and
// that is what makes a deploy cheap for a returning player: the worker hashes
// the copy it already holds and downloads only the files whose bytes changed.
// Without it every deploy cost every player the whole precache again, ~1.45 MB
// on the wire (measured 2026-11-15), most of it art, fonts and sounds that had
// not changed in weeks.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { precacheList } from '../src/shared/utils/precache.js';

const TEMPLATE = new URL('./serviceWorker.template.js', import.meta.url);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]);
}

export function serviceWorker() {
  let outDir;
  return {
    name: 'aniarcade-service-worker',
    apply: 'build',
    configResolved(config) {
      // --outDir as given: the playtest builds write dist-playtest*, never dist.
      outDir = resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      const paths = walk(outDir).map((file) => relative(outDir, file).split(sep).join('/'));
      const { current } = JSON.parse(readFileSync(join(outDir, 'facts', 'index.json'), 'utf8'));
      const urls = precacheList(paths, current);

      // SHA-256, because it is the one digest the worker can compute as well
      // (crypto.subtle); 16 hex characters of it is plenty to tell two builds
      // of one file apart, and keeps sw.js small. The worker compares by
      // prefix, so the length is decided here alone.
      const PRECACHE = Object.fromEntries(urls.map((url) => [
        url,
        createHash('sha256').update(readFileSync(join(outDir, url.slice(1)))).digest('hex').slice(0, 16),
      ]));

      const hash = createHash('sha256');
      for (const [url, fileHash] of Object.entries(PRECACHE)) hash.update(url).update(fileHash);
      const VERSION = hash.digest('hex').slice(0, 16);

      const head = `self.__ANIARCADE_SW__ = ${JSON.stringify({ VERSION, PRECACHE })};\n`;
      writeFileSync(join(outDir, 'sw.js'), head + readFileSync(TEMPLATE, 'utf8'));
    },
  };
}
