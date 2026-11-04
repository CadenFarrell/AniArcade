// @vitest-environment jsdom
//
// The online clip player's two promises to the room:
//   - a phone that cannot load the clip still reports ready, so it can never
//     hold every other phone on "Waiting for everyone…" (which, in
//     everyone-guesses, nothing else could end);
//   - once the game's shared <audio> has been unlocked by one tap, later songs
//     report ready by themselves, with no "Tap when ready".
// Audio is the bots' media stub (playtest/fakes/media.js): load() fires
// loadedmetadata on the next microtask, or `error` for a src containing
// "broken".
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { installMediaStubs } from '../../../../playtest/fakes/media.js';
import SyncedClipPlayer from './SyncedClipPlayer';
import { createPrimedAudio } from '../hooks/usePrimedAudio';

vi.mock('../../../shared/services/firebase', () => ({ firebaseEnabled: false }));

beforeAll(() => installMediaStubs());
afterEach(cleanup);

// Lets the stub's queued loadedmetadata / error land.
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('SyncedClipPlayer', () => {
  it('reports ready when its clip will not load, and says the player can still answer', async () => {
    const onReady = vi.fn();
    const onUnplayable = vi.fn();
    render(<SyncedClipPlayer src="https://cdn.test/broken.ogg" onReady={onReady} onUnplayable={onUnplayable} />);
    await settle();
    expect(onUnplayable).toHaveBeenCalled();
    expect(onReady).toHaveBeenCalled();
    expect(screen.getByText(/couldn.t load the clip/i)).toBeTruthy();
    expect(screen.queryByText(/tap when ready/i)).toBeNull();
  });

  it('asks for the tap on the first song, then readies later songs by itself', async () => {
    const shared = createPrimedAudio();
    const first = vi.fn();
    const { unmount } = render(<SyncedClipPlayer src="https://cdn.test/one.ogg" shared={shared} onReady={first} />);
    await settle();
    expect(first).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /tap when ready/i }));
    expect(first).toHaveBeenCalledTimes(1);
    await settle();
    expect(shared.primed).toBe(true);
    unmount();

    const second = vi.fn();
    render(<SyncedClipPlayer src="https://cdn.test/two.ogg" shared={shared} onReady={second} waitingOn={['Gavin']} />);
    await settle();
    expect(second).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /tap when ready/i })).toBeNull();
    // And while the room waits, it names who on.
    expect(screen.getByText('Waiting on Gavin…')).toBeTruthy();
  });
});
