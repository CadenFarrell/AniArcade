// @vitest-environment jsdom
//
// The results ceremony: rows land bottom place first, then the splash. What
// this pins is the ORDER of the delays and that nothing is missing from the
// page while they run — jsdom never plays an animation, which is exactly the
// point: every name and every final number is in the DOM from the first render.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/sound', () => ({ playCue: vi.fn() }));
const { default: ResultsLayout, Awards, Splash, Standings } = await import('./Results');
const { playCue } = await import('../services/sound');
const { recordGameAchievements } = await import('../hooks/useAchievements');

const game = { id: 'demo', title: 'AniDemo', accent: 'pink' };
const players = [
  { id: 'a', name: 'Ann', total: 9, position: 1 },
  { id: 'b', name: 'Ben', total: 6, position: 2 },
  { id: 'c', name: 'Cat', total: 3, position: 3 },
];

beforeEach(() => {
  localStorage.clear();
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
  it('draws up to four, and nothing for none', () => {
    const awards = ['One', 'Two', 'Three', 'Four', 'Five'].map((title) => ({ title, player: players[0], detail: 'why' }));
    const { container, rerender } = render(<Awards awards={awards} />);
    expect(container.querySelectorAll('li')).toHaveLength(4);
    rerender(<Awards awards={[]} />);
    expect(container.textContent).toBe('');
  });

  it('names everyone it can before giving anyone a second', () => {
    const awards = [
      { title: 'One', player: players[0], detail: 'a' },
      { title: 'Two', player: players[0], detail: 'b' },
      { title: 'Three', player: players[1], detail: 'c' },
      { title: 'Four', player: players[2], detail: 'd' },
    ];
    const { container } = render(<Awards awards={awards} max={3} />);
    const rows = [...container.querySelectorAll('li')].map((li) => li.textContent);
    expect(rows).toHaveLength(3);
    for (const name of ['Ann', 'Ben', 'Cat']) expect(rows.some((r) => r.includes(name))).toBe(true);
    expect(rows.some((r) => r.includes('Two'))).toBe(false);
  });

  it('tallies what it showed once, however often it mounts', () => {
    const awards = [
      { title: 'One', player: players[0], detail: 'a' },
      { title: 'Two', player: players[1], detail: 'b', roast: true },
    ];
    render(<Awards awards={awards} />);
    cleanup();
    render(<Awards awards={awards} />); // a refresh: the same card, not a second game
    const stored = JSON.parse(localStorage.getItem('aniarcade_achievements'));
    expect(stored.a.awards).toEqual({ One: 1 });
    expect(stored.b).toMatchObject({ awards: { Two: 1 }, roasts: 1 });
  });
});

// The "Unlocked" card is the ceremony's last beat: places, the winner's stamp,
// then the card with its chime. It first shipped silent because it showed at
// once, where a sound would have played before the stamp.
describe('the Unlocked card', () => {
  const finalScreen = (ceremony = 2) => render(
    <ResultsLayout
      game={game}
      title="Final Scores"
      players={players}
      ceremony={ceremony}
      splash={<Splash players={[players[0]]} stamp="Winner" />}
    >
      <Standings build ranked={players.slice(1)} score={(p) => `${p.total} pts`} />
      <Awards />
    </ResultsLayout>,
  );
  // What the game's results screen does in its own effect, after the card has
  // mounted: Ann's first game, and her first win.
  const unlock = () => act(() => recordGameAchievements(
    { a: { at: Date.now(), game: 'aniquiz', won: true, place: 1, size: 3, with: ['Ben', 'Cat'] } },
    {},
    { a: 'Ann' },
  ));
  const cues = () => playCue.mock.calls.map(([name]) => name);

  beforeEach(() => {
    vi.useFakeTimers();
    playCue.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('lands after the winner, and chimes once, a beat after the stamp', () => {
    const { container } = finalScreen();
    unlock();
    const card = screen.getByRole('heading', { name: 'Unlocked' }).closest('.reveal-row');
    expect(card.textContent).toMatch(/First game.*First win/);
    const splash = container.querySelector('section.curtain-in');
    expect(delayOf(card)).toBeGreaterThan(delayOf(splash));

    act(() => vi.advanceTimersByTime(delayOf(splash)));
    expect(cues()).toContain('stamp');
    expect(cues()).not.toContain('unlock');
    act(() => vi.advanceTimersByTime(delayOf(card) - delayOf(splash)));
    expect(cues().filter((c) => c === 'unlock')).toHaveLength(1);
  });

  it('shows at once and stays silent when the table presses through', () => {
    const { container } = finalScreen();
    unlock();
    act(() => {
      container.querySelector('li.reveal-row').closest('div')
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    const card = screen.getByRole('heading', { name: 'Unlocked' }).closest('.reveal-row');
    expect(card.style.animationDelay).toBe('');
    act(() => vi.advanceTimersByTime(10_000));
    expect(cues()).not.toContain('unlock');
  });

  it('under reduced motion is there at once, and still chimes', () => {
    vi.stubGlobal('matchMedia', vi.fn((q) => ({ matches: q.includes('reduce'), media: q })));
    finalScreen();
    unlock();
    expect(screen.getByRole('heading', { name: 'Unlocked' }).closest('.reveal-row').style.animationDelay).toBe('');
    act(() => vi.advanceTimersByTime(0));
    expect(cues().filter((c) => c === 'unlock')).toHaveLength(1);
  });

  it('with no ceremony is a plain card, its chime a beat clear of the stamp', () => {
    finalScreen(null);
    unlock();
    expect(screen.getByRole('heading', { name: 'Unlocked' }).closest('.reveal-row')).toBeNull();
    expect(cues()).toEqual(['stamp']);
    act(() => vi.advanceTimersByTime(700));
    expect(cues()).toEqual(['stamp', 'unlock']);
  });
});
