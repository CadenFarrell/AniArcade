// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/sound', () => ({ playCue: vi.fn() }));
const { playCue } = await import('../services/sound');
const { useStepCues } = await import('./useStepCues');

const steps = [{ atMs: 0, name: 'reveal' }, { atMs: 300, name: 'select' }, { atMs: 600, name: 'stamp' }];

beforeEach(() => { playCue.mockClear(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('useStepCues', () => {
  it('plays each step at its time, once per key', () => {
    const { rerender } = renderHook(({ k }) => useStepCues(steps, k), { initialProps: { k: 'r1' } });
    vi.advanceTimersByTime(1000);
    rerender({ k: 'r1' });
    vi.advanceTimersByTime(1000);
    expect(playCue.mock.calls.map((c) => c[0])).toEqual(['reveal', 'select', 'stamp']);
  });

  it('drops the pending steps when the reveal is skipped', () => {
    const { rerender } = renderHook(({ s }) => useStepCues(steps, 'r1', { skip: s }), { initialProps: { s: false } });
    vi.advanceTimersByTime(350);
    rerender({ s: true });
    vi.advanceTimersByTime(1000);
    expect(playCue.mock.calls.map((c) => c[0])).toEqual(['reveal', 'select']);
  });

  it('under reduced motion sounds only the first step, at once', () => {
    vi.stubGlobal('matchMedia', vi.fn((q) => ({ matches: q.includes('reduce'), media: q })));
    renderHook(() => useStepCues(steps, 'r1'));
    vi.advanceTimersByTime(1000);
    expect(playCue.mock.calls.map((c) => c[0])).toEqual(['reveal']);
  });

  it('is silent after unmount', () => {
    const { unmount } = renderHook(() => useStepCues(steps, 'r1'));
    vi.advanceTimersByTime(10);
    unmount();
    vi.advanceTimersByTime(1000);
    expect(playCue.mock.calls.map((c) => c[0])).toEqual(['reveal']);
  });
});
