// @vitest-environment jsdom
//
// AniWave's row of faces: who is the psychic, whose turn it is, and which dials
// are in — and never anything about where a dial sits.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import WaveSeats from './WaveSeats';

const players = [
  { id: 'ann', name: 'Ann' },
  { id: 'ben', name: 'Ben' },
  { id: 'cat', name: 'Cat' },
];
const seat = (name) => screen.getByText(name).closest('li');

afterEach(cleanup);

describe('AniWave seats', () => {
  it('marks the psychic and puts NOW on whoever holds the device', () => {
    render(<WaveSeats players={players} psychicId="ann" activeId="ben" scores={{ ann: 4, ben: 2 }} />);
    expect(within(seat('Ann')).getByText('Psychic')).toBeTruthy();
    expect(seat('Ben').getAttribute('aria-current')).toBe('true');
    expect(within(seat('Ann')).getByText('4')).toBeTruthy();
    expect(within(seat('Cat')).getByText('0')).toBeTruthy();
  });

  it('ticks the dials that are in during the guess phase, and only those', () => {
    render(<WaveSeats players={players} psychicId="ann" pendingIds={['cat']} />);
    expect(within(seat('Ben')).getByLabelText('dialled')).toBeTruthy();
    expect(within(seat('Cat')).queryByLabelText('dialled')).toBeNull();
    // The psychic never dials.
    expect(within(seat('Ann')).queryByLabelText('dialled')).toBeNull();
  });

  it('draws no ticks outside the guess phase, and nothing for a table of one', () => {
    render(<WaveSeats players={players} psychicId="ann" />);
    expect(screen.queryAllByLabelText('dialled')).toHaveLength(0);
    cleanup();
    const { container } = render(<WaveSeats players={players.slice(0, 1)} />);
    expect(container.innerHTML).toBe('');
  });
});
