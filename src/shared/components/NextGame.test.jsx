// @vitest-environment jsdom
//
// Next game, same table (shared/utils/handoff.js), on the screens: the host's
// picker under a room's final results, the follow screen every other device
// switches to, and the new game's RoomSetup making the room and writing its
// code back. The room and the hub are stubs — smoke/handoff.smoke.test.js
// runs the writes against the emulator.
import { StrictMode, useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import ModePicker from './ModePicker';
import ResultsLayout from './Results';
import RoomSetup from './RoomSetup';
import RoomShell from './RoomShell';
import { InviteContext } from '../context/inviteContext';
import { makeProfile, renderArcade, seedProfiles } from '../testing/arcade';

vi.mock('../services/firebase', () => ({
  firebaseEnabled: true,
  getFirebaseAuth: () => { throw new Error('firebase touched'); },
  getFirebaseDb: () => { throw new Error('firebase touched'); },
  ensureSignedIn: () => { throw new Error('firebase touched'); },
}));

const anipeek = { id: 'anipeek', title: 'AniPeek', accent: 'slate', available: true };
const anitune = { id: 'anitune', title: 'AniTune', accent: 'blue', available: true };
const players = [{ id: 'ana', name: 'Ana' }, { id: 'ben', name: 'Ben' }];

const stubRoom = (over = {}) => ({
  uid: 'u1',
  roomCode: 'AAAAA',
  myPlayerId: 'ana',
  isHost: true,
  players,
  dropping: [],
  syncError: '',
  error: '',
  leaveRoom: vi.fn(),
  createRoom: vi.fn(async () => 'NEWRM'),
  joinRoom: vi.fn(async () => {}),
  ...over,
  handoff: {
    next: null,
    start: vi.fn(async () => {}),
    announce: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    ...over.handoff,
  },
});
const invite = (over = {}) => ({
  gameId: 'anipeek',
  code: null,
  routed: true,
  markRouted: vi.fn(),
  consume: vi.fn(),
  handoff: null,
  nextGames: [anitune],
  follow: vi.fn(() => true),
  ...over,
});

// A final results screen, as an OnlineGame renders one.
const results = (room, value, nextGame = true) => renderArcade(
  <InviteContext.Provider value={value}>
    <RoomShell room={room} onExit={() => {}} nextGame={nextGame}>
      <ResultsLayout game={anipeek} title="Final Scores" players={players} />
    </RoomShell>
  </InviteContext.Provider>,
);

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('the host picks the next game', () => {
  it('writes the pick into this room, then follows it out', async () => {
    const room = stubRoom();
    const value = invite();
    results(room, value);
    fireEvent.click(screen.getByRole('button', { name: 'Play AniTune next' }));
    await waitFor(() => expect(value.follow).toHaveBeenCalledTimes(1));
    expect(room.handoff.start).toHaveBeenCalledWith('anitune');
    expect(value.follow).toHaveBeenCalledWith({ gameId: 'anitune', from: 'AAAAA', leave: room.leaveRoom });
  });

  it('stays put and says so when the pick cannot be written', async () => {
    const room = stubRoom({ handoff: { start: vi.fn(async () => { throw new Error('Permission denied'); }) } });
    const value = invite();
    results(room, value);
    fireEvent.click(screen.getByRole('button', { name: 'Play AniTune next' }));
    expect(await screen.findByText('Permission denied')).toBeTruthy();
    expect(value.follow).not.toHaveBeenCalled();
  });

  it('tells everyone else who decides', () => {
    results(stubRoom({ isHost: false }), invite());
    expect(screen.getByText('Waiting for the host to pick the next game.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /next$/ })).toBeNull();
  });

  it('is only on a screen marked as the final results', () => {
    results(stubRoom(), invite(), false);
    expect(screen.queryByRole('button', { name: 'Play AniTune next' })).toBeNull();
  });
});

describe('everyone else follows', () => {
  // The room's `next` as a test can move it: the setter is handed out through
  // this box rather than a module variable, which react-hooks forbids.
  const box = {};
  const setNext = (v) => box.set(v);
  function Follower({ room, value, initial }) {
    const [next, set] = useState(initial);
    useEffect(() => { box.set = set; }, []);
    return (
      <InviteContext.Provider value={value}>
        <RoomShell room={{ ...room, handoff: { ...room.handoff, next } }} onExit={() => {}} nextGame>
          <ResultsLayout game={anipeek} title="Final Scores" players={players} />
        </RoomShell>
      </InviteContext.Provider>
    );
  }
  const pick = { gameId: 'anitune', by: 'ana', byName: 'Ana', code: null };

  it('waits for the room, then leaves this one and joins it, once', async () => {
    const room = stubRoom({ myPlayerId: 'ben', isHost: false });
    const value = invite();
    renderArcade(<Follower room={room} value={value} initial={pick} />);
    expect(screen.getByRole('heading', { name: 'On to AniTune' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Final Scores' })).toBeNull();
    expect(value.follow).not.toHaveBeenCalled();

    act(() => setNext({ ...pick, code: 'NEWRM' }));
    await waitFor(() => expect(value.follow).toHaveBeenCalledTimes(1));
    expect(value.follow).toHaveBeenCalledWith({ gameId: 'anitune', code: 'NEWRM', leave: room.leaveRoom });
    act(() => setNext({ ...pick, code: 'NEWRM', byName: 'Ana ' }));
    expect(value.follow).toHaveBeenCalledTimes(1);
  });

  it('leaves the host on the results it just left', () => {
    renderArcade(<Follower room={stubRoom()} value={invite()} initial={pick} />);
    expect(screen.getByRole('heading', { name: 'Final Scores' })).toBeTruthy();
  });

  it('offers a way back once the host has taken too long', () => {
    vi.useFakeTimers();
    try {
      const room = stubRoom({ myPlayerId: 'ben', isHost: false });
      renderArcade(<Follower room={room} value={invite()} initial={pick} />);
      expect(screen.queryByRole('button', { name: 'Back to the results' })).toBeNull();
      act(() => vi.advanceTimersByTime(20000));
      fireEvent.click(screen.getByRole('button', { name: 'Back to the results' }));
      expect(room.handoff.cancel).toHaveBeenCalledWith('AAAAA');
    } finally {
      vi.useRealTimers();
    }
  });

  it('asks for an update when the pick is a game this build lacks', () => {
    renderArcade(<Follower room={stubRoom({ myPlayerId: 'ben' })} value={invite()} initial={{ ...pick, gameId: 'anifuture' }} />);
    expect(screen.getByRole('heading', { name: 'Update needed' })).toBeTruthy();
  });
});

describe('the new game makes the room', () => {
  const mount = (room, value) => renderArcade(
    <InviteContext.Provider value={value}>
      <RoomSetup room={room} onBack={() => {}} />
    </InviteContext.Provider>,
  );
  const arriving = (over) => invite({ gameId: 'anitune', handoff: { from: 'AAAAA', create: true }, ...over });

  it('creates it as the main profile and writes the code back to the old room', async () => {
    seedProfiles([makeProfile('Caden')]);
    const room = stubRoom({ roomCode: null });
    const value = arriving();
    mount(room, value);
    await waitFor(() => expect(room.handoff.announce).toHaveBeenCalledWith('AAAAA', 'NEWRM'));
    expect(room.createRoom).toHaveBeenCalledTimes(1);
    expect(room.createRoom.mock.calls[0][0].id).toBe('caden');
    expect(room.joinRoom).not.toHaveBeenCalled();
    expect(value.consume).toHaveBeenCalled();
  });

  it('makes one room under StrictMode, which runs the effect twice', async () => {
    seedProfiles([makeProfile('Caden')]);
    const room = stubRoom({ roomCode: null });
    renderArcade(
      <StrictMode>
        <InviteContext.Provider value={arriving()}>
          <RoomSetup room={room} onBack={() => {}} />
        </InviteContext.Provider>
      </StrictMode>,
    );
    await waitFor(() => expect(room.handoff.announce).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(room.createRoom).toHaveBeenCalledTimes(1);
  });

  it('takes the pick back when the room cannot be made', async () => {
    seedProfiles([makeProfile('Caden')]);
    const room = stubRoom({ roomCode: null, createRoom: vi.fn(async () => { throw new Error('Could not create a room'); }) });
    mount(room, arriving());
    expect(await screen.findByText('Could not create a room')).toBeTruthy();
    expect(room.handoff.cancel).toHaveBeenCalledWith('AAAAA');
    expect(room.handoff.announce).not.toHaveBeenCalled();
  });

  it('goes straight on from the cover with no code to join', async () => {
    const onOnline = vi.fn();
    const value = arriving({ routed: false });
    renderArcade(
      <InviteContext.Provider value={value}>
        <ModePicker game={anitune} onLocal={() => {}} onOnline={onOnline} onExit={() => {}} />
      </InviteContext.Provider>,
    );
    await waitFor(() => expect(onOnline).toHaveBeenCalledTimes(1));
  });
});
