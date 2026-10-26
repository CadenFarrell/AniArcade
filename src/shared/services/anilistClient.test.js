import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { anilistRequest, resetAnilistClientForTests } from './anilistClient';

// The limiter against a fake AniList: each test hands fetch a script of
// responses. Fake timers, so "did it wait" is a question about the clock rather
// than about how long the test took.

const ok = (remaining) => ({
  status: 200,
  ok: true,
  headers: new Headers({ 'X-RateLimit-Limit': '30', 'X-RateLimit-Remaining': String(remaining) }),
  json: async () => ({ data: { ok: true } }),
});

// What a browser sees on a 429: CORS hides Retry-After, so only the reset is
// readable.
const locked = (resetAtMs) => ({
  status: 429,
  ok: false,
  headers: new Headers({
    'X-RateLimit-Limit': '30',
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': String(Math.floor(resetAtMs / 1000)),
  }),
  json: async () => ({ errors: [{ message: 'Too Many Requests.' }] }),
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-26T12:00:00Z'));
  resetAnilistClientForTests();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('anilistRequest', () => {
  it('spends the window without spacing requests out', async () => {
    let left = 29;
    const fetch = vi.fn(async () => ok(left--));
    vi.stubGlobal('fetch', fetch);

    for (let i = 0; i < 8; i++) await anilistRequest('query { a }', {});
    expect(fetch).toHaveBeenCalledTimes(8);
    // The old throttle would have put 2.2s between each of these.
    expect(Date.now()).toBe(new Date('2026-10-26T12:00:00Z').getTime());
  });

  it('waits out a 429 until the reset it names, not zero seconds', async () => {
    const start = Date.now();
    const fetch = vi.fn()
      .mockResolvedValueOnce(locked(start + 20000))
      .mockResolvedValueOnce(ok(29));
    vi.stubGlobal('fetch', fetch);

    const done = anilistRequest('query { a }', {});
    await vi.advanceTimersByTimeAsync(15000);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetch).toHaveBeenCalledTimes(2);
    await expect(done).resolves.toEqual({ ok: true });
  });

  it('lets a cancel through a lockout instead of sleeping it out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(locked(Date.now() + 60000)));
    const controller = new AbortController();

    const done = anilistRequest('query { a }', {}, { signal: controller.signal });
    const settled = expect(done).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1000);
    controller.abort();
    await settled;
  });

  it('sends one request until a response says what is left, then several at once', async () => {
    const pending = [];
    const fetch = vi.fn(() => new Promise((resolve) => pending.push(resolve)));
    vi.stubGlobal('fetch', fetch);

    const all = Promise.all(Array.from({ length: 6 }, () => anilistRequest('query { a }', {})));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);

    pending.shift()(ok(29));
    await vi.advanceTimersByTimeAsync(0);
    // Capped at four in flight, however much allowance is left.
    expect(fetch).toHaveBeenCalledTimes(5);

    while (pending.length) {
      pending.shift()(ok(20));
      await vi.advanceTimersByTimeAsync(0);
    }
    await all;
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it('holds back once the allowance left is spoken for', async () => {
    const pending = [];
    const fetch = vi.fn(() => new Promise((resolve) => pending.push(resolve)));
    vi.stubGlobal('fetch', fetch);

    const all = Promise.all(Array.from({ length: 4 }, () => anilistRequest('query { a }', {})));
    await vi.advanceTimersByTimeAsync(0);
    pending.shift()(ok(2));
    await vi.advanceTimersByTimeAsync(0);
    // Two left in the window: two go, the third waits.
    expect(fetch).toHaveBeenCalledTimes(3);

    pending.shift()(ok(1));
    await vi.advanceTimersByTimeAsync(0);
    pending.shift()(ok(0));
    await vi.advanceTimersByTimeAsync(0);
    // A spent window with nothing out still lets one through to learn the reset.
    expect(fetch).toHaveBeenCalledTimes(4);
    pending.shift()(ok(29));
    await all;
  });
});
