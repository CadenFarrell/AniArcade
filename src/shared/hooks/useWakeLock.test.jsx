// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useWakeLock } from './useWakeLock';

// A stand-in for navigator.wakeLock: jsdom has none. Each request hands out a
// sentinel the test can see released — by the hook, or by the "browser" when
// the page is hidden.
function fakeWakeLock() {
  const locks = [];
  const api = {
    request: vi.fn(async () => {
      const lock = { released: false, release: vi.fn(async () => { lock.released = true; }) };
      locks.push(lock);
      return lock;
    }),
  };
  return { api, locks };
}

const setVisibility = (state) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('useWakeLock', () => {
  let fake;
  beforeEach(() => {
    fake = fakeWakeLock();
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: fake.api });
    setVisibility('visible');
  });
  afterEach(() => {
    delete navigator.wakeLock;
  });

  it('holds the screen on while active and lets go when it stops', async () => {
    const { rerender } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: true } });
    await act(async () => {});
    expect(fake.api.request).toHaveBeenCalledWith('screen');
    expect(fake.locks).toHaveLength(1);

    rerender({ on: false });
    await act(async () => {});
    expect(fake.locks[0].release).toHaveBeenCalled();
  });

  it('asks nothing while inactive', async () => {
    renderHook(() => useWakeLock(false));
    await act(async () => {});
    expect(fake.api.request).not.toHaveBeenCalled();
  });

  it('asks again when the page comes back, since hiding it dropped the lock', async () => {
    renderHook(() => useWakeLock(true));
    await act(async () => {});
    // The browser's own release on hide.
    fake.locks[0].released = true;
    await act(async () => { setVisibility('hidden'); });
    expect(fake.api.request).toHaveBeenCalledTimes(1);
    await act(async () => { setVisibility('visible'); });
    expect(fake.api.request).toHaveBeenCalledTimes(2);
  });

  it('does not stack a second lock on one it still holds', async () => {
    renderHook(() => useWakeLock(true));
    await act(async () => {});
    await act(async () => { setVisibility('visible'); });
    expect(fake.api.request).toHaveBeenCalledTimes(1);
  });

  it('releases on unmount', async () => {
    const { unmount } = renderHook(() => useWakeLock(true));
    await act(async () => {});
    unmount();
    expect(fake.locks[0].release).toHaveBeenCalled();
  });

  it('is silent when the browser has no Wake Lock or refuses it', async () => {
    delete navigator.wakeLock;
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();

    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: vi.fn(async () => { throw new Error('NotAllowedError'); }) },
    });
    renderHook(() => useWakeLock(true));
    await act(async () => {});
  });
});
