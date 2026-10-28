// @vitest-environment jsdom
//
// The results ceremony: rows land bottom place first, then the splash. What
// this pins is the ORDER of the delays and that nothing is missing from the
// page while they run — jsdom never plays an animation, which is exactly the
// point: every name and every final number is in the DOM from the first render.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/sound', () => ({ playCue: vi.fn() }));
const { default: ResultsLayout, Awards, Splash, Standings } = await import('./Results');

const game = { id: 'demo', title: 'AniDemo', accent: 'pink' };
const players = [
  { id: 'a', name: 'Ann', total: 9, position: 1 },
  { id: 'b', name: 'Ben', total: 6, position: 2 },
  { id: 'c', name: 'Cat', total: 3, position: 3 },
];

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const page = (props = {}) => render(
  <ResultsLayout
    game={game}
    title="Final Scores"
    players={players}
    ceremony={2}
    splash={<Splash players={[players[0]]} stamp="Winner" />}
    {...props}
  >
    <Standings build ranked={players.slice(1)} score={(p) => `${p.total} pts`} />
  </ResultsLayout>,
);

const delayOf = (el) => parseInt(el.style.animationDelay, 10);

describe('the results ceremony', () => {
  it('lands the bottom place first and the winner last', () => {
    const { container } = page();
    const rows = [...container.querySelectorAll('li.reveal-row')];
    expect(rows.map((r) => r.textContent.includes('Ben'))).toEqual([true, false]);
    // Cat (third, the second row) lands before Ben (second).
    expect(delayOf(rows[1])).toBeLessThan(delayOf(rows[0]));
    const splash = container.querySelector('section.curtain-in');
    expect(delayOf(splash)).toBeGreaterThan(delayOf(rows[0]));
  });

  it('has every final number readable before anything has moved', () => {
    page();
    expect(screen.getByText('6 pts', { selector: '.sr-only' })).toBeTruthy();
    expect(screen.getByText('3 pts', { selector: '.sr-only' })).toBeTruthy();
    // The moving copies sit at their start, marked for the playtest's tally to skip.
    expect([...document.querySelectorAll('[data-count-up]')].map((n) => n.textContent)).toEqual(['0 pts', '0 pts']);
  });

  it('a press anywhere in it finishes the show', () => {
    const { container } = page();
    const root = container.querySelector('li.reveal-row').closest('div');
    root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return Promise.resolve().then(() => {
      expect(container.querySelector('[data-skip]')).toBeTruthy();
    });
  });

  it('stays a plain page without `ceremony` (between rounds)', () => {
    const { container } = page({ ceremony: null });
    expect(container.querySelector('.reveal-row, .curtain-in, [data-count-up]')).toBeNull();
    expect(screen.getByText('6 pts')).toBeTruthy();
  });
});

describe('Awards', () => {
  it('draws up to three, and nothing for none', () => {
    const awards = ['One', 'Two', 'Three', 'Four'].map((title) => ({ title, player: players[0], detail: 'why' }));
    const { container, rerender } = render(<Awards awards={awards} />);
    expect(container.querySelectorAll('li')).toHaveLength(3);
    rerender(<Awards awards={[]} />);
    expect(container.textContent).toBe('');
  });
});
