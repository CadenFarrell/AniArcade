// @vitest-environment jsdom
//
// The staged-reveal timing. What matters is less the arithmetic than the two
// ways out of it: reduced motion / a hidden tab start it finished, and a press
// finishes it — in both cases with no delay left on anything.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStagger } from './useStagger';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useStagger', () => {
  it('spaces the pieces by step after the lead, forward or reversed', () => {
    const { result } = renderHook(() => useStagger({ count: 3, stepMs: 100, leadMs: 50 }));
    expect([0, 1, 2].map(result.current.delay)).toEqual([50, 150, 250]);
    expect(result.current.totalMs).toBe(250);
    expect(result.current.style(1)).toEqual({ animationDelay: '150ms' });
    expect(result.current.rootProps['data-skip']).toBeUndefined();

    const rev = renderHook(() => useStagger({ count: 3, stepMs: 100, order: 'reverse' }));
    expect([0, 1, 2].map(rev.result.current.delay)).toEqual([200, 100, 0]);
  });

  it('a press finishes the reveal, and a new key starts the next one', () => {
    const { result, rerender } = renderHook(({ k }) => useStagger({ count: 4, key: k }), { initialProps: { k: 'r1' } });
    act(() => result.current.rootProps.onPointerDown());
    expect(result.current.skipped).toBe(true);
    expect(result.current.style(3)).toBeUndefined();
    expect(result.current.totalMs).toBe(0);
    expect(result.current.rootProps['data-skip']).toBe('');

    rerender({ k: 'r2' });
    expect(result.current.skipped).toBe(false);
    expect(result.current.delay(3)).toBe(330);
  });

  it('starts finished in a hidden tab and under reduced motion', () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const hidden = renderHook(() => useStagger({ count: 4 }));
    expect(hidden.result.current.skipped).toBe(true);
    vi.restoreAllMocks();

    vi.stubGlobal('matchMedia', vi.fn((q) => ({ matches: q.includes('reduce'), media: q })));
    const still = renderHook(() => useStagger({ count: 4 }));
    expect(still.result.current.skipped).toBe(true);
    expect(still.result.current.style(2)).toBeUndefined();
  });
});
