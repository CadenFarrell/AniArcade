// @vitest-environment jsdom
//
// Next game, same table (shared/utils/handoff.js), on the screens: the host's
// picker under a room's final results, the follow screen every other device
// switches to, and the new game's RoomSetup making the room and writing its
// code back. The room and the hub are stubs — smoke/handoff.smoke.test.js
// runs the writes against the emulator.
import { StrictMode, useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import ModePicker from './ModePicker';
import ResultsLayout from './Results';
import RoomSetup from './RoomSetup';
import RoomShell from './RoomShell';
import { InviteContext } from '../context/inviteContext';
import { useRecordResult } from '../hooks/useRecordResult';
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
    carry: vi.fn(async () => {}),
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

// Game night (shared/utils/night.js): the running table under the same final
// results, the host's way of ending it, and the champion screen it puts up.
describe('the night\'s table', () => {
  const line = (game, title, accent, results) => ({
    game, title, accent, results: Object.entries(results).map(([name, pts]) => ({ name, pts })),
  });
  const two = {
    games: [
      line('anipeek', 'AniPeek', 'slate', { Ana: 1, Ben: 0 }),
      line('anitune', 'AniTune', 'blue', { Ana: 0, Ben: 1, Cy: 2 }),
    ],
    counted: true,
    ended: null,
  };
  const nightRoom = (night, over = {}) => stubRoom({
    ...over,
    handoff: {
      night,
      recordNight: vi.fn(async () => {}),
      endNight: vi.fn(async () => {}),
      resumeNight: vi.fn(async () => {}),
      ...over.handoff,
    },
  });

  it('stays off the screen after one game, which the standings above already show', () => {
    results(nightRoom({ ...two, games: two.games.slice(0, 1) }), invite());
    expect(screen.queryByRole('region', { name: 'Tonight' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'End the night' })).toBeNull();
  });

  it('shows everyone the table from the second game, with who has left it', () => {
    results(nightRoom(two, { isHost: false, myPlayerId: 'ben' }), invite());
    const card = within(screen.getByRole('region', { name: 'Tonight' }));
    expect(card.getByRole('heading', { name: 'Tonight · 2 games' })).toBeTruthy();
    const rows = card.getAllByRole('listitem').map((li) => li.textContent);
    // Cy played one game tonight and is not in this room.
    expect(rows[0]).toMatch(/Cy.*left.*1 game.*2 pts/);
    expect(rows[1]).toMatch(/Ana.*2 games.*1 pt$/);
    expect(rows[2]).toMatch(/Ben.*2 games.*1 pt$/);
    // The games, each by its tile word and who took it.
    expect(rows.slice(3)).toEqual(['AniPeekPeekAna', 'AniTuneTuneCy']);
    expect(screen.queryByRole('button', { name: 'End the night' })).toBeNull();
  });

  it('is only on a screen marked as the final results', () => {
    results(nightRoom(two), invite(), false);
    expect(screen.queryByRole('region', { name: 'Tonight' })).toBeNull();
  });

  it('lets the host end the night, after asking', async () => {
    const room = nightRoom(two);
    results(room, invite());
    fireEvent.click(screen.getByRole('button', { name: 'End the night' }));
    expect(room.handoff.endNight).not.toHaveBeenCalled();
    const dialog = within(screen.getByRole('dialog', { name: 'End the night?' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Not yet' }));
    expect(room.handoff.endNight).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'End the night' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'End the night?' })).getByRole('button', { name: 'End the night' }));
    await waitFor(() => expect(room.handoff.endNight).toHaveBeenCalledTimes(1));
  });

  it('puts the champion over the room once the night is ended', () => {
    const room = nightRoom({ ...two, ended: { by: 'ana', byName: 'Ana' } }, { isHost: false, myPlayerId: 'ben' });
    results(room, invite());
    expect(screen.getByRole('heading', { name: 'Night Champion' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Final Scores' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Champion: Cy' })).toBeTruthy();
    expect(screen.getByText('Ana ended the night.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Keep the night going' })).toBeNull();
    expect(screen.queryByRole('button', { name: /next$/ })).toBeNull();
  });

  it('shares the title on a tie, and lets the host carry on', async () => {
    const tied = { ...two, games: two.games.slice(0, 1).concat(line('anitag', 'AniTag', 'teal', { Ana: 0, Ben: 1 })) };
    const room = nightRoom({ ...tied, ended: { by: 'ana', byName: 'Ana' } });
    results(room, invite());
    expect(screen.getByRole('region', { name: 'Tied: Ana & Ben' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep the night going' }));
    await waitFor(() => expect(room.handoff.resumeNight).toHaveBeenCalledTimes(1));
  });

  it('reports a finished game to the room as players beaten', () => {
    const room = nightRoom(null);
    function Final() {
      useRecordResult('anipeek', players, ['ben'], { places: { ana: 2, ben: 1 } });
      return null;
    }
    renderArcade(
      <InviteContext.Provider value={invite()}>
        <RoomShell room={room} onExit={() => {}} nextGame><Final /></RoomShell>
      </InviteContext.Provider>,
    );
    expect(room.handoff.recordNight).toHaveBeenCalledTimes(1);
    expect(room.handoff.recordNight).toHaveBeenCalledWith({
      game: 'anipeek', results: [{ name: 'Ana', pts: 0 }, { name: 'Ben', pts: 1 }],
    });
  });

  it('reports nothing for a game nobody won', () => {
    const room = nightRoom(null);
    function Final() {
      useRecordResult('anirank', players, []);
      return null;
    }
    renderArcade(
      <InviteContext.Provider value={invite()}>
        <RoomShell room={room} onExit={() => {}} nextGame><Final /></RoomShell>
      </InviteContext.Provider>,
    );
    expect(room.handoff.recordNight).not.toHaveBeenCalled();
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
    // The night is copied across before anyone is told the room exists.
    expect(room.handoff.carry).toHaveBeenCalledWith('AAAAA', 'NEWRM');
    expect(room.handoff.carry.mock.invocationCallOrder[0]).toBeLessThan(room.handoff.announce.mock.invocationCallOrder[0]);
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
