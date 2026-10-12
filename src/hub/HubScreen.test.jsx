// @vitest-environment jsdom
//
// The arcade's first component tests. Every other suite covers a pure rules
// module; this one covers the part none of them can reach — that each game
// actually MOUNTS: the hub tile opens the mode picker, the picker opens local
// play, and the way back out lands on the menu. A render crash anywhere on that
// path is caught by the per-game ErrorBoundary, which a player sees as one game
// being broken and which no rules test would ever notice.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFile } from 'node:fs/promises';
import HubScreen from './HubScreen';
import { games } from './registry';
import { makeProfile, renderArcade, seedProfiles } from '../shared/testing/arcade';

// vitest loads .env.local, and that file points at PRODUCTION Firebase. Forcing
// the unconfigured build is what keeps this suite off the network — and it is
// the build every test here is about: local play must work with no Firebase.
vi.mock('../shared/services/firebase', () => ({
  firebaseEnabled: false,
  getFirebaseAuth: () => { throw new Error('firebase touched in a local-only test'); },
  getFirebaseDb: () => { throw new Error('firebase touched in a local-only test'); },
  ensureSignedIn: () => { throw new Error('firebase touched in a local-only test'); },
}));

const CRASH = /something went wrong/i;

let errors;
beforeEach(() => {
  localStorage.clear();
  // A network call from a local screen is a bug (see CLAUDE.md: with no
  // Firebase config, local play touches no network at all) — with ONE
  // exception: the fact pack, which is a static file the app serves itself
  // and which the quiz must load to have any questions. Serve that from
  // public/ on disk, so the real loader runs; fail everything else loudly.
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const path = String(url);
    const at = path.indexOf('/facts/');
    if (at === -1) throw new Error(`unexpected fetch: ${path}`);
    const file = path.slice(at + 1).split(/[?#]/)[0];
    return new Response(await readFile(`public/${file}`), { status: 200 });
  }));
  // ErrorBoundary logs through console.error, as does React for a failed
  // render — collect both so a test can assert the screen was clean.
  errors = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args); });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// A tile's accessible name carries its blurb too, run together with the title
// ("…questions.AniGuessGuess the…" — jsdom applies no CSS, so both blurb homes
// are in the tree), so no word boundary can find it. A substring can.
const tileFor = (game) =>
  screen.getByRole('button', { name: (name) => name.includes(game.title) });

describe('hub', () => {
  it('renders one tile per registered game', () => {
    renderArcade(<HubScreen />);
    for (const game of games) expect(tileFor(game)).toBeTruthy();
  });

  it('asks a first-time player to set up a profile', () => {
    renderArcade(<HubScreen />);
    expect(screen.getByText(/no profile yet/i)).toBeTruthy();
  });

  it('does not nag a player who already has one', () => {
    seedProfiles([makeProfile('Caden')]);
    renderArcade(<HubScreen />);
    expect(screen.queryByText(/no profile yet/i)).toBeNull();
  });
});

describe.each(games.map((g) => [g.title, g]))('%s', (_title, game) => {
  for (const seeded of [false, true]) {
    const who = seeded ? 'with a saved profile' : 'with no profile at all';

    it(`opens its mode picker and local setup ${who}`, async () => {
      if (seeded) seedProfiles([makeProfile('Caden'), makeProfile('Ayu')]);
      const user = userEvent.setup();
      renderArcade(<HubScreen />);

      await user.click(tileFor(game));
      const local = screen.getByRole('button', { name: /play on this device/i });
      // Unconfigured build: the online path is offered but cannot be taken.
      expect(screen.getByRole('button', { name: /play online/i }).disabled).toBe(true);

      await user.click(local);
      expect(screen.queryByText(CRASH)).toBeNull();
      expect(screen.getByRole('button', { name: /hub/i })).toBeTruthy();
      expect(errors).toEqual([]);
      // Asserted, not left to the stub's throw: a caller that swallows a failed
      // fetch would otherwise hide the request from this test entirely.
      for (const [url] of fetch.mock.calls) expect(String(url)).toContain('/facts/');
    });
  }

  it('returns to the menu from the mode picker and from local setup', async () => {
    seedProfiles([makeProfile('Caden')]);
    const user = userEvent.setup();
    renderArcade(<HubScreen />);

    await user.click(tileFor(game));
    await user.click(screen.getByRole('button', { name: /🏠 hub/i }));
    expect(tileFor(game)).toBeTruthy();

    await user.click(tileFor(game));
    await user.click(screen.getByRole('button', { name: /play on this device/i }));
    // Setup is not mid-session, so the Hub button must leave without a confirm.
    const confirm = vi.spyOn(window, 'confirm');
    await user.click(screen.getByRole('button', { name: /🏠 hub/i }));
    expect(confirm).not.toHaveBeenCalled();
    for (const g of games) expect(tileFor(g)).toBeTruthy();
    expect(errors).toEqual([]);
  });
});
