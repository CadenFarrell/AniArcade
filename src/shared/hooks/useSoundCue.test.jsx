// @vitest-environment jsdom
import { StrictMode } from 'react';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/sound', () => ({ playCue: vi.fn() }));
const { playCue } = await import('../services/sound');
const { useCountdownCue, useSoundCue } = await import('./useSoundCue');

beforeEach(() => playCue.mockClear());

describe('useSoundCue', () => {
  it('plays once on mount for a key, and not again on a re-render', () => {
    const { rerender } = renderHook(({ k }) => useSoundCue('reveal', k), { initialProps: { k: 'r1' } });
    rerender({ k: 'r1' });
    expect(playCue.mock.calls).toEqual([['reveal']]);
  });

  it('is silent for null and false, and plays each NEW key once', () => {
    const { rerender } = renderHook(({ k }) => useSoundCue('turn', k), { initialProps: { k: null } });
    rerender({ k: false });
    expect(playCue).not.toHaveBeenCalled();
    rerender({ k: 'a' });
    rerender({ k: 'b' });
    expect(playCue).toHaveBeenCalledTimes(2);
  });

  it('does not replay a key it already sounded for after a gap', () => {
    const { rerender } = renderHook(({ k }) => useSoundCue('turn', k), { initialProps: { k: 'a' } });
    rerender({ k: null });
    rerender({ k: 'a' });
    expect(playCue).toHaveBeenCalledTimes(1);
  });

  it('plays nothing when only the name changes under the same key', () => {
    const { rerender } = renderHook(({ n }) => useSoundCue(n, 'q1'), { initialProps: { n: 'wrong' } });
    rerender({ n: 'correct' });
    expect(playCue.mock.calls).toEqual([['wrong']]);
  });

  it('survives StrictMode double effects without playing twice', () => {
    renderHook(() => useSoundCue('stamp', 'w'), { wrapper: StrictMode });
    expect(playCue).toHaveBeenCalledTimes(1);
  });
});

describe('useCountdownCue', () => {
  const run = (start, running = true) => renderHook(
    ({ s, r }) => useCountdownCue(s, r),
    { initialProps: { s: start, r: running } },
  );

  it('ticks through the last five seconds and buzzes at zero', () => {
    const { rerender } = run(8);
    for (const s of [7, 6, 5, 4, 3, 2, 1, 0]) rerender({ s, r: true });
    expect(playCue.mock.calls.map((c) => c[0])).toEqual(['tick', 'tick', 'tick', 'tick', 'tick', 'timeup']);
  });

  it('is silent mounting at zero, going back up, or while not running', () => {
    const { rerender } = run(0);
    rerender({ s: 30, r: true });
    rerender({ s: 4, r: false });
    rerender({ s: 3, r: false });
    expect(playCue).not.toHaveBeenCalled();
  });
});
