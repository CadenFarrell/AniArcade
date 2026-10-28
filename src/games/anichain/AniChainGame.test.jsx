// @vitest-environment jsdom
//
// Whole local games through the real screens, one per table shape: the
// givers' handoff and card (with a skip), words counted, a guesser credited,
// a banned word, running out of words, and on to "Final Scores". The rules
// tests prove the scoring; these prove a couch gets from Start to the results
// in every shape without a screen dead-ending.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFile } from 'node:fs/promises';
import AniChainGame from './AniChainGame';
import { renderArcade, seedProfiles } from '../../shared/testing/arcade';
import { profileIdFromName } from '../../shared/utils/profileStats';

vi.mock('../../shared/services/firebase', () => ({
  firebaseEnabled: false,
  getFirebaseAuth: () => { throw new Error('firebase touched in a local-only test'); },
  getFirebaseDb: () => { throw new Error('firebase touched in a local-only test'); },
  ensureSignedIn: () => { throw new Error('firebase touched in a local-only test'); },
}));

// Six shows of four main characters each: plenty to deal, nothing from a pack.
function listFor() {
  return Array.from({ length: 6 }, (_, i) => ({
    id: `s${i}`,
    title: `Show ${i}`,
    characters: Array.from({ length: 4 }, (__, j) => ({
      id: `c${i}-${j}`, name: `Hero ${i} ${j}`, role: 'Main', gender: 'Male', genres: ['Action'],
    })),
  }));
}
const makeTable = (names) => names.map((n) => ({ id: profileIdFromName(n), name: n, animeList: listFor() }));

let errors;
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const path = String(url);
    const at = path.indexOf('/facts/');
    if (at === -1) throw new Error(`unexpected fetch: ${path}`);
    return new Response(await readFile(`public/${path.slice(at + 1).split(/[?#]/)[0]}`), { status: 200 });
  }));
  errors = vi.spyOn(console, 'error');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function start(user, names, prefs) {
  seedProfiles(makeTable(names));
  localStorage.setItem('aniarcade_game_prefs', JSON.stringify({ anichain: prefs }));
  // Seat exactly this table next time the setup opens (useAutoSeat).
  localStorage.setItem('aniarcade_last_tables', JSON.stringify({ anichain: names.map(profileIdFromName) }));
  renderArcade(<AniChainGame onExit={() => {}} />);
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

const button = (name) => screen.queryByRole('button', { name });

// One turn, played as `how`: 'got' (a word, then a guesser), 'banned', or 'out'.
async function playTurn(user, how) {
  await user.click(await screen.findByRole('button', { name: /— show us$/i }));
  expect(screen.getByRole('heading', { name: 'Your Character' })).toBeTruthy();
  await user.click(button('Hide it'));
  if (how === 'banned') {
    await user.click(button('Banned word'));
  } else if (how === 'out') {
    while (button('Next word')) await user.click(button('Next word'));
    await user.click(button('Out of words'));
  } else {
    await user.click(button('Next word'));
    await user.click(button('Next word'));
    await user.click(button('Got it'));
    await user.click(screen.getAllByRole('button', { name: / got it$/i })[0]);
  }
  expect(screen.getByRole('heading', { level: 2, name: { got: 'Got It!', banned: 'Banned Word', out: 'Out of Words' }[how] })).toBeTruthy();
  // The character is revealed on the spot locally.
  expect(screen.getByText('It was')).toBeTruthy();
}

async function nextOrResults(user) {
  const next = button(/^(next round|next turn|see results)$/i);
  await user.click(next);
}

describe('AniChain, one device', () => {
  it('plays a pair game from Start to the final scores', async () => {
    const user = userEvent.setup();
    await start(user, ['Ann', 'Ben', 'Cal'], { shape: 'pair', cap: 6, rounds: 4, pool: 'main' });

    // A skip first: straight to a new card, no second handoff.
    await user.click(await screen.findByRole('button', { name: /— show us$/i }));
    await user.click(button(/don.t know them/i));
    expect(screen.getByRole('heading', { name: 'Your Character' })).toBeTruthy();
    await user.click(button('Hide it'));
    await user.click(button('Next word'));
    await user.click(button('Got it'));
    await user.click(screen.getAllByRole('button', { name: / got it$/i })[0]);
    expect(screen.getByText(/Passed on first/)).toBeTruthy();
    await nextOrResults(user);

    for (const how of ['banned', 'out', 'got']) {
      await playTurn(user, how);
      await nextOrResults(user);
    }
    expect(await screen.findByRole('heading', { name: 'Final Scores' })).toBeTruthy();
    expect(screen.getByText('Every turn')).toBeTruthy();
    expect(errors).not.toHaveBeenCalled();
  });

  it('plays rival givers, crediting only the word’s own team', async () => {
    const user = userEvent.setup();
    await start(user, ['Ann', 'Ben', 'Cal', 'Dee'], { shape: 'rivals', cap: 6, rounds: 4, pool: 'main' });
    await user.click(await screen.findByRole('button', { name: /— show us$/i }));
    await user.click(button('Hide it'));
    await user.click(button('Next word'));
    expect(screen.getByText(/word is for Red only/)).toBeTruthy();
    await user.click(button('Got it'));
    // Red's word: one Red guesser to credit.
    expect(screen.getAllByRole('button', { name: / got it$/i })).toHaveLength(1);
    await user.click(screen.getAllByRole('button', { name: / got it$/i })[0]);
    await nextOrResults(user);
    for (let i = 0; i < 3; i++) {
      await playTurn(user, 'got');
      await nextOrResults(user);
    }
    expect(await screen.findByRole('heading', { name: 'Final Scores' })).toBeTruthy();
    expect(errors).not.toHaveBeenCalled();
  });

  it('plays team pairs, two turns a round', async () => {
    const user = userEvent.setup();
    await start(user, ['Ann', 'Ben', 'Cal', 'Dee', 'Eve', 'Fox'], { shape: 'teams', cap: 6, rounds: 4, pool: 'main' });
    for (let i = 0; i < 8; i++) {
      await playTurn(user, i % 3 === 0 ? 'out' : 'got');
      if (i === 0) expect(button('Next turn')).toBeTruthy();
      await nextOrResults(user);
    }
    expect(await screen.findByRole('heading', { name: 'Final Scores' })).toBeTruthy();
    expect(errors).not.toHaveBeenCalled();
  });
});
