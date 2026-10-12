// @vitest-environment jsdom
//
// The reveal's score count-up runs on requestAnimationFrame, and a BACKGROUND TAB
// DOES NOT RUN rAF — so a reveal that landed while the player was looking away
// froze every total at +0 (see the prefersStill comment in RevealScreen). That
// self-heals the moment someone looks, which is why only a test catches it.
//
// rAF is stubbed to never fire in every case here. That is the background tab,
// literally: whatever renders is all that will ever render.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import RevealScreen from './RevealScreen';
import { SPECTRA } from '../spectra';

const players = [
  { id: 'ann', name: 'Ann' },
  { id: 'ben', name: 'Ben' },
  { id: 'cat', name: 'Cat' },
];

const props = {
  spectrum: SPECTRA[0],
  target: 60,
  players,
  psychic: players[0],
  explain: [
    { playerId: 'ben', placed: true, value: 58, distance: 2, points: 4 },
    { playerId: 'cat', placed: false, value: null, distance: null, points: 0 },
  ],
  roundScores: { ann: 2, ben: 4, cat: 0 },
  abandoned: false,
  isFinalRound: false,
  onNext: () => {},
  onResults: () => {},
};

const badges = () => screen.getAllByText(/^\+\d+$/).map((el) => el.textContent);

let hidden;
beforeEach(() => {
  hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AniWave reveal scores', () => {
  it('counts up from zero in a visible tab (the case the fix must not change)', () => {
    render(<RevealScreen {...props} />);
    expect(badges()).toEqual(['+0', '+0', '+0']);
    expect(requestAnimationFrame).toHaveBeenCalled();
  });

  it('shows the finished scores in a hidden tab, with no animation to wait on', () => {
    hidden = true;
    render(<RevealScreen {...props} />);
    // Ben, Cat (no dial), then the psychic's average.
    expect(badges()).toEqual(['+4', '+0', '+2']);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('shows the finished scores under prefers-reduced-motion', () => {
    vi.stubGlobal('matchMedia', vi.fn((q) => ({ matches: q.includes('reduce'), media: q })));
    render(<RevealScreen {...props} />);
    expect(badges()).toEqual(['+4', '+0', '+2']);
  });

  it('does not restart round one\'s count when round two arrives in a hidden tab', () => {
    hidden = true;
    const { rerender } = render(<RevealScreen {...props} />);
    rerender(<RevealScreen
      {...props}
      explain={[{ ...props.explain[0], points: 1 }, props.explain[1]]}
      roundScores={{ ann: 3, ben: 1, cat: 0 }}
    />);
    expect(badges()).toEqual(['+1', '+0', '+3']);
  });

  it('tells a player with no dial apart from one who dialled badly', () => {
    render(<RevealScreen {...props} />);
    expect(screen.getByText(/off by 2/)).toBeTruthy();
    expect(screen.getByText(/no dial/)).toBeTruthy();
  });

  it('draws no scores and no dial for a round abandoned before a spectrum', () => {
    render(<RevealScreen {...props} spectrum={null} abandoned />);
    expect(screen.getByText(/round abandoned/i)).toBeTruthy();
    expect(screen.getByText(/ended before a spectrum was chosen/i)).toBeTruthy();
    expect(screen.queryAllByText(/^\+\d+$/)).toEqual([]);
  });
});
