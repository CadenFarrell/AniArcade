// The worker's install and activate, run against a fake CacheStorage and a
// fake network. The template is a classic script, not a module, so it is
// evaluated here the way the browser would: with `self`, `caches` and `fetch`
// in scope. What this pins is what a deploy costs a returning player — only
// the files whose bytes changed — and that a failed install leaves nothing
// behind. Real Cache and crypto.subtle behaviour is the browser playtest's
// offline.spec.js.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync(new URL('./serviceWorker.template.js', import.meta.url), 'utf8');

const bytes = (text) => new TextEncoder().encode(text);
// As sw/plugin.js writes them: 16 hex characters of the file's SHA-256.
const hashOf = (text) => createHash('sha256').update(bytes(text)).digest('hex').slice(0, 16);
const manifest = (files) => Object.fromEntries(Object.entries(files).map(([url, text]) => [url, hashOf(text)]));

class FakeCache {
  constructor(files = {}) {
    this.files = new Map(Object.entries(files));
  }
  async match(request) {
    const url = typeof request === 'string' ? request : request.url;
    return this.files.has(url) ? new Response(bytes(this.files.get(url))) : undefined;
  }
  async put(url, res) {
    this.files.set(url, await res.text());
  }
}

class FakeCacheStorage {
  // name -> files, in creation order, as keys() promises.
  constructor(stores = {}) {
    this.stores = new Map(Object.entries(stores).map(([name, files]) => [name, new FakeCache(files)]));
  }
  async keys() { return [...this.stores.keys()]; }
  async has(name) { return this.stores.has(name); }
  async delete(name) { return this.stores.delete(name); }
  async open(name) {
    if (!this.stores.has(name)) this.stores.set(name, new FakeCache());
    return this.stores.get(name);
  }
  contents(name) {
    return this.stores.has(name) ? Object.fromEntries(this.stores.get(name).files) : null;
  }
}

// A relative URL is fine in a worker and a TypeError under Node, so the worker
// gets a Request that only remembers what it was asked for.
class FakeRequest {
  constructor(url, init = {}) {
    this.url = url;
    this.cache = init.cache;
  }
}

/** One worker: `server` is what the network holds, `stores` what the phone does. */
function worker({ version, server, stores = {}, precache = manifest(server) }) {
  const handlers = {};
  const requests = [];
  let skipped = false;
  const caches = new FakeCacheStorage(stores);
  const self = {
    __ANIARCADE_SW__: { VERSION: version, PRECACHE: precache },
    location: { origin: 'https://arcade.test' },
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: async () => { skipped = true; },
    clients: { claim: async () => {} },
  };
  const fetch = async (request) => {
    requests.push(request);
    return request.url in server
      ? new Response(bytes(server[request.url]))
      : new Response('not found', { status: 404 });
  };
  new Function('self', 'caches', 'fetch', 'Request', SOURCE)(self, caches, fetch, FakeRequest);

  const run = async (type) => {
    let done;
    handlers[type]({ waitUntil: (promise) => { done = promise; } });
    await done;
  };
  return {
    caches,
    install: () => run('install'),
    activate: () => run('activate'),
    downloaded: () => requests.map((r) => r.url).sort(),
    requests,
    skipped: () => skipped,
  };
}

