import { afterEach, describe, expect, it, vi } from 'vitest';
import { lazyGame, preloadGames } from './lazyGame';

afterEach(() => vi.unstubAllGlobals());

describe('lazyGame', () => {
  it('shares one download between the background preload and a tap', async () => {
    const load = vi.fn(async () => ({ default: () => null }));
    const Game = lazyGame(load);
    const [a, b] = await Promise.all([Game.preload(), Game.preload()]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('tags a failed download, and forgets it so the next tap retries', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValueOnce({ default: () => null });
    const Game = lazyGame(load);

    const err = await Game.preload().catch((e) => e);
    // The tag is what lets ErrorBoundary offer a reload instead of a reset.
    expect(err.gameLoad).toBe(true);
    expect(err.cause).toBeInstanceOf(TypeError);

    await expect(Game.preload()).resolves.toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('preloadGames', () => {
  const game = (available = true) => {
    const preload = vi.fn(async () => ({}));
    return { available, Component: { preload } };
  };
  const now = (run) => { run(); return 1; };

  it('preloads every available game once the browser is idle', () => {
    const games = [game(), game(false), game()];
    preloadGames(games, { idle: now });
    expect(games.map((g) => g.Component.preload.mock.calls.length)).toEqual([1, 0, 1]);
  });

  it('downloads nothing under Data Saver', () => {
    vi.stubGlobal('navigator', { connection: { saveData: true } });
    const games = [game()];
    preloadGames(games, { idle: now });
    expect(games[0].Component.preload).not.toHaveBeenCalled();
  });

  it('swallows a failed preload — the tap retries it', async () => {
    const failing = { available: true, Component: { preload: () => Promise.reject(new Error('offline')) } };
    expect(() => preloadGames([failing], { idle: now })).not.toThrow();
    // An unhandled rejection would fail the run after this tick.
    await new Promise((r) => setTimeout(r, 0));
  });
});
