// @vitest-environment jsdom
//
// Choosing the character a player wears: from a local setup slot (any seat),
// and from the hub's profile list. What has to hold is that the choice reaches
// the stored profile AND the seated copy the setup screen hands to Start, and
// that a clash at the table says who kept the face.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { LocalRoster } from './PlayerSlots';
import ProfilePicker from './ProfilePicker';
import { PlayerRoster } from './Lobby';
import { useRepublishProfile } from '../hooks/useRepublishProfile';
import { renderArcade, seedProfiles } from '../testing/arcade';

// vitest loads .env.local (production Firebase); nothing here may reach it.
vi.mock('../services/firebase', () => ({
  firebaseEnabled: false,
  getFirebaseAuth: () => { throw new Error('firebase touched'); },
  getFirebaseDb: () => { throw new Error('firebase touched'); },
  ensureSignedIn: () => { throw new Error('firebase touched'); },
}));

const pic = (name, favourites) => ({
  id: name, name, favourites, role: 'MAIN', genres: [], imageUrl: `https://img.test/${name}.jpg`,
});
const ann = {
  id: 'ann', name: 'Ann',
  animeList: [{ id: 's1', title: 'Chainsaw Man', characters: [pic('Makima', 900), pic('Power', 500)] }],
};
const ben = {
  id: 'ben', name: 'Ben',
  animeList: [{ id: 's2', title: 'Chainsaw Man', characters: [pic('Power', 500), pic('Aki', 400)] }],
};

const stored = (id) => JSON.parse(localStorage.getItem('aniguess_profiles'))[id];
const faceOf = (name) =>
  screen.getByRole('button', { name: `Choose ${name}'s character` }).querySelector('img')?.getAttribute('src');

// A setup screen in miniature: seated COPIES in state, swapped on update, the
// way every LocalGame's setup holds them.
// `report` hears the seated list after every change, so a test can read the
// copy Start would be handed.
function Setup({ initial, report = () => {} }) {
  const [players, setPlayers] = useState(initial);
  useEffect(() => { report(players); }, [players, report]);
  return (
    <LocalRoster
      players={players}
      activeId="ann"
      onAdd={() => {}}
      onRemove={() => {}}
      onUpdate={(p) => setPlayers((prev) => prev.map((x) => (x.id === p.id ? p : x)))}
    />
  );
}

beforeEach(() => {
  localStorage.clear();
  seedProfiles([ann, ben], 'ann');
  vi.spyOn(console, 'error');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('choosing a character on a setup screen', () => {
  it('saves it to the profile and to the seated copy Start will use', async () => {
    const user = userEvent.setup();
    const report = vi.fn();
    renderArcade(<Setup initial={[ann, ben]} report={report} />);
    expect(faceOf('Ann')).toBe('https://img.test/Makima.jpg');

    await user.click(screen.getByRole('button', { name: "Choose Ann's character" }));
    await user.click(screen.getByRole('button', { name: 'Power, from Chainsaw Man' }));

    expect(faceOf('Ann')).toBe('https://img.test/Power.jpg');
    expect(stored('ann').portraitKey).toBe('power');
    expect(report.mock.lastCall[0].find((p) => p.id === 'ann').portraitKey).toBe('power');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('lets any seat choose, and tells the later seat who kept a shared pick', async () => {
    const user = userEvent.setup();
    renderArcade(<Setup initial={[ann, ben]} />);

    await user.click(screen.getByRole('button', { name: "Choose Ann's character" }));
    await user.click(screen.getByRole('button', { name: 'Power, from Chainsaw Man' }));
    await user.click(screen.getByRole('button', { name: "Choose Ben's character" }));
    await user.click(screen.getByRole('button', { name: 'Power, from Chainsaw Man' }));

    expect(faceOf('Ann')).toBe('https://img.test/Power.jpg');
    expect(faceOf('Ben')).toBe('https://img.test/Aki.jpg');
    expect(screen.getByText('Taken by Ann')).toBeTruthy();
  });

  it('goes back to Automatic, leaving no key behind', async () => {
    const user = userEvent.setup();
    seedProfiles([{ ...ann, portraitKey: 'power' }, ben], 'ann');
    renderArcade(<Setup initial={[{ ...ann, portraitKey: 'power' }]} />);
    expect(faceOf('Ann')).toBe('https://img.test/Power.jpg');

    await user.click(screen.getByRole('button', { name: "Choose Ann's character" }));
    const auto = screen.getByRole('button', { name: 'Automatic character' });
    expect(auto.getAttribute('aria-pressed')).toBe('false');
    await user.click(auto);

    expect(faceOf('Ann')).toBe('https://img.test/Makima.jpg');
    expect('portraitKey' in stored('ann')).toBe(false);
  });
});

describe('choosing a character from the hub', () => {
  it("opens from a profile's row, saves, and comes back to the list", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderArcade(<ProfilePicker mode="main" onClose={onClose} onEditList={() => {}} />);

    await user.click(screen.getByRole('button', { name: "Choose Ben's character" }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading').textContent).toMatch(/Ben/);
    await user.click(within(dialog).getByRole('button', { name: 'Aki, from Chainsaw Man' }));

    expect(stored('ben').portraitKey).toBe('aki');
    expect(screen.getByRole('heading', { name: 'Your profiles' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('is not offered when adding a player to a game', () => {
    renderArcade(<ProfilePicker mode="add" onPick={() => {}} onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: /Choose .*'s character/ })).toBeNull();
  });
});

describe('choosing a character in an online lobby', () => {
  // The room as a lobby sees it: everyone's copy in `players`, and the one
  // channel back up, updateMyProfile. A fake rather than the emulator — what is
  // under test is that the lobby offers the picker on your own seat only and
  // that the choice leaves through the republish, not the room hook itself.
  function Lobby({ room }) {
    const me = room.players.find((p) => p.id === room.myPlayerId) ?? null;
    useRepublishProfile(room, me);
    return (
      <PlayerRoster
        room={room}
        players={room.players}
        active={room.players}
        statuses={{}}
        tone="pink"
      />
    );
  }

  it('offers it on your own seat only, and republishes the choice to the room', async () => {
    const user = userEvent.setup();
    const room = { myPlayerId: 'ann', hostId: 'ben', players: [ben, ann], updateMyProfile: vi.fn() };
    renderArcade(<Lobby room={room} />);

    expect(screen.queryByRole('button', { name: "Choose Ben's character" })).toBeNull();
    await user.click(screen.getByRole('button', { name: "Choose Ann's character" }));
    await user.click(screen.getByRole('button', { name: 'Power, from Chainsaw Man' }));

    expect(stored('ann').portraitKey).toBe('power');
    expect(room.updateMyProfile).toHaveBeenCalledTimes(1);
    expect(room.updateMyProfile.mock.calls[0][0]).toMatchObject({ id: 'ann', portraitKey: 'power' });
  });
});
