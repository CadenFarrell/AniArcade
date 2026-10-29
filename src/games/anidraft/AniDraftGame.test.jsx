// @vitest-environment jsdom
//
// Whole local games through the real screens: a role reshuffle, every pick of
// a snake draft (card, then "Draft as <role>"), each voter's handoff and
// ballot — with their own team missing from it — the role-by-role reveal, and
// on to "Final Scores". The rules tests prove the scoring; these prove a couch
// gets from Start to the results without a screen dead-ending.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AniDraftGame from './AniDraftGame';
import { renderArcade, seedProfiles } from '../../shared/testing/arcade';
import { profileIdFromName } from '../../shared/utils/profileStats';

vi.mock('../../shared/services/firebase', () => ({
  firebaseEnabled: false,
  getFirebaseAuth: () => { throw new Error('firebase touched in a local-only test'); },
  getFirebaseDb: () => { throw new Error('firebase touched in a local-only test'); },
  ensureSignedIn: () => { throw new Error('firebase touched in a local-only test'); },
}));

// Each player's own five shows of six main characters, plus one show the whole
// table shares: plenty for three boards, and a few names everyone knows.
function listFor(name) {
  const own = Array.from({ length: 5 }, (_, i) => ({
    id: `${name}-s${i}`,
    title: `${name} Show ${i}`,
    characters: Array.from({ length: 6 }, (__, j) => ({
      id: `${name}-c${i}-${j}`, name: `${name} Hero ${i} ${j}`, role: 'Main', gender: 'Male', genres: ['Action'],
    })),
  }));
  const shared = {
    id: 'shared', title: 'Shared Show',
    characters: ['Common One', 'Common Two'].map((n) => ({ id: n, name: n, role: 'Main', gender: 'Female', genres: ['Drama'] })),
  };
  return [...own, shared];
}
const makeTable = (names) => names.map((n) => ({ id: profileIdFromName(n), name: n, animeList: listFor(n) }));

let errors;
beforeEach(() => {
  localStorage.clear();
  // Local play fetches nothing it does not own; this game not even the pack.
  vi.stubGlobal('fetch', vi.fn(async (url) => { throw new Error(`unexpected fetch: ${url}`); }));
  errors = vi.spyOn(console, 'error');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function start(user, names, prefs) {
  seedProfiles(makeTable(names));
  localStorage.setItem('aniarcade_game_prefs', JSON.stringify({ anidraft: prefs }));
  // Seat exactly this table next time the setup opens (useAutoSeat).
  localStorage.setItem('aniarcade_last_tables', JSON.stringify({ anidraft: names.map(profileIdFromName) }));
  renderArcade(<AniDraftGame onExit={() => {}} />);
  await user.click(screen.getByRole('button', { name: /play on this device/i }));
  for (const name of names) {
    if (!screen.queryByRole('button', { name: new RegExp(`remove ${name}`, 'i') })) {
      await user.click(screen.getByRole('button', { name: /add player/i }));
      await user.click(screen.getByRole('button', { name: new RegExp(`add ${name} to this game`, 'i') }));
    }
  }
  const go = screen.getByRole('button', { name: /start game/i });
  await waitFor(() => expect(go.disabled).toBe(false));
  await user.click(go);
}

// Every pick of the round: a free card off the board, into a role. Returns
// what was taken, by its button name.
async function draftRound(user, n) {
  const taken = [];
  for (let i = 0; i < n * 5; i++) {
    expect(screen.getByRole('heading', { level: 2, name: /'s Pick$/ })).toBeTruthy();
    const free = screen.getAllByRole('button', { name: /^Take / });
    const card = free[i % free.length];
    taken.push(card.getAttribute('aria-label'));
    await user.click(card);
    const roles = screen.getAllByRole('button', { name: /^Draft as / });
    await user.click(roles[roles.length - 1]);
  }
  return taken;
}

// Each voter in turn: the handoff, then one choice per role, then cast.
async function voteRound(user, names) {
  for (const name of names) {
    await user.click(screen.getByRole('button', { name: `I'm ${name} — vote` }));
    expect(screen.getByRole('heading', { level: 2, name: `${name}'s Vote` })).toBeTruthy();
    const cast = screen.getByRole('button', { name: 'Cast votes' });
    expect(cast.disabled).toBe(true);
    for (const group of screen.getAllByRole('radiogroup')) {
      // Your own team is not on your ballot: one option per OTHER team.
      const options = within(group).getAllByRole('radio');
      expect(options).toHaveLength(names.length - 1);
      await user.click(options[0]);
    }
    await user.click(cast);
  }
}

async function revealRound(user) {
  expect(screen.getByRole('heading', { level: 2, name: 'Votes Are In' })).toBeTruthy();
  for (let i = 0; i < 5; i++) await user.click(screen.getByRole('button', { name: 'Next role' }));
  expect(screen.queryByRole('button', { name: 'Next role' })).toBeNull();
}

describe('AniDraft, one device', () => {
  it('plays a one-round game from Start to the final scores', async () => {
    const user = userEvent.setup();
    const names = ['Ann', 'Ben', 'Cal'];
    await start(user, names, { rounds: 1, pool: 'main', pickClock: 0 });

    // The roles can be reshuffled until the first pick, and not after.
    await user.click(screen.getByRole('button', { name: 'Shuffle roles' }));
    await draftRound(user, names.length);
    expect(screen.queryByRole('button', { name: 'Shuffle roles' })).toBeNull();

    await voteRound(user, names);
    await revealRound(user);
    await user.click(screen.getByRole('button', { name: 'See results' }));
    expect(await screen.findByRole('heading', { name: 'Final Scores' })).toBeTruthy();
    expect(screen.getByText('Round 1')).toBeTruthy();
    expect(errors).not.toHaveBeenCalled();
  });

  it('plays three rounds, each with a fresh board', async () => {
    const user = userEvent.setup();
    const names = ['Ann', 'Ben', 'Cal'];
    await start(user, names, { rounds: 3, pool: 'main', pickClock: 0 });
    const seen = new Set();
    for (let r = 0; r < 3; r++) {
      const board = screen.getAllByRole('button', { name: /^Take / }).map((b) => b.getAttribute('aria-label'));
      // Nothing drafted in an earlier round comes back.
      for (const name of board) expect(seen.has(name)).toBe(false);
      for (const name of await draftRound(user, names.length)) seen.add(name);
      await voteRound(user, names);
      await revealRound(user);
      await user.click(screen.getByRole('button', { name: r < 2 ? 'Next round' : 'See results' }));
    }
    expect(await screen.findByRole('heading', { name: 'Final Scores' })).toBeTruthy();
    expect(screen.getByText('Round 3')).toBeTruthy();
    expect(errors).not.toHaveBeenCalled();
  }, 60_000);
});
