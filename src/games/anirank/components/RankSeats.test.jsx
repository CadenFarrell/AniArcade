// @vitest-environment jsdom
//
// AniRank's row of faces: who has placed or locked in, who the subject is, and
// whose turn it is on the one local device.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import RankSeats from './RankSeats';

const players = [
  { id: 'ann', name: 'Ann' },
  { id: 'ben', name: 'Ben' },
  { id: 'cat', name: 'Cat' },
];
const seat = (name) => screen.getByText(name).closest('li');

afterEach(cleanup);

describe('AniRank seats', () => {
  it('ticks whoever has locked in, and says so in an open round', () => {
    render(<RankSeats players={players} pendingIds={['ben', 'cat']} activeId="ben" open />);
    expect(within(seat('Ann')).getByLabelText('locked in')).toBeTruthy();
    expect(within(seat('Ben')).queryByLabelText('locked in')).toBeNull();
    expect(seat('Ben').getAttribute('aria-current')).toBe('true');
  });

  it('says "placed" in a blind round, marks the subject, and shows totals when scoring', () => {
    render(
      <RankSeats players={players} pendingIds={['cat']} subjectId="cat" open={false} scores={{ ann: 30 }} />,
    );
    expect(within(seat('Ben')).getByLabelText('placed')).toBeTruthy();
    expect(within(seat('Cat')).getByText('Subject')).toBeTruthy();
    expect(within(seat('Ann')).getByText('30')).toBeTruthy();
  });

  it('dims a departed player without ticking them, and shows "You" online', () => {
    render(<RankSeats players={players} pendingIds={[]} departedIds={['cat']} youId="ann" open />);
    expect(within(seat('You')).getByLabelText('locked in')).toBeTruthy();
    expect(within(seat('Cat')).queryByLabelText('locked in')).toBeNull();
  });

  it('is not drawn for a table of one', () => {
    const { container } = render(<RankSeats players={players.slice(0, 1)} pendingIds={[]} open />);
    expect(container.innerHTML).toBe('');
  });
});
