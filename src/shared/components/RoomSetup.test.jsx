// @vitest-environment jsdom
//
// An invite link's join (shared/utils/inviteLink.js): RoomSetup takes the code
// from the hub's InviteContext and joins by itself once there is a profile to
// join as and useRoomCore has decided about a saved room. The room is a stub —
// smoke/ covers the real join against the emulator.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import ModePicker from './ModePicker';
import RoomSetup from './RoomSetup';
import { InviteContext } from '../context/inviteContext';
import { makeProfile, renderArcade, seedProfiles } from '../testing/arcade';

vi.mock('../services/firebase', () => ({
  firebaseEnabled: true,
  getFirebaseAuth: () => { throw new Error('firebase touched'); },
  getFirebaseDb: () => { throw new Error('firebase touched'); },
  ensureSignedIn: () => { throw new Error('firebase touched'); },
}));

const stubRoom = (over = {}) => ({
  uid: 'u1', roomCode: null, error: '', joinRoom: vi.fn(async () => {}), createRoom: vi.fn(), ...over,
});
const invite = (over = {}) => ({
  gameId: 'aniguess', code: 'ABCDE', routed: true, markRouted: vi.fn(), consume: vi.fn(), ...over,
});
const mount = (room, value) => renderArcade(
  <InviteContext.Provider value={value}>
    <RoomSetup room={room} onBack={() => {}} />
  </InviteContext.Provider>,
);

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('RoomSetup with an invite', () => {
  it('joins the invited room once, as the main profile, and fills the code in', async () => {
    seedProfiles([makeProfile('Caden')]);
    const room = stubRoom();
    const value = invite();
    mount(room, value);
    await waitFor(() => expect(room.joinRoom).toHaveBeenCalledTimes(1));
    expect(room.joinRoom.mock.calls[0][0]).toBe('ABCDE');
    expect(room.joinRoom.mock.calls[0][1].id).toBe('caden');
    expect(value.consume).toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: /room code/i }).value).toBe('ABCDE');
  });

  it('waits for sign-in, and stays put in a room the device is already in', async () => {
    seedProfiles([makeProfile('Caden')]);
    const signingIn = stubRoom({ uid: null });
    mount(signingIn, invite());
    const restored = stubRoom({ roomCode: 'ZZZZZ' });
    mount(restored, invite());
    await new Promise((r) => setTimeout(r, 50));
    expect(signingIn.joinRoom).not.toHaveBeenCalled();
    expect(restored.joinRoom).not.toHaveBeenCalled();
  });

  it('asks a player with no profile for one before anything else', async () => {
    const room = stubRoom();
    mount(room, invite());
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(room.joinRoom).not.toHaveBeenCalled();
  });

  it('does nothing of the sort without an invite', async () => {
    seedProfiles([makeProfile('Caden')]);
    const room = stubRoom();
    mount(room, null);
    await new Promise((r) => setTimeout(r, 50));
    expect(room.joinRoom).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: /room code/i }).value).toBe('');
  });
});

describe('ModePicker with an invite', () => {
  const game = { id: 'aniguess', title: 'AniGuess', accent: 'pink' };
  const cover = (value, onOnline) => renderArcade(
    <InviteContext.Provider value={value}>
      <ModePicker game={game} onLocal={() => {}} onOnline={onOnline} onExit={() => {}} />
    </InviteContext.Provider>,
  );

  it('goes straight on to the online screen, once', async () => {
    const onOnline = vi.fn();
    const value = invite({ routed: false });
    cover(value, onOnline);
    await waitFor(() => expect(onOnline).toHaveBeenCalledTimes(1));
    expect(value.markRouted).toHaveBeenCalled();
  });

  it('stays on the cover when the player came Back to it', async () => {
    const onOnline = vi.fn();
    cover(invite({ routed: true }), onOnline);
    await new Promise((r) => setTimeout(r, 50));
    expect(onOnline).not.toHaveBeenCalled();
  });
});
