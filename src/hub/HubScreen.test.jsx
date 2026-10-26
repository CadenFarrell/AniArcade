// @vitest-environment jsdom
//
// The arcade's first component tests. Every other suite covers a pure rules
// module; this one covers the part none of them can reach — that each game
// actually MOUNTS: the hub tile opens the mode picker, the picker opens local
// play, and the way back out lands on the menu. A render crash anywhere on that
// path is caught by the per-game ErrorBoundary, which a player sees as one game
// being broken and which no rules test would ever notice.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
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
// The backup code reads the same flag from here, without the SDK (see
// firebaseConfig.js), so it is forced off the same way.
vi.mock('../shared/services/firebaseConfig', () => ({ firebaseEnabled: false, firebaseConfig: {} }));

const CRASH = /something went wrong/i;

// Every game's code, compiled once before any test runs. Games load on demand
// (shared/utils/lazyGame.js), and the FIRST import of one under vitest means
// transforming its whole folder — well past findBy's one-second wait on a cold
// run. Loading them here makes each test time the hub, not the compiler; the
// tap still goes through Suspense exactly as it does in the app.
beforeAll(() => Promise.all(games.map((g) => g.Component.preload())), 60_000);

let errors;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
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
// Leaving a game runs the panel wipe (useWipe.js), which swaps the screen a
// beat after the press rather than in the same render — hence find, not get.
//
// And a press during the wipe is ignored on purpose (a player cannot reach the
// screen under it either), so a test that presses again must wait for it to end.
const afterWipe = () => waitFor(() => expect(document.querySelector('[data-wipe]')).toBeNull());
const findTile = async (game) => {
  const tile = await screen.findByRole('button', { name: (name) => name.includes(game.title) });
  await afterWipe();
  return tile;
};
const findHub = async () => {
  const hub = await screen.findByRole('button', { name: /^hub$/i });
  await afterWipe();
  return hub;
};

describe('title screen', () => {
  it('greets a fresh tab and opens the hub on Press start', async () => {
    const user = userEvent.setup();
    renderArcade(<HubScreen />, { showTitle: true });
    expect(screen.queryByRole('button', { name: (n) => n.includes(games[0].title) })).toBeNull();

    await user.click(screen.getByRole('button', { name: /press start/i }));
    expect(await findTile(games[0])).toBeTruthy();
    // Remembered for the session, so a refresh mid-game skips it.
    expect(sessionStorage.getItem('aniarcade_title_seen')).toBe('1');
  });
});

