import { describe, it, expect } from 'vitest';
import { precacheList } from './precache';

describe('precacheList', () => {
  const build = [
    'index.html',
    'assets/index-a1.js',
    'assets/AniQuizGame-b2.js',
    'assets/index-c3.css',
    'assets/index-a1.js.map',
    'facts/index.json',
    'facts/pack-v5.json',
    'facts/pack-v4.json',
    'casts/index.json',
    'casts/v1/30.json',
    'fonts/oswald-latin.woff2',
    'sounds/tap.mp3',
    'art/great-wave.webp',
    'icons/icon-192.png',
    'manifest.webmanifest',
    'favicon.svg',
    'og.png',
    'sw.js',
    '.well-known/thing',
  ];

  it('keeps everything local play can ask for, as sorted root URLs', () => {
    expect(precacheList(build, 'pack-v5.json')).toEqual([
      '/art/great-wave.webp',
      '/assets/AniQuizGame-b2.js',
      '/assets/index-a1.js',
      '/assets/index-c3.css',
      '/facts/index.json',
      '/facts/pack-v5.json',
      '/favicon.svg',
      '/fonts/oswald-latin.woff2',
      '/icons/icon-192.png',
      '/index.html',
      '/manifest.webmanifest',
      '/sounds/tap.mp3',
    ]);
  });

  it('leaves the cast pack to the network', () => {
    expect(precacheList(build, 'pack-v5.json').filter((u) => u.startsWith('/casts/'))).toEqual([]);
  });

  it('stores only the pack the index names', () => {
    const list = precacheList(build, 'pack-v4.json');
    expect(list).toContain('/facts/pack-v4.json');
    expect(list).not.toContain('/facts/pack-v5.json');
  });

  it('is the same list whatever order the build was walked in', () => {
    expect(precacheList([...build].reverse(), 'pack-v5.json')).toEqual(precacheList(build, 'pack-v5.json'));
  });
});
