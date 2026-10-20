import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SOUND_NAMES, isSoundMuted, playCue, playSound, prefetchSounds, setSoundMuted, soundSupported,
} from './sound';

// The engine's contract with every component test in the repo: under node (and
// jsdom) there is no Web Audio, and pressing a Button must then do nothing at
// all — no fetch, no throw.
describe('sound without Web Audio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSoundMuted(false);
  });

  it('reports itself unsupported', () => {
    expect(soundSupported()).toBe(false);
  });

  it('never fetches and never throws', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    prefetchSounds();
    expect(() => playSound('tap')).not.toThrow();
    expect(() => playSound('no-such-sound')).not.toThrow();
    expect(() => playCue('correct')).not.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('remembers the mute flag it is given', () => {
    setSoundMuted(true);
    expect(isSoundMuted()).toBe(true);
    setSoundMuted(0);
    expect(isSoundMuted()).toBe(false);
  });
});

// A name with no file is a sound that silently never plays — the engine treats a
// 404 as silence, by design, so nothing else would ever say so.
describe('sound files', () => {
  it.each(SOUND_NAMES)('%s has its file in public/sounds', (name) => {
    expect(existsSync(new URL(`../../../public/sounds/${name}.mp3`, import.meta.url))).toBe(true);
  });
});
