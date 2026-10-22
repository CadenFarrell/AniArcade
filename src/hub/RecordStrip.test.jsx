// @vitest-environment jsdom
//
// Play history end to end on one device: a final results screen records the
// game for every seated profile (useRecordResult), and the hub's strip shows
// the main profile's record. A results screen is mounted directly — playing a
// whole game here would test the game, not the history.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import RecordStrip from './RecordStrip';
import { games } from './registry';
import QuizResults from '../games/aniquiz/components/QuizResults';
import { HistoryScopeContext } from '../shared/context/historyScopeContext';
import { HISTORY_KEY } from '../shared/utils/history';
import { makeProfile, renderArcade, seedProfiles } from '../shared/testing/arcade';

vi.mock('../shared/services/firebase', () => ({
  firebaseEnabled: false,
  getFirebaseAuth: () => { throw new Error('firebase touched'); },
  getFirebaseDb: () => { throw new Error('firebase touched'); },
  ensureSignedIn: () => { throw new Error('firebase touched'); },
}));

const table = [{ id: 'caden', name: 'Caden' }, { id: 'ayu', name: 'Ayu' }];
const stored = () => JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '{}');
const finishQuiz = (scope = null) => renderArcade(
  <HistoryScopeContext.Provider value={scope}>
    <QuizResults players={table} scores={{ caden: 7, ayu: 3 }} onPlayAgain={() => {}} />
  </HistoryScopeContext.Provider>,
);

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('play history', () => {
  it('records a finished local game for every seated profile, once', () => {
    finishQuiz();
    cleanup();
    finishQuiz(); // a remount of the same results — a refresh — is not a second game
    const h = stored();
    expect(h.caden).toHaveLength(1);
    expect(h.caden[0]).toMatchObject({ game: 'aniquiz', won: true, place: 1, score: 7, with: ['Ayu'] });
    expect(h.ayu[0]).toMatchObject({ won: false, place: 2, with: ['Caden'] });
  });

  it('online, records only this device\'s own player', () => {
    finishQuiz({ onlyId: 'ayu' });
    expect(Object.keys(stored())).toEqual(['ayu']);
  });

  it('shows the main profile\'s record under the board', () => {
    seedProfiles([makeProfile('Caden')]);
    finishQuiz();
    cleanup();
    renderArcade(<RecordStrip profile={{ id: 'caden', name: 'Caden' }} games={games} />);
    expect(screen.getByText(/1 game/i)).toBeTruthy();
    expect(screen.getByText('AniQuiz: 1 of 1 won')).toBeTruthy();
    expect(screen.getByText('with Ayu')).toBeTruthy();
  });

  it('says so when there is nothing yet, and stays out of the way with no profile', () => {
    const { container } = renderArcade(<RecordStrip profile={null} games={games} />);
    expect(container.textContent).toBe('');
    cleanup();
    renderArcade(<RecordStrip profile={{ id: 'caden', name: 'Caden' }} games={games} />);
    expect(screen.getByText(/no games yet/i)).toBeTruthy();
  });
});