describe('the service worker install', () => {
  const v1 = {
    '/index.html': '<html>one</html>',
    '/assets/index-a1.js': 'entry one',
    '/assets/AniQuizGame-b2.js': 'quiz',
    '/art/great-wave.webp': 'a print',
    '/sounds/tap.mp3': 'tap',
  };

  it('downloads everything on a first visit, past the HTTP cache', async () => {
    const sw = worker({ version: 'v1', server: v1 });
    await sw.install();

    expect(sw.downloaded()).toEqual(Object.keys(v1).sort());
    expect(sw.requests.every((r) => r.cache === 'reload')).toBe(true);
    expect(sw.caches.contents('aniarcade-v1')).toEqual(v1);
    expect(sw.skipped()).toBe(true);
  });

  it('downloads only what a deploy changed, and copies the rest', async () => {
    const v2 = {
      ...v1,
      '/index.html': '<html>two</html>',
      '/assets/index-c3.js': 'entry two',
    };
    delete v2['/assets/index-a1.js'];
    const sw = worker({ version: 'v2', server: v2, stores: { 'aniarcade-v1': v1 } });
    await sw.install();

    expect(sw.downloaded()).toEqual(['/assets/index-c3.js', '/index.html']);
    expect(sw.caches.contents('aniarcade-v2')).toEqual(v2);
    // The previous build's cache is install's to read, never to change.
    expect(sw.caches.contents('aniarcade-v1')).toEqual(v1);
  });

  it('downloads a public/ file re-encoded under the same name', async () => {
    const v2 = { ...v1, '/sounds/tap.mp3': 'a better tap' };
    const sw = worker({ version: 'v2', server: v2, stores: { 'aniarcade-v1': v1 } });
    await sw.install();

    expect(sw.downloaded()).toEqual(['/sounds/tap.mp3']);
    expect(sw.caches.contents('aniarcade-v2')).toEqual(v2);
  });

  it('never trusts a held file by its name alone', async () => {
    // What a deploy landing mid-install leaves: hosting answers a chunk that
    // is gone with index.html and a 200, stored under the chunk's name.
    const held = { ...v1, '/assets/AniQuizGame-b2.js': '<html>one</html>' };
    const sw = worker({ version: 'v2', server: v1, stores: { 'aniarcade-v1': held } });
    await sw.install();

    expect(sw.downloaded()).toEqual(['/assets/AniQuizGame-b2.js']);
    expect(sw.caches.contents('aniarcade-v2')).toEqual(v1);
  });

  it('finds an unchanged file in any cache of ours, and in no one else\'s', async () => {
    const sw = worker({
      version: 'v3',
      server: v1,
      stores: {
        'aniarcade-v1': { '/art/great-wave.webp': v1['/art/great-wave.webp'] },
        'someone-else': { '/sounds/tap.mp3': v1['/sounds/tap.mp3'] },
        'aniarcade-v2': { '/index.html': v1['/index.html'] },
      },
    });
    await sw.install();

    expect(sw.downloaded()).toEqual(['/assets/AniQuizGame-b2.js', '/assets/index-a1.js', '/sounds/tap.mp3']);
    expect(sw.caches.contents('aniarcade-v3')).toEqual(v1);
  });

  it('fails whole when a file is missing, leaving no cache for the build', async () => {
    const sw = worker({
      version: 'v2',
      server: v1,
      precache: { ...manifest(v1), '/assets/gone-d4.js': hashOf('gone') },
      stores: { 'aniarcade-v1': v1 },
    });

    await expect(sw.install()).rejects.toThrow(/404.*gone-d4/);
    expect(sw.caches.contents('aniarcade-v2')).toBeNull();
    expect(sw.caches.contents('aniarcade-v1')).toEqual(v1);
    expect(sw.skipped()).toBe(false);
  });

  it('leaves a cache that was already whole alone when a re-install fails', async () => {
    // The same files under a changed worker: one VERSION, so one cache name.
    const sw = worker({
      version: 'v1',
      server: {},
      precache: { ...manifest(v1), '/assets/gone-d4.js': hashOf('gone') },
      stores: { 'aniarcade-v1': v1 },
    });

    await expect(sw.install()).rejects.toThrow(/404/);
    expect(sw.caches.contents('aniarcade-v1')).toEqual(v1);
  });
});

describe('the service worker activate', () => {
  it('keeps the build before this one and drops the older ones', async () => {
    const sw = worker({
      version: 'v3',
      server: { '/index.html': 'three' },
      stores: { 'aniarcade-v1': {}, 'someone-else': {}, 'aniarcade-v2': {} },
    });
    await sw.install();
    await sw.activate();

    expect(await sw.caches.keys()).toEqual(['someone-else', 'aniarcade-v2', 'aniarcade-v3']);
  });
});
