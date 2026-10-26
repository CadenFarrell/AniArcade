// @vitest-environment jsdom
//
// The full play record: the screen itself over a seeded history, and the two
// ways into it from the hub — the record strip (the main profile) and a row of
// the profile picker (anyone on this device), each with its own way back.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HubScreen from './HubScreen';
import RecordScreen from './RecordScreen';
import { games } from './registry';
import { HISTORY_KEY, addEntries, entriesForGame } from '../shared/utils/history';
import { makeProfile, renderArcade, seedProfiles } from '../shared/testing/arcade';

vi.mock('../shared/services/firebase', () => ({
  firebaseEnabled: false,
  getFirebaseAuth: () => { throw new Error('firebase touched'); },
  getFirebaseDb: () => { throw new Error('firebase touched'); },
  ensureSignedIn: () => { throw new Error('firebase touched'); },
}));

const T0 = 1_800_000_000_000;
const HOUR = 3_600_000;
const caden = makeProfile('Caden');
const ayu = makeProfile('Ayu');
const table = [{ id: 'caden', name: 'Caden' }, { id: 'ayu', name: 'Ayu' }];

// `n` quiz games at Caden and Ayu's table, Caden winning the first `wins`,
// recorded for both the way a local results screen does.
function seedGames(n, wins) {
  let h = {};
  for (let i = 0; i < n; i++) {
    const winner = i < wins ? 'caden' : 'ayu';
    const loser = winner === 'caden' ? 'ayu' : 'caden';
    h = addEntries(h, entriesForGame({
      game: 'aniquiz', table, winnerIds: [winner],
      places: { [winner]: 1, [loser]: 2 }, scores: { [winner]: 10 + i, [loser]: i },
      forIds: ['caden', 'ayu'], at: T0 + i * HOUR,
    }));
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

const afterWipe = () => waitFor(() => expect(document.querySelector('[data-wipe]')).toBeNull());

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => cleanup());

describe('RecordScreen', () => {
  it('shows totals, the game, head-to-head and the log', () => {
    seedProfiles([caden, ayu]);
    seedGames(5, 3);
    renderArcade(<RecordScreen profile={caden} games={games} onBack={() => {}} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Caden' })).toBeTruthy();
    expect(document.querySelector('header').textContent).toMatch(/5 games · 3 wins · 60%/);
    expect(screen.getByRole('heading', { name: 'AniQuiz' })).toBeTruthy();
    expect(screen.getByText('3 of 5')).toBeTruthy();
    expect(screen.getByText('1st')).toBeTruthy();
    expect(screen.getByText('You 3, Ayu 2')).toBeTruthy();
    expect(screen.getByText(/5 games together/i)).toBeTruthy();
    // Caden won the first three, then lost two: the best run is three.
    expect(screen.getByText(/best streak/i).textContent).toMatch(/3 wins/);
  });

  it('shows the log a page at a time', async () => {
    const user = userEvent.setup();
    seedProfiles([caden, ayu]);
    seedGames(25, 25);
    renderArcade(<RecordScreen profile={caden} games={games} onBack={() => {}} />);
    const log = () => within(screen.getByText('Every game').closest('.card-pop')).getAllByRole('listitem');

    expect(log()).toHaveLength(20);
    await user.click(screen.getByRole('button', { name: /show more/i }));
    expect(log()).toHaveLength(25);
    expect(screen.queryByRole('button', { name: /show more/i })).toBeNull();
  });

  it('says so when a profile has no games', () => {
    seedProfiles([caden]);
    renderArcade(<RecordScreen profile={caden} games={games} onBack={() => {}} />);
    expect(screen.getByText(/no games yet/i)).toBeTruthy();
  });
});

describe('the ways in', () => {
  it('opens the main profile from the strip, and goes back to the hub', async () => {
    const user = userEvent.setup();
    seedProfiles([caden, ayu]);
    seedGames(2, 1);
    renderArcade(<HubScreen />);
    await afterWipe();

    await user.click(await screen.findByRole('button', { name: /see full record/i }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Caden' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '← Hub' }));
    expect(await screen.findByRole('button', { name: /see full record/i })).toBeTruthy();
  });

  it("opens a friend's record from the profile picker, and goes back to the picker", async () => {
    const user = userEvent.setup();
    seedProfiles([caden, ayu]);
    seedGames(2, 1);
    renderArcade(<HubScreen />);
    await afterWipe();

    await user.click(screen.getByRole('button', { name: /^profile: caden/i }));
    await user.click(await screen.findByRole('button', { name: "Ayu's record" }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ayu' })).toBeTruthy();
    expect(screen.getByText('You 1, Caden 1')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '← Profiles' }));
    expect(await screen.findByRole('button', { name: "Ayu's record" })).toBeTruthy();
  });
});
