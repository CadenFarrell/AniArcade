// @vitest-environment jsdom
//
// CountUp's promise is that the moving number never matters to anything that
// READS the screen: the sr-only copy is final from the first render, and the
// moving copy is marked so the playtest's tally skips it. rAF is stubbed to
// never fire, which freezes the moving copy at its start for the whole test.
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CountUp from './CountUp';

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const copies = (container) => {
  const moving = container.querySelector('[data-count-up]');
  return { moving: moving.textContent, final: moving.nextSibling.textContent, hidden: moving.getAttribute('aria-hidden') };
};

describe('CountUp', () => {
  it('moves from `from` on screen while the readable copy is already final', () => {
    const { container } = render(<CountUp value={12} from={5} />);
    expect(copies(container)).toEqual({ moving: '5', final: '12', hidden: 'true' });
  });

  it('counts down as readily as up, and formats both copies', () => {
    const { container } = render(<CountUp value={-400} from={600} format={(n) => `${n} pts`} />);
    expect(copies(container)).toEqual({ moving: '600 pts', final: '-400 pts', hidden: 'true' });
  });

  it('a skipped reveal shows the final number at once', () => {
    const { container } = render(<CountUp value={9} skip />);
    expect(copies(container).moving).toBe('9');
  });

  it('a hidden tab shows the final number at once (rAF never runs there)', () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const { container } = render(<CountUp value={7} from={2} />);
    expect(copies(container).moving).toBe('7');
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
});