describe('hub', () => {
  it('renders one tile per registered game', () => {
    renderArcade(<HubScreen />);
    for (const game of games) expect(tileFor(game)).toBeTruthy();
  });

  it('puts the Hub control in the top bar inside a game', async () => {
    const user = userEvent.setup();
    renderArcade(<HubScreen />);
    await user.click(tileFor(games[0]));
    const hub = await screen.findByRole('button', { name: /^hub$/i });
    expect(hub.closest('header')).toBeTruthy();
  });

  it('asks a first-time player to set up a profile', () => {
    renderArcade(<HubScreen />);
    expect(screen.getByText(/no profile yet/i)).toBeTruthy();
  });

  it('welcomes a device with no profiles, once', async () => {
    const user = userEvent.setup();
    renderArcade(<HubScreen />);
    expect(screen.getByRole('heading', { name: 'Welcome to AniArcade' })).toBeTruthy();
    // No Firebase in this build, so no backup code to offer.
    expect(screen.queryByLabelText('Have a backup code?')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('heading', { name: 'Welcome to AniArcade' })).toBeNull();
    cleanup();
    renderArcade(<HubScreen />);
    expect(screen.queryByRole('heading', { name: 'Welcome to AniArcade' })).toBeNull();
    expect(screen.getByText(/no profile yet/i)).toBeTruthy();
  });

  it('takes a new player straight to an import that makes their profile', async () => {
    const user = userEvent.setup();
    renderArcade(<HubScreen />);
    await user.click(screen.getByRole('button', { name: 'Bring my anime list' }));
    expect(screen.getByRole('heading', { name: 'Bring your anime list' })).toBeTruthy();
    expect(screen.getByLabelText('Your name in the arcade')).toBeTruthy();
    // Closing the import goes back to the welcome, having made nothing.
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('heading', { name: 'Welcome to AniArcade' })).toBeTruthy();
    expect(localStorage.getItem('aniguess_profiles')).toBeNull();
  });

  it('does not welcome a returning player', () => {
    seedProfiles([makeProfile('Caden')]);
    renderArcade(<HubScreen />);
    expect(screen.queryByRole('heading', { name: 'Welcome to AniArcade' })).toBeNull();
  });

  it('does not nag a player who already has one', () => {
    seedProfiles([makeProfile('Caden')]);
    renderArcade(<HubScreen />);
    expect(screen.queryByText(/no profile yet/i)).toBeNull();
  });

  // The tiles wear characters from the MAIN profile's list — a different one
  // on every tile — and a tile with nobody left for it is a bare panel.
  const withPortraits = (name, count) => {
    const p = makeProfile(name, count);
    for (const show of p.animeList) {
      for (const c of show.characters) c.imageUrl = `https://img.test/${encodeURIComponent(c.name)}.jpg`;
    }
    return p;
  };
  const tilePortraits = () =>
    games.map((g) => tileFor(g).querySelector('img')?.getAttribute('src') ?? null);

  it('puts a different character from your list on every tile', () => {
    seedProfiles([withPortraits('Caden', 14), withPortraits('Ayu', 14)], 'caden');
    renderArcade(<HubScreen />);
    const srcs = tilePortraits();
    expect(srcs.every(Boolean)).toBe(true);
    expect(new Set(srcs).size).toBe(games.length);
    // The main profile's characters, never the other saved profile's.
    const caden = withPortraits('Caden', 14).animeList.flatMap((s) => s.characters.map((c) => c.imageUrl));
    for (const src of srcs) expect(caden).toContain(src);
  });

  it('opens the tapped tile into a cover page wearing the same character', async () => {
    seedProfiles([withPortraits('Caden', 14)]);
    const user = userEvent.setup();
    renderArcade(<HubScreen />);
    const game = games[0];
    const src = tileFor(game).querySelector('img').getAttribute('src');

    await user.click(tileFor(game));
    await screen.findByRole('button', { name: /play on this device/i });
    expect(screen.getByRole('heading', { level: 1, name: game.title })).toBeTruthy();
    expect([...document.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toContain(src);
  });

  // shared/utils/inviteLink.js. On this unconfigured build the link can only
  // open the cover — RoomSetup.test.jsx covers the join itself.
  it('opens an invite link’s game past the title screen, and takes the invite off the address bar', async () => {
    const game = games[games.length - 1];
    window.history.replaceState(null, '', `/?game=${game.id}&join=ABCDE&ref=chat`);
    try {
      renderArcade(<HubScreen />, { showTitle: true });
      await screen.findByRole('button', { name: /play on this device/i });
      expect(screen.getByRole('heading', { level: 1, name: game.title })).toBeTruthy();
      expect(window.location.search).toBe('?ref=chat');
      expect(sessionStorage.getItem('aniarcade_title_seen')).toBe('1');
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });

  it('ignores an invite to a game this build does not have', () => {
    window.history.replaceState(null, '', '/?game=pacman&join=ABCDE');
    try {
      renderArcade(<HubScreen />);
      for (const game of games) expect(tileFor(game)).toBeTruthy();
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });

  it('leaves the tiles bare with no profile, and fills only what a small list can', () => {
    renderArcade(<HubScreen />);
    expect(tilePortraits().every((s) => s === null)).toBe(true);
    cleanup();

    // Two shows × two characters: four faces for seven tiles.
    seedProfiles([withPortraits('Caden', 2)]);
    renderArcade(<HubScreen />);
    expect(tilePortraits().filter(Boolean)).toHaveLength(4);
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
      // find, not get: a game's code loads on demand (shared/utils/lazyGame.js),
      // so it mounts a tick after the tap rather than in the same render.
      const local = await screen.findByRole('button', { name: /play on this device/i });
      // Unconfigured build: the online path is offered but cannot be taken.
      expect(screen.getByRole('button', { name: /play online/i }).disabled).toBe(true);

      await user.click(local);
      expect(screen.queryByText(CRASH)).toBeNull();
      expect(screen.getByRole('button', { name: /^hub$/i })).toBeTruthy();
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
    await user.click(await findHub());
    await user.click(await findTile(game));
    await user.click(await screen.findByRole('button', { name: /play on this device/i }));
    // Setup is not mid-session, so the Hub button must leave without a confirm.
    const confirm = vi.spyOn(window, 'confirm');
    await user.click(await findHub());
    expect(confirm).not.toHaveBeenCalled();
    await findTile(game);
    for (const g of games) expect(tileFor(g)).toBeTruthy();
    expect(errors).toEqual([]);
  });
});

// shared/utils/autoSeat.js: a game that needs a crowd seats the couch; a game
// that plays solo seats only the main profile.
describe('auto-seating', () => {
  const byId = (id) => games.find((g) => g.id === id);
  const seats = () => screen.getAllByRole('button', { name: /^remove /i }).length;
  const openLocal = async (user, game) => {
    await user.click(await findTile(game));
    await user.click(await screen.findByRole('button', { name: /play on this device/i }));
  };

  it('seats the three AniFake needs, and only you in AniRank', async () => {
    seedProfiles([makeProfile('Caden'), makeProfile('Ayu'), makeProfile('Mio'), makeProfile('Ren')]);
    const user = userEvent.setup();
    renderArcade(<HubScreen />);

    await openLocal(user, byId('anifake'));
    expect(seats()).toBe(3);
    await user.click(await findHub());
    await openLocal(user, byId('anirank'));
    expect(seats()).toBe(1);
    expect(errors).toEqual([]);
  });

  it('seats everyone there is when the device has fewer than the game needs', async () => {
    seedProfiles([makeProfile('Caden'), makeProfile('Ayu')]);
    const user = userEvent.setup();
    renderArcade(<HubScreen />);

    await openLocal(user, byId('aniturf'));
    expect(seats()).toBe(2);
  });

  it('restores the table this device last started the game with', async () => {
    seedProfiles([makeProfile('Caden'), makeProfile('Ayu'), makeProfile('Mio'), makeProfile('Ren')]);
    localStorage.setItem('aniarcade_last_tables', JSON.stringify({ anitag: ['caden', 'ren', 'mio', 'ayu'] }));
    const user = userEvent.setup();
    renderArcade(<HubScreen />);

    await openLocal(user, byId('anitag'));
    expect(screen.getAllByRole('button', { name: /^remove /i }).map((b) => b.getAttribute('aria-label')))
      .toEqual(['Remove Caden', 'Remove Ren', 'Remove Mio', 'Remove Ayu']);
  });
});
